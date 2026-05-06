#!/bin/bash
# ─── Configuration SMTP du serveur Cursus ─────────────────────────────────
# Usage: sudo bash configure-smtp.sh
#
# Met a jour /opt/cursus/.env avec les credentials SMTP demandes
# interactivement, sauvegarde l'ancien .env (.env.bak.YYYYMMDD-HHMMSS),
# puis force-recreate le conteneur Docker pour appliquer.
#
# Idempotent : si une variable existe deja, elle est mise a jour ; sinon
# ajoutee. Les autres variables du .env ne sont pas touchees.
#
# Prerequis sur le VPS : docker compose, /opt/cursus/.env existant.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cursus}"
ENV_FILE="$APP_DIR/.env"
BACKUP_FILE="$APP_DIR/.env.bak.$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERREUR : $ENV_FILE introuvable. Verifie APP_DIR ou cree d'abord le .env initial." >&2
  exit 1
fi

echo "─── Configuration SMTP de Cursus ───"
echo "Fichier cible : $ENV_FILE"
echo

read -rp "SMTP_HOST       (ex. smtp.hostinger.com) : " SMTP_HOST
read -rp "SMTP_PORT       (defaut 465 pour SSL)    : " SMTP_PORT
SMTP_PORT="${SMTP_PORT:-465}"
read -rp "SMTP_USER       (ex. noreply@plateforme-ets.fr) : " SMTP_USER
read -rsp "SMTP_PASS      (mot de passe, masque)   : " SMTP_PASS
echo
read -rp "SMTP_FROM       (ex. Cursus <noreply@plateforme-ets.fr>) : " SMTP_FROM
read -rp "SERVER_URL      (defaut https://app.cursus.school)        : " SERVER_URL
SERVER_URL="${SERVER_URL:-https://app.cursus.school}"

# Verification basique : meme domaine entre SMTP_USER et SMTP_FROM
USER_DOMAIN="${SMTP_USER##*@}"
FROM_ADDR=$(echo "$SMTP_FROM" | grep -oP '<\K[^>]+' || echo "$SMTP_FROM")
FROM_DOMAIN="${FROM_ADDR##*@}"
if [ -n "$USER_DOMAIN" ] && [ -n "$FROM_DOMAIN" ] && [ "$USER_DOMAIN" != "$FROM_DOMAIN" ]; then
  echo
  echo "AVERTISSEMENT : SMTP_USER ($USER_DOMAIN) et SMTP_FROM ($FROM_DOMAIN)"
  echo "ont des domaines differents. Les mails risquent d'etre rejetes pour"
  echo "mismatch SPF/DMARC chez les receveurs (Gmail, Outlook)."
  read -rp "Continuer quand meme ? [y/N] " CONFIRM
  if [ "${CONFIRM,,}" != "y" ]; then
    echo "Abandon."
    exit 1
  fi
fi

# Backup
cp "$ENV_FILE" "$BACKUP_FILE"
echo
echo "Backup ecrit : $BACKUP_FILE"

# Helper : set ou update une var dans le .env
# - Si la cle existe -> remplace la ligne (sans toucher aux commentaires
#   alentours).
# - Sinon -> append a la fin.
set_var() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # Echappe les caracteres speciaux pour sed
    local escaped
    escaped=$(printf '%s\n' "$value" | sed -e 's/[\/&]/\\&/g')
    sed -i.tmp "s/^${key}=.*/${key}=${escaped}/" "$ENV_FILE"
    rm -f "${ENV_FILE}.tmp"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

set_var SMTP_HOST   "$SMTP_HOST"
set_var SMTP_PORT   "$SMTP_PORT"
set_var SMTP_USER   "$SMTP_USER"
set_var SMTP_PASS   "$SMTP_PASS"
set_var SMTP_FROM   "$SMTP_FROM"
set_var SERVER_URL  "$SERVER_URL"

# Permissions strictes : le .env contient SMTP_PASS en clair.
chmod 600 "$ENV_FILE"

echo "Variables ecrites dans $ENV_FILE."
echo

# Test rapide nodemailer.verify AVANT de recreer le conteneur — evite de
# couper le service si la config est mauvaise. On execute le test DANS
# le conteneur cursus-server qui tourne deja (a deja nodemailer dans
# node_modules, donc pas de npm install dans un conteneur jetable qui
# faillait souvent par manque de reseau/registry).
echo "Test de connexion SMTP..."
if ! docker ps --format '{{.Names}}' | grep -q '^cursus-server$'; then
  echo "Le conteneur cursus-server n'est pas demarre — on saute le test pre-deploy."
  echo "Verifie l'etat SMTP depuis l'app (Sidebar RDV → chip Email) apres restart."
  SKIP_TEST=1
else
  SKIP_TEST=0
fi

