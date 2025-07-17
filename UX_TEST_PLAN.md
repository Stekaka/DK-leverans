# UX-TESTPLAN: NAVIGATION OCH SESSION-FÖRBÄTTRINGAR

## 🎯 Testområden att verifiera:

### 1. LOGIN-FÖRBÄTTRINGAR
- [ ] **"Kom ihåg mig"-checkbox**: Visas på login-sidan
- [ ] **Session-längd**: 
  - Utan checkbox: 1 dag session
  - Med checkbox: 30 dagars session
- [ ] **Auto-redirect**: Om redan inloggad på `/login` → `/dashboard`

### 2. NAVIGATION-FÖRBÄTTRINGAR
- [ ] **Klickbara loggor**: 
  - Kundportal: Logga → startsida (`/`)
  - Adminpanel: Logga → startsida (`/`)
  - Hover-effekt på loggor
- [ ] **"Till admin"-knapp**: Borttagen från kundportal

### 3. LOGOUT-FÖRBÄTTRINGAR
- [ ] **Kundportal logout**: 
  - Rensar session korrekt
  - Går till startsida (`/`) istället för `/login`
- [ ] **Admin logout**: 
  - Använder `/api/auth/admin/logout`
  - Går till startsida (`/`)

### 4. FILORGANISERING (Tidigare fixat)
- [ ] **Mappfiltrering**: Filer syns bara i en mapp åt gången
- [ ] **Betyg och kommentarer**: Följer med filen när den flyttas
- [ ] **"Kom ihåg mig"**: Bevarar inloggning mellan sessioner

### 5. ACCESS-SYSTEM (Tidigare fixat)
- [ ] **Admin access-info**: Timer och status visas korrekt
- [ ] **Kundportal access**: Ingen "failed to check access"
- [ ] **Performance**: Inga timeouts i access-API

## 🚀 Manual Test Steps:

### Test 1: Login med "Kom ihåg mig"
1. Gå till `/login`
2. Logga in UTAN "kom ihåg mig" → verifiera session
3. Logga ut → logga in MED "kom ihåg mig" → verifiera session
4. Försök gå till `/login` när redan inloggad → auto-redirect

### Test 2: Navigation
1. **Kundportal**: Klicka på logga → ska gå till `/`
2. **Adminpanel**: Klicka på logga → ska gå till `/`
3. **Verify**: Ingen "Till admin"-knapp i kundportal

### Test 3: Logout
1. **Kundportal**: Logga ut → ska gå till `/` (inte `/login`)
2. **Admin**: Logga ut → ska gå till `/` (inte `/login`)
3. **Session**: Verifiera att session rensats (kan inte komma åt dashboard)

### Test 4: Access & Files (Regressionstest)
1. **Admin**: Kontrollera att access-timer visas
2. **Kund**: Verifiera att filer laddar utan fel
3. **Filorganisering**: Testa flytta fil och verifiera betyg följer med

## ✅ Expected Results:
- Smidig navigation mellan sidor
- Korrekt session-hantering
- Professionell användarupplevelse
- Inga console-fel eller API-timeouts
- Alla befintliga funktioner fungerar fortfarande

---
**Status**: 🆕 Klar för testning  
**Datum**: 16 juli 2025  
**Commit**: 619298e - UX navigation och session-förbättringar
