#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_VARS_FILE="${SCRIPT_DIR}/.dev.vars"
TARGET_ENV=""

usage() {
  cat <<'EOF'
Uso:
  bash ./upload-dev-secrets.sh [--env <ambiente>] [--file <arquivo>]

Exemplos:
  bash ./upload-dev-secrets.sh
  bash ./upload-dev-secrets.sh --env dev
  bash ./upload-dev-secrets.sh --env production --file .dev.vars
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--env)
      [[ $# -lt 2 ]] && { echo "Erro: faltou valor para $1."; usage; exit 1; }
      TARGET_ENV="$2"
      shift 2
      ;;
    -f|--file)
      [[ $# -lt 2 ]] && { echo "Erro: faltou valor para $1."; usage; exit 1; }
      DEV_VARS_FILE="$2"
      if [[ "${DEV_VARS_FILE}" != /* ]]; then
        DEV_VARS_FILE="${SCRIPT_DIR}/${DEV_VARS_FILE}"
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Erro: argumento desconhecido: $1"
      usage
      exit 1
      ;;
  esac
done

if ! command -v wrangler >/dev/null 2>&1; then
  echo "Erro: wrangler nao encontrado no PATH."
  exit 1
fi

if [[ ! -f "${DEV_VARS_FILE}" ]]; then
  echo "Erro: arquivo de variaveis nao encontrado em ${DEV_VARS_FILE}."
  exit 1
fi

is_non_secret_key() {
  case "$1" in
    PUBLIC_*) return 0 ;;
    AWS_REGION|AWS_ACCOUNT_ID|USER_POOL_NAME|CALLBACK_URLS|LOGOUT_URLS) return 0 ;;
    GOOGLE_CLIENT_ID|MICROSOFT_CLIENT_ID|MICROSOFT_TENANT_ID|SLACK_CLIENT_ID|FACEBOOK_LOGIN_APP_ID) return 0 ;;
    DATABASE_URL|WEBSOCKET_WORKER_URL) return 0 ;;
    WHATSAPP_PHONE_NUMBER_ID|WHATSAPP_INVITE_TEMPLATE_NAME|WHATSAPP_INVITE_TEMPLATE_LANG|WHATSAPP_API_VERSION|WHATSAPP_SITE_BASE_URL|WHATSAPP_DEFAULT_COUNTRY_CODE) return 0 ;;
    SES_FROM_EMAIL|SES_FROM_NAME) return 0 ;;
  esac

  return 1
}

trim_quotes() {
  local value="$1"
  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "${value}"
}

uploaded=0
skipped=0
env_flag=()
if [[ -n "${TARGET_ENV}" ]]; then
  env_flag=(--env "${TARGET_ENV}")
fi

while IFS= read -r raw_line || [[ -n "${raw_line}" ]]; do
  line="${raw_line#"${raw_line%%[![:space:]]*}"}"

  [[ -z "${line}" ]] && continue
  [[ "${line}" == \#* ]] && continue
  [[ "${line}" != *=* ]] && continue

  key="${line%%=*}"
  value="${line#*=}"

  key="${key%"${key##*[![:space:]]}"}"
  value="${value#"${value%%[![:space:]]*}"}"

  [[ -z "${key}" ]] && continue
  [[ -z "${value}" ]] && continue

  if is_non_secret_key "${key}"; then
    skipped=$((skipped + 1))
    continue
  fi

  value="$(trim_quotes "${value}")"

  if [[ -n "${TARGET_ENV}" ]]; then
    echo "-> enviando segredo: ${key} (env: ${TARGET_ENV})"
  else
    echo "-> enviando segredo: ${key} (env: default)"
  fi
  printf '%s' "${value}" | wrangler secret put "${key}" "${env_flag[@]}"
  uploaded=$((uploaded + 1))
done < "${DEV_VARS_FILE}"

echo
echo "Concluido. Segredos enviados: ${uploaded}. Variaveis ignoradas: ${skipped}."
