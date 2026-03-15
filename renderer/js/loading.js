// ─── Squelettes de chargement ────────────────────────────────────────────────
// Insere un placeholder anime dans un conteneur avant le chargement asynchrone.
// Le vrai rendu remplace naturellement le squelette via innerHTML / appendChild.

function _msgRow() {
  return `
    <div class="skel-msg-row">
      <div class="skel skel-avatar"></div>
      <div class="skel-msg-body">
        <div class="skel skel-line skel-w30"></div>
        <div class="skel skel-line skel-w90"></div>
        <div class="skel skel-line skel-w70"></div>
      </div>
    </div>`;
}

function _sidebarRow() {
  return `
    <div class="skel-list-row">
      <div class="skel skel-avatar skel-avatar-sm"></div>
      <div class="skel skel-line skel-w70"></div>
    </div>`;
}

const TEMPLATES = {
  messages: () => Array.from({ length: 5 }, _msgRow).join(''),
  sidebar:  () => `
    <div class="skel-zone">
      <div class="skel skel-line skel-w50" style="margin-bottom:8px"></div>
      ${Array.from({ length: 4 }, _sidebarRow).join('')}
    </div>
    <div class="skel-zone" style="margin-top:16px">
      <div class="skel skel-line skel-w50" style="margin-bottom:8px"></div>
      ${Array.from({ length: 3 }, _sidebarRow).join('')}
    </div>`,
};

/**
 * Affiche un squelette de chargement dans le conteneur indiqué.
 * @param {string} containerId  — id du conteneur DOM cible
 * @param {'messages'|'sidebar'} type — gabarit à utiliser
 */
export function showSkeleton(containerId, type) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const html = TEMPLATES[type]?.();
  if (html) el.innerHTML = html;
}
