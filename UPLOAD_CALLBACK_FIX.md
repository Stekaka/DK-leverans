# Upload Callback Fix - Filregistrering

## Problem
Filer laddades upp till Cloudflare R2 men registrerades inte i Supabase-databasen, så de syntes inte i kundens filvyn i admin-panelen.

## Orsaker identifierade
1. **Upload-callback använder fel autentisering** - använde bara `process.env.ADMIN_PASSWORD` istället för lösenordslistan
2. **Databaskolumnnamn mismatch** - upload-callback använde `file_path` men DB-strukturen använder `cloudflare_url`
3. **Bristfällig felhantering och logging** - svårt att debugga vad som gick fel

## Åtgärder
1. **Uppdaterad autentiseringslogik** - samma lösenordslista som presigned-upload
2. **Fixad databasstruktur** - använder nu `cloudflare_url`, `filename`, `original_name` korrekt
3. **Förbättrad logging** - detaljerade logs för debug och felhantering
4. **Bättre användarfeedback** - alert meddelanden som visar vad som händer

## Ändringar

### upload-callback/route.ts
- Använder samma lösenordslista som presigned-upload (`DronarkompanietAdmin2025!`, etc.)
- Generar fullständig Cloudflare URL: `https://ACCOUNT_ID.r2.cloudflarestorage.com/BUCKET/fileKey`
- Detaljerad logging av autentisering, customer-verifiering och databasinsättning
- Bättre felhantering med specifika felkoder och detaljer

### DirectUploadComponent.tsx  
- Alert-meddelanden som visar om callback lyckas eller misslyckas
- Bättre felhantering för callback-fel
- Behåller befintlig `onUploadComplete()` anrop för UI-uppdatering

## Test
1. Gå till https://dk-leverans.vercel.app/admin
2. Välj kund (t.ex. oliver@dronarkompaniet.se)
3. Ladda upp filer
4. Kontrollera att filerna syns i filvyn efter upload
5. Kolla browser console för detaljerade logs

## Förväntade resultat
- ✅ Filer laddas upp till Cloudflare R2
- ✅ Filer registreras i Supabase-databasen 
- ✅ Filer syns i admin-panelens filvyn
- ✅ Mappstruktur bevaras
- ✅ Thumbnail-generering fungerar
- ✅ Alert-meddelanden informerar om status

Deployment: Väntar på Vercel auto-deploy från senaste commit f09d65e
