#!/bin/bash

# PRODUKTIONS-DEPLOYMENT: Förbyggda ZIP-filer
# Kör detta script EFTER att koden är deployad till produktion

echo "🚀 === PRODUCTION DEPLOYMENT: PREBUILT ZIP SYSTEM ==="
echo "📅 $(date)"
echo ""

# Konfiguration för produktion
PROD_URL="https://dk-leverans.vercel.app"  # Byt till din riktiga produktions-URL
ADMIN_PASSWORD="DronarkompanietAdmin2025!"

echo "🌐 Production URL: $PROD_URL"
echo "🔐 Using admin password: ${ADMIN_PASSWORD:0:15}..."
echo ""

echo "📋 STEG FÖR DEPLOYMENT:"
echo ""

echo "1️⃣ KONTROLLERA ATT KODEN ÄR DEPLOYAD"
echo "   - Gå till Vercel dashboard"
echo "   - Kontrollera att senaste commit är deployad"
echo "   - Vänta tills deployment är 'Ready'"
echo ""

echo "2️⃣ KÖR SQL-SKRIPTET I SUPABASE"
echo "   - Öppna Supabase SQL Editor"
echo "   - Kör innehållet från 'prebuilt-zips-table.sql'"
echo "   - Kontrollera att tabellen skapades: SELECT * FROM prebuilt_zips LIMIT 1;"
echo ""

echo "3️⃣ TESTA API-ENDPOINTS"
echo "   Kör dessa kommandon när deployment är klar:"
echo ""

echo "   # Test 1: Kontrollera batch-status"
echo "   curl -s -X GET \"$PROD_URL/api/admin/batch-prebuilt-zip\" \\"
echo "        -H \"x-admin-password: $ADMIN_PASSWORD\" | head -50"
echo ""

echo "   # Test 2: Bygg ZIP för Marc specifikt"
echo "   curl -s -X POST \"$PROD_URL/api/admin/prebuilt-zip\" \\"
echo "        -H \"Content-Type: application/json\" \\"
echo "        -H \"x-admin-password: $ADMIN_PASSWORD\" \\"
echo "        -d '{\"customerId\": \"eeda2d3b-0ed6-4e21-b307-7b41da72c401\", \"forceRebuild\": true}' | head -50"
echo ""

echo "4️⃣ BYGG ZIP-FILER FÖR ALLA KUNDER"
echo "   Kör batch-kommandot när tester fungerar:"
echo ""
echo "   curl -s -X POST \"$PROD_URL/api/admin/batch-prebuilt-zip\" \\"
echo "        -H \"Content-Type: application/json\" \\"
echo "        -H \"x-admin-password: $ADMIN_PASSWORD\" \\"
echo "        -d '{\"forceRebuild\": true, \"maxConcurrent\": 2}' | head -100"
echo ""

echo "5️⃣ VERIFIERA MARC'S ZIP"
echo "   Kontrollera att Marc's ZIP byggdes:"
echo ""
echo "   curl -s -X GET \"$PROD_URL/api/admin/prebuilt-zip?customerId=eeda2d3b-0ed6-4e21-b307-7b41da72c401\" \\"
echo "        -H \"x-admin-password: $ADMIN_PASSWORD\" | head -20"
echo ""

echo "6️⃣ TESTA NEDLADDNING"
echo "   - Logga in som Marc (marc.zorjan@gotevent.se)"
echo "   - Klicka 'Ladda ner alla filer'"
echo "   - Du bör se: '🎉 SNABBNEDLADDNING TILLGÄNGLIG!'"
echo "   - ZIP-filen bör börja ladda ner omedelbart"
echo ""

echo "✅ FÖRVÄNTADE RESULTAT:"
echo "   - Marc's 306 filer: Omedelbar nedladdning"
echo "   - Ingen väntetid eller timeout"
echo "   - ZIP-fil på ~X MB storlek"
echo "   - Automatisk uppdatering vid nya uploads"
echo ""

echo "🆘 FELSÖKNING:"
echo "   - Kontrollera Vercel Function Logs för API-fel"
echo "   - Kontrollera Supabase Logs för databas-fel" 
echo "   - Kontrollera att R2 credentials är korrekt konfigurerade"
echo "   - Kontrollera att ADMIN_PASSWORD environment variable är satt"
echo ""

echo "📞 SUPPORT:"
echo "   Om något inte fungerar, kontrollera:"
echo "   1. Deployment status i Vercel"
echo "   2. Environment variables (SUPABASE_*, CLOUDFLARE_R2_*)"
echo "   3. Database connection och permissions"
echo "   4. R2 bucket permissions och API keys"
echo ""

echo "🎊 När allt fungerar kommer alla kunder att få:"
echo "   - Snabbare 'Ladda ner alla'-funktion"
echo "   - Valkraven mellan ZIP, Progressiv och Förbyggd nedladdning"
echo "   - Automatiska ZIP-uppdateringar vid nya uploads"
echo "   - Mer tillförlitlig bulk-nedladdning"

echo ""
echo "💡 Kom ihåg: Första gången ZIP:ar byggs kommer det ta tid"
echo "   Men sedan är nedladdningarna omedelbart för alla kunder!"
