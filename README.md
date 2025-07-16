# 🚁 DK Leverans - Drönarkompaniets Leveransportal

En professionell, säker och modern leveransportal för drönarbilder och videomaterial. Byggd med Next.js, TypeScript, Tailwind CSS, Supabase och Cloudflare R2.

![Drönarkompaniet Logo](https://via.placeholder.com/200x60/1f2937/fbbf24?text=Drönarkompaniet)

## ✨ Funktioner

### 👥 För Kunder
- 🔐 **Säker inloggning** - Personliga inloggningsuppgifter för varje kund
- �️ **Interaktivt galleri** - Professionell visning av bilder och videor med thumbnails
- 📱 **Responsiv design** - Perfekt användarupplevelse på alla enheter
- ⬇️ **Flexibel nedladdning** - Ladda ner enstaka filer eller hela projekt
- ⭐ **Betygsättning** - Betygsätt och sortera material
- 📁 **Mapporganisering** - Material organiserat i mappar per projekt

### 👨‍💼 För Administratörer
- 🎛️ **Adminpanel** - Komplett kontroll över kunder och material
- 👤 **Kundhantering** - Skapa, redigera och hantera kundkonton
- 📂 **Filhantering** - Ladda upp och organisera material per kund
- 📊 **Statistik** - Överblick över användning och filstatistik
- 🔑 **Lösenordshantering** - Automatisk generering av säkra lösenord

## 🛠️ Teknisk Stack

- **Frontend:** Next.js 14 + TypeScript
- **Styling:** Tailwind CSS (luxury guld/svart/vitt tema)
- **Databas:** Supabase (PostgreSQL)
- **Fillagring:** Cloudflare R2
- **Autentisering:** Session-baserad med cookies
- **Bildbehandling:** Sharp för thumbnail-generering

## 🚀 Kom igång

### Förutsättningar
- Node.js 18+ 
- npm eller yarn
- Supabase-konto
- Cloudflare R2-konto

### Installation

1. **Klona projektet:**
```bash
git clone [your-repo-url]
cd DK-leverans
```

2. **Installera beroenden:**
```bash
npm install
```

3. **Sätt upp miljövariabler:**
```bash
cp .env.example .env.local
```

Fyll i dina API-nycklar i `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_key
CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password
```

4. **Sätt upp databasen:**
```bash
# Kör SQL-scriptsen i Supabase SQL Editor:
# 1. supabase-setup.sql
# 2. supabase-thumbnails-ratings-safe.sql
# 3. supabase-folder-support.sql
```

5. **Starta utvecklingsservern:**
```bash
npm run dev
```

6. **Öppna applikationen:**
Besök [http://localhost:3000](http://localhost:3000)

## 📁 Projektstruktur

```
src/
├── app/
│   ├── admin/              # Adminpanel
│   ├── dashboard/          # Kundportal
│   ├── login/              # Kundinloggning
│   ├── api/                # API-routes
│   │   ├── admin/          # Admin API:er
│   │   ├── auth/           # Autentisering
│   │   └── customer/       # Kund API:er
│   └── components/         # Återanvändbara komponenter
lib/
├── supabase.ts            # Supabase-konfiguration
├── database.ts            # Databasoperationer
├── cloudflare-r2.ts       # Fillagring
├── thumbnail-generator.ts # Bildbehandling
└── password-generator.ts  # Lösenordsgenerering
```

## 🔐 Säkerhet

- **Miljövariabler:** Alla känsliga nycklar lagras i `.env.local`
- **Session-hantering:** HttpOnly cookies för säkra sessioner
- **Databasåtkomst:** RLS (Row Level Security) i Supabase
- **Filåtkomst:** Säkra signerade URLs från Cloudflare R2
- **Lösenord:** Säker generering och hantering av kundlösenord

## 🎨 Design & UX

- **Färgschema:** Luxury guld/svart/vitt/grått tema
- **Typografi:** Modern och lättläst
- **Ikoner:** Heroicons för konsistent design
- **Animationer:** Subtila övergångar och effekter
- **Tillgänglighet:** WCAG-kompatibel design

## 📋 API-dokumentation

### Admin API:er
- `POST /api/admin/customers` - Skapa ny kund
- `GET /api/admin/customers` - Hämta alla kunder
- `PUT /api/admin/customers/[id]` - Uppdatera kund
- `POST /api/admin/upload` - Ladda upp filer

### Kund API:er
- `POST /api/auth/login` - Kundinloggning
- `GET /api/customer/files` - Hämta kundens filer
- `GET /api/customer/folders` - Hämta kundens mappar
- `POST /api/customer/rating` - Betygsätt material

## 🚀 Deployment

### Vercel (Rekommenderat)
1. Anslut Git-repo till Vercel
2. Sätt miljövariabler i Vercel dashboard
3. Deploy automatiskt vid push

### Andra plattformar
Projektet kan deployas på alla Next.js-kompatibla plattformar som:
- Netlify
- Railway
- Digital Ocean App Platform

## 🤝 Bidrag

Detta är ett proprietärt projekt för Drönarkompaniet. För support eller frågor:

- 📧 Email: info@dronarkompaniet.se  
- 📞 Telefon: +46 709-607208

## 📄 Licens

© 2025 Drönarkompaniet Norden AB. Alla rättigheter förbehållna.

---

**Utvecklat av:** Drönarkompaniet Norden AB  
**Version:** 1.0.0  
**Senast uppdaterad:** Juli 2025
- Professionell landningssida
- Information om tjänster
- Call-to-action för registrering/inloggning

### Inloggning (/login)
- Säker inloggning för kunder
- Lösenordsåterställning (förberedd)
- Responsiv design

### Registrering (/register)
- Kundregistrering med kontaktinformation
- Projekttypsval
- Bekräftelsesida

### Dashboard (/dashboard)
- Översikt av tillgängligt material
- Grid- och listvy
- Filtrering (bilder/videor)
- Bulk-nedladdning
- Individuell nedladdning

## Nästa steg för utveckling

1. **Backend-integration:**
   - Implementera riktiga API:er för autentisering
   - Databas för användare och filer
   - Filuppladdning för admin

2. **Säkerhet:**
   - JWT-autentisering
   - Filåtkomstskontroll
   - HTTPS i produktion

3. **Funktionalitet:**
   - Admin-panel för filuppladdning
   - E-postnotifikationer
   - Lösenordsåterställning
   - Filförhandsvisning

4. **Hosting:**
   - Deploye till Vercel/Netlify
   - Konfigurera domän
   - SSL-certifikat

## Anpassning

Projektet är byggt för att vara enkelt att anpassa:

- **Färger:** Ändra i `tailwind.config.js`
- **Logotyp:** Ersätt "DK Leverans" med din logotyp
- **Kontaktinfo:** Uppdatera i footer och andra relevanta ställen
- **Texter:** Alla texter är på svenska och lätta att ändra

## Support

För frågor eller support, kontakta utvecklaren eller skapa en issue i projektets repository.
