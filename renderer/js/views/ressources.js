import { call }      from '../api.js';
import { state }     from '../state.js';
import { showToast, escapeHtml, formatDate } from '../utils.js';

// ─── Modal ressources d'un travail ────────────────────────────────────────────

export async function openRessourcesModal(travail) {
  state.currentTravailId = travail.id;

  document.getElementById('modal-ressources-title').textContent = travail.title;
  await renderRessources(travail.id);

  const isTeacher = state.currentUser?.type === 'teacher';
  const addZone   = document.getElementById('ressources-add-zone');
  if (addZone) addZone.style.display = isTeacher ? '' : 'none';

  document.getElementById('modal-ressources-overlay').classList.remove('hidden');
}

async function renderRessources(travailId) {
  const list = document.getElementById('ressources-list');
  const items = await call(window.api.getRessources, travailId);
  if (!items) return;

  list.innerHTML = '';

  if (!items.length) {
    list.innerHTML = '<div class="ressources-empty">Aucune ressource pour ce travail.</div>';
    return;
  }

  const isTeacher = state.currentUser?.type === 'teacher';

  for (const r of items) {
    const item = document.createElement('div');
    item.className = 'ressource-item';

    const icon = r.type === 'link' ? linkIcon() : fileIcon();

    item.innerHTML = `
      ${icon}
      <div class="ressource-info">
        <span class="ressource-name">${escapeHtml(r.name)}</span>
        <span class="ressource-meta">${r.type === 'link' ? 'Lien' : 'Fichier'} &middot; ${formatDate(r.created_at)}</span>
      </div>
      <div class="ressource-actions">
        <button class="btn-ghost ressource-btn-open" data-type="${r.type}" data-val="${escapeHtml(r.path_or_url)}">Ouvrir</button>
        ${isTeacher ? `<button class="btn-ghost ressource-btn-delete" data-id="${r.id}" title="Supprimer">&#10005;</button>` : ''}
      </div>
    `;

    item.querySelector('.ressource-btn-open').addEventListener('click', () => openRessource(r));

    if (isTeacher) {
      item.querySelector('.ressource-btn-delete').addEventListener('click', async () => {
        const ok = await call(window.api.deleteRessource, r.id);
        if (ok === null) return;
        showToast('Ressource supprimee.', 'success');
        await renderRessources(travailId);
      });
    }

    list.appendChild(item);
  }
}

async function openRessource(r) {
  if (r.type === 'link') {
    await call(window.api.openExternal, r.path_or_url);
  } else {
    await call(window.api.openPath, r.path_or_url);
  }
}

// ─── Formulaire d'ajout (professeur) ─────────────────────────────────────────

export function bindRessourcesModal() {
  const overlay = document.getElementById('modal-ressources-overlay');

  document.getElementById('modal-ressources-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  // Switcher type ressource
  const radios = overlay.querySelectorAll('input[name="ressource-type"]');
  radios.forEach(r => r.addEventListener('change', updateAddZoneFields));
  updateAddZoneFields();

  // Bouton "Ajouter un fichier"
  document.getElementById('btn-ressource-add-file').addEventListener('click', async () => {
    const result = await call(window.api.openFileDialog);
    if (!result) return;
    document.getElementById('ressource-path-input').value = result;
    document.getElementById('ressource-name-input').value =
      document.getElementById('ressource-name-input').value ||
      result.split(/[\\/]/).pop();
  });

  // Submit
  document.getElementById('form-add-ressource').addEventListener('submit', async e => {
    e.preventDefault();
    const name      = document.getElementById('ressource-name-input').value.trim();
    const type      = overlay.querySelector('input[name="ressource-type"]:checked').value;
    const pathOrUrl = type === 'link'
      ? document.getElementById('ressource-link-input').value.trim()
      : document.getElementById('ressource-path-input').value.trim();

    if (!name || !pathOrUrl) return;

    const ok = await call(window.api.addRessource, {
      travailId: state.currentTravailId,
      type,
      name,
      pathOrUrl,
    });
    if (ok === null) return;

    showToast('Ressource ajoutee.', 'success');
    document.getElementById('form-add-ressource').reset();
    updateAddZoneFields();
    await renderRessources(state.currentTravailId);
  });
}

function updateAddZoneFields() {
  const overlay  = document.getElementById('modal-ressources-overlay');
  if (!overlay) return;
  const type = overlay.querySelector('input[name="ressource-type"]:checked')?.value ?? 'link';
  document.getElementById('ressource-field-link').style.display = type === 'link' ? '' : 'none';
  document.getElementById('ressource-field-file').style.display = type === 'file' ? '' : 'none';
}

// ─── Affichage inline dans la vue etudiant ────────────────────────────────────

export async function renderRessourcesInline(travailId, container) {
  const items = await call(window.api.getRessources, travailId);
  if (!items || !items.length) return;

  const section = document.createElement('div');
  section.className = 'ressources-inline';

  const title = document.createElement('div');
  title.className   = 'ressources-inline-title';
  title.textContent = 'Ressources';
  section.appendChild(title);

  for (const r of items) {
    const btn = document.createElement('button');
    btn.className = 'ressource-inline-btn';
    btn.innerHTML = `${r.type === 'link' ? linkIcon() : fileIcon()} <span>${escapeHtml(r.name)}</span>`;
    btn.addEventListener('click', () => openRessource(r));
    section.appendChild(btn);
  }

  container.appendChild(section);
}

// ─── Icones SVG ───────────────────────────────────────────────────────────────

function linkIcon() {
  return `<svg class="ressource-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07L11 5.93"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07L13 18.07"/>
  </svg>`;
}

function fileIcon() {
  return `<svg class="ressource-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>`;
}