if [ "$SKIP_TEST" = "0" ]; then
  # docker exec -e injecte les NOUVELLES vars sans toucher au container env
  # courant. Le test utilise donc bien la config qu'on s'apprete a appliquer.
  TEST_OUTPUT=$(docker exec \
    -e SMTP_HOST="$SMTP_HOST" \
    -e SMTP_PORT="$SMTP_PORT" \
    -e SMTP_USER="$SMTP_USER" \
    -e SMTP_PASS="$SMTP_PASS" \
    cursus-server node -e "
const t = require('nodemailer').createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
});
t.verify().then(() => { console.log('SMTP_OK'); process.exit(0); })
.catch(e => { console.log('SMTP_FAIL:' + (e.code ? '[' + e.code + '] ' : '') + e.message); process.exit(1); });
" 2>&1) || TEST_FAILED=1

  echo "$TEST_OUTPUT"

  if [ "${TEST_FAILED:-0}" = "1" ]; then
    echo
    echo "─── Diagnostic ───"
    case "$TEST_OUTPUT" in
      *EAUTH*|*Invalid\ login*|*535*)
        echo "Auth refusee — verifie SMTP_USER + SMTP_PASS chez ton provider."
        ;;
      *ETIMEDOUT*|*timeout*)
        echo "Timeout — port bloque par le firewall sortant ? Essaie SMTP_PORT=587 (STARTTLS) au lieu de 465 (SSL)."
        ;;
      *ECONNREFUSED*)
        echo "Connexion refusee — verifie SMTP_HOST + SMTP_PORT."
        ;;
      *ENOTFOUND*|*EAI_AGAIN*)
        echo "DNS impossible — verifie SMTP_HOST (typo ?)."
        ;;
      *self-signed*|*unable\ to\ verify*)
        echo "Probleme certificat TLS — Hostinger/Porkbun normalement OK, peut etre un proxy/MITM ?"
        ;;
    esac
    echo
    echo "Le .env a ete sauvegarde mais NON applique."
    echo "Restauration du backup : cp $BACKUP_FILE $ENV_FILE"
    cp "$BACKUP_FILE" "$ENV_FILE"
    exit 1
  fi
fi

echo
echo "Recreate du conteneur cursus-server..."
cd "$APP_DIR"

# Si le runtime compose ne liste pas SMTP_X dans environment:, on ajoute
# les lignes manquantes en place — sans toucher au reste (preserve
# image:/build: et toutes les autres options du compose runtime, qui
# differe du repo selon le mode deploy : repo = build local, runtime
# = image GHCR).
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
if [ -f "$COMPOSE_FILE" ] && ! grep -qE '^\s*-\s*SMTP_HOST=' "$COMPOSE_FILE" 2>/dev/null; then
  echo "Patch de $COMPOSE_FILE : ajout des vars SMTP/SERVER_URL dans environment:"
  cp "$COMPOSE_FILE" "$COMPOSE_FILE.bak.$(date +%Y%m%d-%H%M%S)"

  # Insere les vars apres le bloc environment: existant. On detecte la
  # derniere ligne `      - QUELQUECHOSE=...` qui suit `environment:` et
  # on ajoute apres. Implementation awk : machine a etat 2 phases.
  awk '
    BEGIN { in_env = 0; injected = 0 }
    /^[[:space:]]*environment:[[:space:]]*$/ { print; in_env = 1; next }
    in_env && injected == 0 && /^[[:space:]]*-[[:space:]]/ { print; last_env_line = NR; next }
    in_env && injected == 0 && !/^[[:space:]]*-[[:space:]]/ {
      # Premiere ligne hors du bloc env: -> on injecte juste avant.
      print "      # SMTP + URL publique (ajoute par configure-smtp.sh)"
      print "      - SERVER_URL=${SERVER_URL:-https://app.cursus.school}"
      print "      - SMTP_HOST=${SMTP_HOST:-}"
      print "      - SMTP_PORT=${SMTP_PORT:-587}"
      print "      - SMTP_USER=${SMTP_USER:-}"
      print "      - SMTP_PASS=${SMTP_PASS:-}"
      print "      - SMTP_FROM=${SMTP_FROM:-}"
      injected = 1
      in_env = 0
    }
    { print }
    END {
      # Cas defensif : si la section etait au tout-bas du fichier sans
      # autre cle apres, on append a la fin.
      if (in_env == 1 && injected == 0) {
        print "      # SMTP + URL publique (ajoute par configure-smtp.sh)"
        print "      - SERVER_URL=${SERVER_URL:-https://app.cursus.school}"
        print "      - SMTP_HOST=${SMTP_HOST:-}"
        print "      - SMTP_PORT=${SMTP_PORT:-587}"
        print "      - SMTP_USER=${SMTP_USER:-}"
        print "      - SMTP_PASS=${SMTP_PASS:-}"
        print "      - SMTP_FROM=${SMTP_FROM:-}"
      }
    }
  ' "$COMPOSE_FILE" > "$COMPOSE_FILE.new"

  if [ -s "$COMPOSE_FILE.new" ]; then
    mv "$COMPOSE_FILE.new" "$COMPOSE_FILE"
    echo "OK — runtime compose patche."
  else
    echo "ECHEC du patch awk — restauration du backup."
    rm -f "$COMPOSE_FILE.new"
    exit 1
  fi
fi

docker compose up -d --force-recreate

echo
echo "✔ Configuration appliquee. Verifie l'etat :"
echo "  docker compose ps"
echo "  curl -s http://localhost:3001/health"
echo
echo "Et depuis Cursus (Sidebar RDV → chip Email) tu peux envoyer un test."
