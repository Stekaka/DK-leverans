# Deployment Guide för DK Leverans

## 🚀 Snabb deployment på Vercel

### 1. Förbered GitHub Repository
✅ **Klart!** Ditt projekt är redan på GitHub: `https://github.com/Stekaka/DK-leverans.git`

### 2. Deploya på Vercel

1. **Gå till [vercel.com](https://vercel.com)**
2. **Logga in med GitHub**
3. **Klicka på "New Project"**
4. **Välj ditt `DK-leverans` repository**
5. **Vercel kommer automatiskt att detektera Next.js**

### 3. Konfigurera miljövariabler i Vercel

I Vercel dashboard, gå till **Settings > Environment Variables** och lägg till:

```
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

### 4. Deploy
- **Klicka "Deploy"**
- **Vänta på att bygget slutförs**
- **Din app kommer att vara live på en `.vercel.app` URL**

## 🔧 Andra deployment-alternativ

### Netlify
1. Anslut GitHub-repo
2. Byggkommando: `npm run build`
3. Publiceringsmapp: `.next`
4. Lägg till miljövariabler

### Railway
1. Importera från GitHub
2. Railway detekterar automatiskt Next.js
3. Lägg till miljövariabler
4. Deploy

## 📝 Deployment Checklist

- ✅ **Kod pushad till GitHub**
- ⬜ **Supabase-databas konfigurerad**
- ⬜ **Cloudflare R2 bucket skapad**
- ⬜ **Miljövariabler konfigurerade**
- ⬜ **SQL-scheman importerade**
- ⬜ **Första admin-konto testat**
- ⬜ **Demo-kund skapad och testad**

## 🎯 Demo-setup

För att visa projektet:

1. **Skapa en testkund i adminpanelen**
2. **Ladda upp några exempel-bilder**
3. **Testa hela användarflödet**
4. **Förbered demo-script**

## 🔒 Säkerhetsnoter för produktion

- Använd starka lösenord för admin
- Aktivera 2FA på alla tjänster (GitHub, Vercel, Supabase, Cloudflare)
- Granska Supabase RLS-policys
- Sätt upp monitoring och logging
- Konfigurera backup-rutiner

## 📞 Support

För deployment-hjälp:
- Vercel: [vercel.com/docs](https://vercel.com/docs)
- Supabase: [supabase.com/docs](https://supabase.com/docs)
- Cloudflare R2: [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2/)
