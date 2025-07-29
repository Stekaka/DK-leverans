#!/bin/bash

# Snabbtest: Bygg ZIP för Marc Zorjan specifikt
echo "🎯 === BYGGER ZIP FÖR MARC ZORJAN ==="

MARC_ID="eeda2d3b-0ed6-4e21-b307-7b41da72c401"
BASE_URL="http://localhost:3000"
ADMIN_PASSWORD="DronarkompanietAdmin2025!"

echo "📧 Kund: Marc Zorjan (marc.zorjan@gotevent.se)"
echo "🆔 Customer ID: $MARC_ID"
echo ""

# Steg 1: Kontrollera nuvarande status
echo "🔍 Kontrollerar nuvarande status..."

curl -s -X GET "$BASE_URL/api/admin/prebuilt-zip?customerId=$MARC_ID" \
  -H "x-admin-password: $ADMIN_PASSWORD" | jq '.'

echo ""

# Steg 2: Bygg ZIP
echo "📦 Bygger förbyggd ZIP för Marc..."

RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/prebuilt-zip" \
  -H "Content-Type: application/json" \
  -H "x-admin-password: $ADMIN_PASSWORD" \
  -d "{
    \"customerId\": \"$MARC_ID\",
    \"forceRebuild\": true
  }")

echo "📊 Resultat:"
echo "$RESPONSE" | jq '.'

# Kontrollera om det lyckades
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ]; then
  FILE_COUNT=$(echo "$RESPONSE" | jq -r '.fileCount // 0')
  ZIP_SIZE_MB=$(echo "$RESPONSE" | jq -r '(.zipSize // 0) / 1024 / 1024 | floor')
  
  echo ""
  echo "✅ SUCCESS! Marc har nu en färdig ZIP med:"
  echo "   📁 $FILE_COUNT filer"  
  echo "   💾 ${ZIP_SIZE_MB} MB storlek"
  echo ""
  echo "🚀 Marc kan nu klicka 'Ladda ner alla' för omedelbar nedladdning!"
else
  echo ""
  echo "❌ FAILED! Något gick fel:"
  echo "$RESPONSE" | jq -r '.error // "Okänt fel"'
fi
