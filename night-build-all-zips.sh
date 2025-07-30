#!/bin/bash

# SNABB NATT-KÖRNING: Skapa ZIP-filer för alla kunder
# Kör detta när SQL-tabellen är skapad

echo "🌙 === NATT-KÖRNING: BYGG ALLA ZIP-FILER ==="
echo "📅 $(date)"
echo ""

# Konfiguration
PROD_URL="https://dk-leverans.vercel.app"
ADMIN_PASSWORD="DronarkompanietAdmin2025!"

echo "🌐 URL: $PROD_URL"
echo "⏰ Startar natt-körning..."
echo ""

echo "📋 STEG 1: Kontrollera API"
echo "Testar att API:et svarar..."

# Test API
curl_result=$(curl -s -w "%{http_code}" -X GET "$PROD_URL/api/admin/batch-prebuilt-zip" \
     -H "x-admin-password: $ADMIN_PASSWORD" -o /tmp/api_test.json)

if [ "$curl_result" = "200" ]; then
    echo "✅ API fungerar!"
    echo "📊 Status från servern:"
    cat /tmp/api_test.json | head -20
    echo ""
else
    echo "❌ API-fel: HTTP $curl_result"
    echo "🆘 Kontrollera deployment och environment variables"
    exit 1
fi

echo ""
echo "📋 STEG 2: Starta batch-körning för alla kunder"
echo "⚠️  Detta kommer ta tid - kan köra i flera timmar för många kunder"
echo "💡 ZIP-filer byggs 2 åt gången för att inte överbelasta servern"
echo ""

read -p "Vill du fortsätta? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Avbryter."
    exit 0
fi

echo "🚀 Startar batch-byggning..."
echo "📅 $(date)"

# Kör batch-kommandot
curl -X POST "$PROD_URL/api/admin/batch-prebuilt-zip" \
     -H "Content-Type: application/json" \
     -H "x-admin-password: $ADMIN_PASSWORD" \
     -d '{"forceRebuild": true, "maxConcurrent": 2}' \
     -w "\n⏱️  Total tid: %{time_total}s\n"

echo ""
echo "📋 STEG 3: Kontrollera resultat"
echo "Hämtar status efter körning..."

curl -s -X GET "$PROD_URL/api/admin/batch-prebuilt-zip" \
     -H "x-admin-password: $ADMIN_PASSWORD" | head -50

echo ""
echo "✅ Natt-körning klar!"
echo "📅 $(date)"
echo ""
echo "🎯 Nästa steg:"
echo "1. Kontrollera att Marc's ZIP byggdes"
echo "2. Testa nedladdning som Marc (marc.zorjan@gotevent.se)"
echo "3. Övriga kunder får nu omedelbar 'Ladda ner alla'-funktion"
