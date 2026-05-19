#!/usr/bin/env bash
# Template de produção: feliz_natal_grupo_criado (pt_BR)
# Mesmo payload enviado pelo app em src/shared/utils/whatsapp-cloud.ts
#
# Uso:
#   export WHATSAPP_ACCESS_TOKEN="seu_token"
#   bash scripts/whatsapp-invite-production.curl.sh
#
# Ou cole o curl abaixo no Postman (substitua YOUR_ACCESS_TOKEN e o telefone).

set -euo pipefail

: "${WHATSAPP_ACCESS_TOKEN:?Defina WHATSAPP_ACCESS_TOKEN}"

PHONE_NUMBER_ID="${WHATSAPP_PHONE_NUMBER_ID:-1040071675863592}"
API_VERSION="${WHATSAPP_API_VERSION:-v25.0}"
TO="${WHATSAPP_TEST_TO:-5511998726545}"
GROUP_TITLE="${WHATSAPP_TEST_GROUP_TITLE:-Amigo Secreto da Família}"
GROUP_OWNER="${WHATSAPP_TEST_GROUP_OWNER:-Maria Silva}"
HEADER_IMAGE_URL="${WHATSAPP_HEADER_IMAGE_URL:-https://feliz.natal.br/og-image-whatsapp.jpg}"

curl --request POST \
  --url "https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages" \
  --header "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}" \
  --header 'Content-Type: application/json' \
  --data @- <<EOF
{
  "messaging_product": "whatsapp",
  "to": "${TO}",
  "type": "template",
  "template": {
    "name": "feliz_natal_grupo_criado",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": { "link": "${HEADER_IMAGE_URL}" }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "parameter_name": "nome_do_grupo",
            "text": "${GROUP_TITLE}"
          },
          {
            "type": "text",
            "parameter_name": "dono_do_grupo",
            "text": "${GROUP_OWNER}"
          }
        ]
      }
    ]
  }
}
EOF
