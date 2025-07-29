#!/bin/bash

# Snabbtest: Bygg ZIP för Marc Zorjan (utan jq)
echo "🎯 === BYGGER ZIP FÖR MARC ZORJAN ==="

MARC_ID="eeda2d3b-0ed6-4e21-b307-7b41da72c401"
BASE_URL="http://localhost:3000"
ADMIN_PASSWORD="DronarkompanietAdmin2025!"

echo "📧 Kund: Marc Zorjan (marc.zorjan@gotevent.se)"
echo "🆔 Customer ID: $MARC_ID"
echo ""

# Steg 1: Kontrollera nuvarande status
echo "🔍 Kontrollerar nuvarande status..."

STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/prebuilt-zip?customerId=$MARC_ID" \
  -H "x-admin-password: $ADMIN_PASSWORD")

echo "Status response: $STATUS_RESPONSE"
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

echo "📊 Full response:"
echo "$RESPONSE"
echo ""

# Enkel kontroll om success finns i svaret
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ SUCCESS! ZIP-bygget verkar ha lyckats!"
  echo ""
  echo "🔍 Detaljer i response ovan:"
  echo "   - Leta efter 'fileCount' för antal filer"
  echo "   - Leta efter 'zipSize' för storlek i bytes"
  echo "   - Leta efter 'action' för vad som gjordes"
  echo ""
  echo "🚀 Marc kan nu testa 'Ladda ner alla' för omedelbar nedladdning!"
else
  echo "❌ FAILED! Kontrollera response ovan för feldetaljer"
  
  if echo "$RESPONSE" | grep -q '"error"'; then
    echo ""
    echo "🔍 Sök efter 'error' i response ovan för mer information"
  fi
fi

echo ""
echo "📋 Nästa steg:"
echo "   1. Kontrollera att Marc's 306 filer visas i 'fileCount'"
echo "   2. Gå till dashboard och testa 'Ladda ner alla'"
echo "   3. Du bör se popup: 'SNABBNEDLADDNING TILLGÄNGLIG!'"
