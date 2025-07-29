#!/bin/bash

# Script för att bygga förbyggda ZIP-filer för alla befintliga kunder
# VIKTIGT: Varje kund får sin egen isolerade ZIP med endast sina filer

echo "🚀 === BYGGER FÖRBYGGDA ZIP-FILER FÖR BEFINTLIGA KUNDER ==="
echo "📅 Startar: $(date)"

# Konfiguration
BASE_URL="http://localhost:3000"
ADMIN_PASSWORD="DronarkompanietAdmin2025!"
MAX_CONCURRENT=2
PAUSE_BETWEEN_BATCHES=3

# Färger för output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "⚙️  Konfiguration:"
echo "   - Base URL: $BASE_URL"
echo "   - Max samtidiga: $MAX_CONCURRENT"
echo "   - Paus mellan batchar: ${PAUSE_BETWEEN_BATCHES}s"
echo ""

# Steg 1: Hämta status för alla kunder
echo "📊 Steg 1: Hämtar kundstatus..."

STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/batch-prebuilt-zip" \
  -H "x-admin-password: $ADMIN_PASSWORD")

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Kunde inte hämta kundstatus${NC}"
  exit 1
fi

# Skriv ut sammanfattning
echo "$STATUS_RESPONSE" | jq -r '.summary | "📈 Sammanfattning:
   - Totalt kunder: \(.totalCustomers)
   - Kunder med filer: \(.customersWithFiles)  
   - Kunder med ZIP: \(.customersWithZip)
   - Kunder med utgången ZIP: \(.customersWithExpiredZip)
   - Kunder som behöver ZIP: \(.customersNeedingZip)"'

echo ""

# Bekräftelse från användaren
CUSTOMERS_NEEDING_ZIP=$(echo "$STATUS_RESPONSE" | jq -r '.summary.customersNeedingZip')

if [ "$CUSTOMERS_NEEDING_ZIP" -eq 0 ]; then
  echo -e "${GREEN}✅ Alla kunder har redan aktuella ZIP-filer!${NC}"
  exit 0
fi

echo -e "${YELLOW}⚠️  Detta kommer att skapa ZIP-filer för $CUSTOMERS_NEEDING_ZIP kunder${NC}"
echo "🔒 SÄKERHET: Varje kund får endast tillgång till sina egna filer"
echo ""

read -p "Fortsätt? (j/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[JjYy]$ ]]; then
  echo "Avbröts av användaren"
  exit 0
fi

# Steg 2: Hämta lista över kunder som behöver ZIP
echo "📋 Steg 2: Förbereder kundlista..."

CUSTOMERS_NEEDING_ZIP_IDS=$(echo "$STATUS_RESPONSE" | jq -r '.customers[] | select(.needsZip == true) | .id')

if [ -z "$CUSTOMERS_NEEDING_ZIP_IDS" ]; then
  echo -e "${GREEN}✅ Inga kunder behöver ZIP-uppdatering${NC}"
  exit 0
fi

# Konvertera till JSON-array
CUSTOMER_IDS_ARRAY=$(echo "$CUSTOMERS_NEEDING_ZIP_IDS" | jq -R -s 'split("\n") | map(select(length > 0))')

echo "🎯 Kunder att bearbeta:"
echo "$CUSTOMER_IDS_ARRAY" | jq -r '.[] as $id | ($STATUS_RESPONSE | fromjson.customers[] | select(.id == $id) | "   - \(.name) (\(.email))")'

echo ""

# Steg 3: Bygg ZIP-filer i batchar
echo "📦 Steg 3: Bygger ZIP-filer..."
echo "⏱️  Detta kan ta flera minuter beroende på antal filer..."
echo ""

BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/batch-prebuilt-zip" \
  -H "Content-Type: application/json" \
  -H "x-admin-password: $ADMIN_PASSWORD" \
  -d "{
    \"customerIds\": $CUSTOMER_IDS_ARRAY,
    \"forceRebuild\": true,
    \"maxConcurrent\": $MAX_CONCURRENT
  }")

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Batch-bygget misslyckades${NC}"
  exit 1
fi

# Kontrollera om batch-jobbet lyckades
SUCCESS=$(echo "$BATCH_RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" != "true" ]; then
  echo -e "${RED}❌ Batch-bygget rapporterade fel:${NC}"
  echo "$BATCH_RESPONSE" | jq -r '.error // "Okänt fel"'
  exit 1
fi

# Visa resultat
echo -e "${GREEN}🎉 Batch-bygget slutfört!${NC}"
echo ""

RESULTS=$(echo "$BATCH_RESPONSE" | jq -r '.results')

echo "📊 Resultat:"
echo "$RESULTS" | jq -r '"   - Totalt: \(.total) kunder
   - Bearbetade: \(.processed) kunder  
   - Lyckade: \(.successful) kunder
   - Misslyckade: \(.failed) kunder"'

# Visa detaljer för lyckade
echo ""
echo -e "${GREEN}✅ Lyckade ZIP-filer:${NC}"
echo "$RESULTS" | jq -r '.details[] | select(.success == true) | "   🎯 \(.customer) (\(.email))
      📁 Filer: \(.fileCount)
      💾 Storlek: \((.zipSize / 1024 / 1024 | floor)) MB
      🔧 Åtgärd: \(.action)"'

# Visa fel om det finns några
FAILED_COUNT=$(echo "$RESULTS" | jq -r '.failed')
if [ "$FAILED_COUNT" -gt 0 ]; then
  echo ""
  echo -e "${RED}❌ Misslyckade (${FAILED_COUNT}):${NC}"
  echo "$RESULTS" | jq -r '.details[] | select(.success == false) | "   ❌ \(.customer) (\(.email)): \(.error)"'
fi

echo ""
echo -e "${BLUE}📋 Sammanfattning:${NC}"
echo "$BATCH_RESPONSE" | jq -r '.summary'

# Steg 4: Verifiera resultat
echo ""
echo "🔍 Steg 4: Verifierar resultat..."

FINAL_STATUS=$(curl -s -X GET "$BASE_URL/api/admin/batch-prebuilt-zip" \
  -H "x-admin-password: $ADMIN_PASSWORD")

echo "$FINAL_STATUS" | jq -r '.summary | "📈 Slutstatus:
   - Kunder med ZIP: \(.customersWithZip)
   - Kunder som fortfarande behöver ZIP: \(.customersNeedingZip)"'

echo ""
echo -e "${GREEN}✅ Script slutfört: $(date)${NC}"

# Test för Marc specifikt
echo ""
echo "🎯 Test för Marc Zorjan:"

MARC_ID="eeda2d3b-0ed6-4e21-b307-7b41da72c401"
MARC_STATUS=$(echo "$FINAL_STATUS" | jq -r --arg marc_id "$MARC_ID" '.customers[] | select(.id == $marc_id)')

if [ -n "$MARC_STATUS" ]; then
  echo "$MARC_STATUS" | jq -r '"   📧 Email: \(.email)
   📁 Har filer: \(.hasFiles)
   📦 Har ZIP: \(.hasZip) 
   ⏰ Behöver ZIP: \(.needsZip)"'
  
  if echo "$MARC_STATUS" | jq -r '.hasZip' | grep -q "true"; then
    echo -e "${GREEN}   ✅ Marc har nu en färdig ZIP-fil!${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Marc behöver fortfarande en ZIP-fil${NC}"
  fi
else
  echo -e "${YELLOW}   ⚠️  Marc hittades inte i kundlistan${NC}"
fi

echo ""
echo "🎊 Klart! Alla kunder kan nu använda snabbnedladdning för 'Ladda ner alla'"
