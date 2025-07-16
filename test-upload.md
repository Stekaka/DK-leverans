# Test av Upload-funktionalitet

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
- Välj 3-5 bilder/videor < 10MB
- Kontrollera att alla laddas upp framgångsrikt
- Verifiera att thumbnails genereras för bilder

### Test 2: Stora filer
- Testa med filer > 10MB (men < 100MB)
- Kontrollera att timeout-hantering fungerar
- Verifiera att stora filer markeras som "large file"

### Test 3: Batch med blandade resultat
- Inkludera ogiltiga filtyper (.txt, .zip)
- Inkludera en fil > 100MB
- Verifiera att giltiga filer laddas upp trots fel på andra

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
