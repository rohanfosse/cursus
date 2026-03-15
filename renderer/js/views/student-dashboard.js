import { call }      from '../api.js';
import { state }     from '../state.js';
import { showToast } from '../utils.js';
import { escapeHtml, formatDate, deadlineClass, deadlineLabel } from '../utils.js';
import { CATEGORIES } from './timeline.js';
import { renderRessourcesInline } from './ressources.js';

// ─── Panel "Mes travaux" (vue etudiant) ───────────────────────────────────────

export async function renderStudentTravaux() {
  const panel = document.getElementById('right-panel');
  state.rightPanel = 'mes-travaux';
  panel.classList.remove('hidden');

  const travaux = await call(window.api.getStudentTravaux, state.currentUser.id);
  if (!travaux) return;

  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">Mes travaux</span>
      <button class="btn-ghost" id="btn-close-mes-travaux">Fermer</button>
    </div>
    <div class="panel-body" id="mes-travaux-body"></div>
  `;

  document.getElementById('btn-close-mes-travaux').addEventListener('click', () => {
    state.rightPanel = null;
    panel.classList.add('hidden');
  });

  const body = document.getElementById('mes-travaux-body');

  if (!travaux.length) {
    body.innerHTML = '<div class="empty-state"><p>Aucun travail pour le moment.</p></div>';
    return;
  }

  // Separer : a rendre vs rendus
  const aRendre = travaux.filter(t => t.depot_id == null);
  const rendus  = travaux.filter(t => t.depot_id != null);

  if (aRendre.length) {
    body.appendChild(sectionTitle('A rendre'));
    for (const t of aRendre) body.appendChild(makeTravailCard(t));
  }

  if (rendus.length) {
    body.appendChild(sectionTitle('Rendus'));
    for (const t of rendus) body.appendChild(makeTravailCard(t));
  }
}

function sectionTitle(text) {
  const el = document.createElement('div');
  el.className   = 'panel-section-title';
  el.textContent = text;
  return el;
}

function makeTravailCard(t) {
  const rendu = t.depot_id != null;
  const card  = document.createElement('div');
  card.className = `student-travail-card ${rendu ? 'rendu' : ''}`;

  const dlClass = deadlineClass(t.deadline);
  const dlLabel = deadlineLabel(t.deadline);

  const catColor = CATEGORIES[t.category]?.color ?? '#888';

  card.innerHTML = `
    <div class="stc-header">
      <span class="stc-title">${escapeHtml(t.title)}</span>
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category ?? 'TP')}</span>
      ${!rendu ? `<span class="deadline-badge ${dlClass}">${dlLabel}</span>` : ''}
    </div>
    <div class="stc-meta">
      #${escapeHtml(t.channel_name)}
      ${t.group_name ? ` &middot; <span class="group-tag">${escapeHtml(t.group_name)}</span>` : ''}
      &middot; limite le ${formatDate(t.deadline)}
    </div>
    ${t.description ? `<div class="stc-description">${escapeHtml(t.description)}</div>` : ''}
    <div class="stc-depot-area" id="depot-area-${t.id}">
      ${rendu ? renderRenduInfo(t) : ''}
    </div>
    <div class="stc-ressources-zone" id="stc-res-${t.id}"></div>
    ${!rendu ? `<button class="btn-primary stc-btn-deposer" data-travail-id="${t.id}">Deposer un fichier</button>` : ''}
  `;

  if (!rendu) {
    card.querySelector('.stc-btn-deposer').addEventListener('click', () => deposerFichier(t));
  }

  // Charger les ressources
  renderRessourcesInline(t.id, card.querySelector(`#stc-res-${t.id}`));

  return card;
}

function renderRenduInfo(t) {
  return `
    <div class="stc-rendu-info">
      <span class="stc-file-name" title="${escapeHtml(t.file_name)}">${escapeHtml(t.file_name)}</span>
      <span class="stc-submitted-at">Depose le ${formatDate(t.submitted_at)}</span>
      ${t.note != null
        ? `<span class="note-badge">${t.note}/20</span>`
        : '<span class="stc-pending-note">Non note</span>'
      }
    </div>
    ${t.feedback ? `<div class="stc-feedback">${escapeHtml(t.feedback)}</div>` : ''}
  `;
}

async function deposerFichier(travail) {
  const result = await call(window.api.openFileDialog);
  if (!result) return;

  const filePath = result;
  const fileName = filePath.split(/[\\/]/).pop();

  const ok = await call(window.api.addDepot, {
    travailId: travail.id,
    studentId: state.currentUser.id,
    filePath,
    fileName,
  });

  if (ok === null) return;

  showToast(`Fichier depose : ${fileName}`, 'success');
  await renderStudentTravaux();
}
