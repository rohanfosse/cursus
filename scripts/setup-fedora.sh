#!/usr/bin/env bash
# Bootstrap d'un poste de dev Cursus sur Fedora.
# Usage : ./scripts/setup-fedora.sh
# Pré-requis : sudo, connexion réseau. VSCode et Docker sont supposés déjà installés.

set -euo pipefail

log()  { printf '\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }

if [[ "${EUID}" -eq 0 ]]; then
  echo "Ne lance pas ce script en root. Il appellera sudo quand il faut." >&2
  exit 1
fi

# ── 1. Base système & toolchain native ──────────────────────────────────────
log "Installation toolchain de build (gcc, make, python3, git)…"
sudo dnf install -y \
  git curl \
  @development-tools \
  gcc-c++ make python3

# ── 2. Libs runtime Electron ────────────────────────────────────────────────
log "Installation des libs runtime Electron (GTK, NSS, etc.)…"
sudo dnf install -y \
  nss atk at-spi2-atk gtk3 libdrm mesa-libgbm \
  alsa-lib libXScrnSaver libXtst cups-libs libxkbcommon \
  pango cairo

# ── 3. Outils packaging Linux (AppImage + .deb) ─────────────────────────────
# libxcrypt-compat fournit libcrypt.so.1 dont a besoin le Ruby bundlé par fpm
# (electron-builder l'utilise pour générer le .deb). Sans ça : exit code 127.
log "Installation des outils de packaging (dpkg, fakeroot, fuse, libxcrypt-compat)…"
sudo dnf install -y dpkg fakeroot fuse fuse-libs libxcrypt-compat

# ── 4. Dépendances Playwright (tests E2E) ───────────────────────────────────
log "Installation des libs Playwright…"
sudo dnf install -y libicu libwebp enchant2 libsecret

# ── 5. Node 22 via nvm ──────────────────────────────────────────────────────
export NVM_DIR="${HOME}/.nvm"
if [[ ! -s "${NVM_DIR}/nvm.sh" ]]; then
  log "Installation de nvm…"
  curl -fsSL -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
else
  ok "nvm déjà présent."
fi

# shellcheck disable=SC1091
. "${NVM_DIR}/nvm.sh"

log "Installation Node 22 (LTS du CI Cursus)…"
nvm install 22
nvm alias default 22
nvm use 22

ok "Node $(node -v) — npm $(npm -v)"

# ── 6. Bootstrap du projet ──────────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_DIR}"

log "npm install (postinstall reconstruit better-sqlite3 pour Electron)…"
npm install

log "Installation des navigateurs Playwright (sans --with-deps : Fedora pas supporté, libs déjà posées plus haut)…"
npx playwright install || warn "playwright install a échoué — relance-le manuellement plus tard."

ok "Setup terminé. Teste avec : npm run dev"
