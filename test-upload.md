# Test av Upload-funktionalitet

## VIKTIGT: Vercel Serverless Function Begränsningar

⚠️ **Nya begränsningar för Vercel deployment:**
- **Max filstorlek**: 4MB per fil
- **Max batch-storlek**: 3.5MB total per batch
- **Orsak**: Vercel serverless functions har 4.5MB payload-gräns

## Förbättringar som gjorts för batch-upload:

### 1. Retry-logik för R2-uppladdningar
- 3 försök per fil
- Progressiv delay mellan försök (1s, 2s, 3s)
- Detaljerad loggning av varje försök

### 2. Timeout-hantering
- 60 sekunders timeout för stora filer
- Förhindrar hängande requests
- Specifika felmeddelanden för timeout-situationer

### 3. Förbättrad felhantering
- Specifika felmeddelanden för olika typer av R2-problem:
  - Access Denied (403) - kredential-problem
  - Bucket Not Found (404) - bucket-konfiguration
  - Timeout/Connection Reset - nätverksproblem
- Cleanup av R2-filer om metadata-sparande misslyckas

### 4. Partiell framgång
- Visar antal lyckade vs misslyckade filer
- Detaljerad lista över fel
- Fortsätter bearbeta andra filer även om en misslyckas

### 5. Bättre validering
- Kontrollerar filstorlek (max 100MB)
- Validerar filtyper före upload
- Detaljerad loggning av varje steg

## Testscenarios att verifiera:

### Test 1: Normal upload av flera filer
- Välj 3-5 bilder < 4MB vardera
- Total batch-storlek < 3.5MB
- Kontrollera att alla laddas upp framgångsrikt
- Verifiera att thumbnails genereras för bilder

### Test 2: Stora filer (begränsad på Vercel)
- Testa med filer mellan 2-4MB
- Kontrollera att frontend varnar för filer > 4MB
- Verifiera att batch-storlek kontrolleras

### Test 3: Överstorlek-hantering
- Försök ladda upp fil > 4MB (ska avvisas av frontend)
- Försök ladda upp batch > 3.5MB total (ska avvisas)
- Kontrollera felmeddelanden är tydliga

### Test 4: Nätverksproblem
- Simulera svag anslutning
- Kontrollera att retry-logiken aktiveras
- Verifiera att timeout fungerar vid långsamma uploads

### Test 5: R2-konfigurationsproblem
- Testa med felaktiga credentials (simulera via miljövariabler)
- Kontrollera att specifika felmeddelanden visas

## Expected Behavior:

1. **Lyckad upload**: Visar "✅ Alla X filer uppladdades framgångsrikt!"
2. **Partiell framgång**: Visar "Upload delvis lyckad! ✅ X filer uppladdade ❌ Y filer misslyckades"
3. **Total misslyckande**: Visar specifikt felmeddelande med detaljer

## API Response Format:

```json
{
  "message": "Processing complete: X successful, Y failed",
  "files": [...],
  "customer": "Customer Name",
  "totalFiles": 5,
  "successCount": 3,
  "errorCount": 2,
  "errors": [
    "File image.txt has unsupported type: text/plain",
    "File large.mp4 is too large: 150MB (max 100MB)"
  ]
}
```

## Troubleshooting:

Om upload fortfarande misslyckas:

1. Kontrollera att alla miljövariabler är satta i Vercel
2. Testa `/api/admin/test-debug` för att verifiera R2-anslutning
3. Kontrollera Vercel-loggar för detaljerade felmeddelanden
4. Verifiera att bucket-namn och credentials är korrekta
