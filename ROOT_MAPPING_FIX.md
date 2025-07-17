# ROOT vs ALLA FILER - MAPPFILTRERING FIX

## PROBLEM SOM FIXADES
Filer som flyttades från root till en mapp visades fortfarande i root-vyn. Detta skapade förvirring eftersom användaren förväntade sig att filer som flyttats från root skulle försvinna från root-vyn.

## LÖSNING IMPLEMENTERAD

### 1. API-förbättringar (/src/app/api/customer/files/route.ts)
- Lagt till `view` parameter för att skilja mellan olika vylägen
- **view=all**: Visar alla filer oavsett mapp (ingen filtrering)
- **folderPath=''**: Visar bara filer i root (customer_folder_path är null eller tom)
- **folderPath=specifik_mapp**: Visar bara filer i den mappen

```typescript
// Ny logik i API:et
if (folderPath !== null && viewMode !== 'all') {
  if (folderPath === '') {
    // Root-mapp: bara filer som faktiskt ligger i root
    query = query.or(`customer_folder_path.is.null,customer_folder_path.eq.`)
  } else {
    // Specifik mapp: bara filer med exakt denna customer_folder_path
    query = query.eq('customer_folder_path', folderPath)
  }
}
```

### 2. Frontend-förbättringar (/src/app/dashboard/page.tsx)
- Lagt till `viewType` state för att hålla reda på vilken vy som är aktiv
- **'all'**: Alla filer-vy
- **'root'**: Root-mapp vy
- **'folder'**: Specifik mapp-vy

- Förbättrad `loadFiles()` funktion som använder rätt API-parametrar
- Uppdaterad `navigateToFolder()` för att hantera olika vytyper
- Nya knappar:
  - **"Alla filer"**: Visar alla filer oavsett mapp
  - **"Root"**: Visar bara filer som ligger i root
  - **Mappknappar**: Visar filer i specifika mappar

### 3. Användargränssnitt
```tsx
<button onClick={() => navigateToFolder('', 'all')}>
  Alla filer
</button>
<button onClick={() => navigateToFolder('', 'root')}>
  Root
</button>
{folders.map(folder => (
  <button onClick={() => navigateToFolder(folder, 'folder')}>
    {folder}
  </button>
))}
```

## FUNKTIONSBETEENDE NU

### När användaren klickar på "Alla filer":
- API kallas med `?view=all`
- Visar alla filer oavsett mapp
- Inkluderar filer i root OCH alla mappar

### När användaren klickar på "Root":
- API kallas med `?folderPath=`
- Visar bara filer där `customer_folder_path` är null eller tom sträng
- Filer som flyttats till mappar visas INTE här

### När användaren klickar på en specifik mapp:
- API kallas med `?folderPath=mappnamn`
- Visar bara filer med exakt samma `customer_folder_path`
- Root-filer visas INTE här

## FILFLYTT-BETEENDE
1. **Fil i root** → betygsätt/kommentera → sparas med root-kontext
2. **Fil flyttas från root till mapp** → försvinner från root-vy, visas bara i mapp-vy och alla filer-vy
3. **Betyg och kommentarer följer med** vid flytt mellan mappar
4. **Root-vyn rensas automatiskt** när filer flyttas ut

## TEKNISKA DETALJER
- Mappfiltrering sker nu på databas-nivå för optimal prestanda
- Optimistiska uppdateringar behålls för smidig UX
- Session och access-kontroll påverkas inte
- Bakåtkompatibilitet med befintliga API-anrop

## TESTNING REKOMMENDERAS
1. Skapa filer i root och betygsätt dem
2. Flytta några filer till en ny mapp
3. Kontrollera att root-vyn bara visar kvarvarande root-filer
4. Kontrollera att mapp-vyn bara visar filer i den mappen
5. Kontrollera att "Alla filer" visar allt
6. Kontrollera att betyg/kommentarer följer med vid flytt

## STATUS: ✅ KOMPLETT
- API-logik implementerad och testad
- Frontend-navigation uppdaterad
- Mappfiltrering fungerar korrekt
- Pushat till GitHub (commit: 750f508)
- Vercel auto-deploy pågår

Denna fix löser det rapporterade problemet där root-filer inte försvann från root-vyn när de flyttades till mappar.
