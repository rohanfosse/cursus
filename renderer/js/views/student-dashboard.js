import { call }      from '../api.js';
import { state }     from '../state.js';
import {
  showToast, showUndoToast, escapeHtml, formatDate,
  formatGrade, gradeClass, deadlineClass, deadlineLabel,
} from '../utils.js';
import { CATEGORIES } from './timeline.js';
import { renderRessourcesInline } from './ressources.js';

// ─── État de l'onglet actif ────────────────────────────────────────────────
let _activeTab = 'todo'; // 'todo' | 'waiting' | 'graded'

// ─── Dépôt de fichier (partagé, exporté) ─────────────────────────────────────

export async function deposerFichier(travail, onSuccess = null, preselectedPath = null) {
  const filePath = preselectedPath ?? await call(window.api.openFileDialog);
  if (!filePath) return;

  const fileName = filePath.split(/[\\/]/).pop();

  // Pattern Undo : 5 secondes pour annuler avant exécution
  const cancelled = await showUndoToast(`Dépôt : ${fileName}`, 5000);
  if (cancelled) {
    showToast('Dépôt annulé.', 'error');
    return;
  }

  const ok = await call(window.api.addDepot, {
    travailId: travail.id,
    studentId: state.currentUser.id,
    filePath,
    fileName,
  });
  if (ok === null) return;

  showToast(`Déposé : ${fileName}`, 'success');
  document.dispatchEvent(new CustomEvent('depot:success'));

  if (onSuccess) {
    await onSuccess();
  } else {
    await renderStudentTravaux();
  }
}

// ─── Dashboard complet (section Travaux étudiant) ─────────────────────────────

export async function renderStudentDashboard(container) {
  if (!container) return;
  container.innerHTML = '<div class="std-loading">Chargement…</div>';

  const user    = state.currentUser;
  const travaux = await call(window.api.getStudentTravaux, user.id);
  if (!travaux) { container.innerHTML = ''; return; }

  const sorted  = [...travaux].sort((a, b) => a.deadline.localeCompare(b.deadline));
  const aRendre = sorted.filter(t => t.depot_id == null && t.type !== 'jalon');
  const jalons  = sorted.filter(t => t.type === 'jalon' && deadlineClass(t.deadline) !== 'deadline-passed');
  const attente = sorted.filter(t => t.depot_id != null && t.note == null);
  const notes   = sorted.filter(t => t.depot_id != null && t.note != null);

  const totalWork = sorted.filter(t => t.type !== 'jalon').length;
  const rendus    = sorted.filter(t => t.depot_id != null && t.type !== 'jalon').length;
  const late      = aRendre.filter(t => deadlineClass(t.deadline) === 'deadline-passed').length;
  const urgent    = aRendre.filter(t => ['deadline-critical', 'deadline-soon'].includes(deadlineClass(t.deadline))).length;

  container.innerHTML = '';

  // ── Barre de stats ────────────────────────────────────────────────────────
  const statsBar = document.createElement('div');
  statsBar.className = 'std-stats-bar';
  statsBar.innerHTML = `
    <div class="std-stat ${late > 0 ? 'std-stat-alert' : (aRendre.length === 0 ? 'std-stat-ok' : '')}">
      <span class="std-stat-num">${aRendre.length}</span>
      <span class="std-stat-label">A rendre</span>
      ${late > 0 ? `<span class="std-stat-sub">${late} en retard</span>` : ''}
    </div>
    <div class="std-stat ${urgent > 0 ? 'std-stat-warn' : ''}">
      <span class="std-stat-num">${urgent}</span>
      <span class="std-stat-label">Urgents (&lt;48h)</span>
    </div>
    <div class="std-stat">
      <span class="std-stat-num">${attente.length}</span>
      <span class="std-stat-label">En correction</span>
    </div>
    <div class="std-stat std-stat-ok">
      <span class="std-stat-num">${notes.length}</span>
      <span class="std-stat-label">Notes</span>
    </div>
  `;
  container.appendChild(statsBar);

  // ── Barre de progression semestrielle ────────────────────────────────────
  if (totalWork > 0) {
    const pct = Math.round((rendus / totalWork) * 100);
    const progressEl = document.createElement('div');
    progressEl.className = 'std-progress-wrap';
    progressEl.innerHTML = `
      <div class="std-progress-label">
        <span>${rendus} rendu${rendus > 1 ? 's' : ''} sur ${totalWork}</span>
        <span class="std-progress-pct">${pct} %</span>
      </div>
      <div class="std-progress-track">
        <div class="std-progress-fill" style="width:${pct}%"></div>
      </div>
    `;
    container.appendChild(progressEl);
  }

  // ── Onglets ──────────────────────────────────────────────────────────────
  const tabsEl = document.createElement('div');
  tabsEl.className = 'std-tabs';
  const tabDefs = [
    { key: 'todo',    label: 'A faire',    count: aRendre.length + jalons.length },
    { key: 'waiting', label: 'En attente', count: attente.length },
    { key: 'graded',  label: 'Notes',      count: notes.length   },
  ];
  for (const td of tabDefs) {
    const btn = document.createElement('button');
    btn.className = `std-tab${_activeTab === td.key ? ' active' : ''}`;
    btn.dataset.tab = td.key;
    btn.tabIndex = 0;
    btn.innerHTML = `${td.label} <span class="std-tab-count">${td.count}</span>`;
    btn.addEventListener('click', () => { _activeTab = td.key; renderStudentDashboard(container); });
    btn.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
    tabsEl.appendChild(btn);
  }
  container.appendChild(tabsEl);

  // ── Contenu de l'onglet actif ─────────────────────────────────────────────
  const sections = document.createElement('div');
  sections.className = 'std-sections';

  if (_activeTab === 'todo') {
    const urgencyOrder = ['deadline-passed', 'deadline-critical', 'deadline-soon', 'deadline-warning', 'deadline-ok'];
    const sorted2 = [...aRendre].sort((a, b) =>
      urgencyOrder.indexOf(deadlineClass(a.deadline)) - urgencyOrder.indexOf(deadlineClass(b.deadline))
    );
    if (!sorted2.length && !jalons.length) {
      sections.appendChild(_buildEmptyState(
        `<svg viewBox="0 0 24 24" fill="currentColor" width="52" height="52"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
        'Génial, vous êtes à jour !',
        'Aucun travail à rendre pour le moment. Profitez-en !'
      ));
    } else {
      if (sorted2.length) _buildSection(sections, 'A rendre', sorted2, t => _buildARendreCard(t, container));
      if (jalons.length)  _buildSection(sections, 'Jalons a venir', jalons, _buildJalonCard);
    }
  } else if (_activeTab === 'waiting') {
    if (!attente.length) {
      sections.appendChild(_buildEmptyState(
        `<svg viewBox="0 0 24 24" fill="currentColor" width="52" height="52"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
        'Aucun rendu en attente',
        'Vos dépôts en cours de correction apparaîtront ici.'
      ));
    } else {
      _buildSection(sections, 'En attente de note', attente, t => _buildAttenteCard(t, container));
    }
  } else if (_activeTab === 'graded') {
    if (!notes.length) {
      sections.appendChild(_buildEmptyState(
        `<svg viewBox="0 0 24 24" fill="currentColor" width="52" height="52"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>`,
        'Pas encore de notes',
        'Vos résultats apparaîtront ici dès que votre professeur les publiera.'
      ));
    } else {
      _buildSection(sections, 'Notes reçues', notes, _buildNoteCard);
    }
  }

  container.appendChild(sections);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _buildEmptyState(svgHtml, title, subtitle) {
  const el = document.createElement('div');
  el.className = 'std-empty-state';
  el.innerHTML = `
    <div class="std-empty-icon">${svgHtml}</div>
    <div class="std-empty-title">${escapeHtml(title)}</div>
    <div class="std-empty-subtitle">${escapeHtml(subtitle)}</div>
  `;
  return el;
}

function _buildSection(parent, title, items, cardFn) {
  const section = document.createElement('div');
  section.className = 'std-section';
  section.innerHTML = `<div class="std-section-title">${title}</div>`;
  const grid = document.createElement('div');
  grid.className = 'std-cards';
  for (const t of items) grid.appendChild(cardFn(t));
  section.appendChild(grid);
  parent.appendChild(section);
}

// ─── Cartes ───────────────────────────────────────────────────────────────────

function _buildARendreCard(t, container) {
  const cls      = deadlineClass(t.deadline);
  const label    = deadlineLabel(t.deadline);
  const catColor = CATEGORIES[t.category]?.color ?? '#888';
  const isLate   = cls === 'deadline-passed';

  const card = document.createElement('div');
  card.className = `std-card std-card-arendre${isLate ? ' std-card-late' : ''}`;
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="std-card-header">
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category)}</span>
      <span class="deadline-badge ${cls}">${label}</span>
    </div>
    <div class="std-card-title">${escapeHtml(t.title)}</div>
    <div class="std-card-meta">#${escapeHtml(t.channel_name)}${t.group_name ? ` &middot; <span class="group-tag">${escapeHtml(t.group_name)}</span>` : ''}</div>
    <div class="std-card-deadline">Limite : <strong>${formatDate(t.deadline)}</strong></div>
    ${t.description ? `<div class="std-card-desc">${escapeHtml(t.description)}</div>` : ''}
    <div class="std-card-res" id="std-res-${t.id}"></div>
  `;

  // ── Zone de dépôt avec Drag & Drop ───────────────────────────────────────
  const dropZone = document.createElement('div');
  dropZone.className = `std-drop-zone${isLate ? ' std-drop-zone-late' : ''}`;
  dropZone.tabIndex = 0;
  dropZone.setAttribute('role', 'button');
  dropZone.setAttribute('aria-label', 'Déposer un fichier');
  dropZone.innerHTML = `
    <svg class="std-drop-icon" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
    </svg>
    <span class="std-drop-label">${isLate ? 'Glisser ou cliquer — dépôt en retard' : 'Glisser un fichier ici ou…'}</span>
    <button class="btn-primary std-btn-deposer${isLate ? ' std-btn-late' : ''}" tabindex="0">
      ${isLate ? 'Déposer (en retard)' : 'Parcourir…'}
    </button>
  `;

  const refresh = async () => {
    if (container) await renderStudentDashboard(container);
  };

  // Drag & Drop
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('std-drop-active'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('std-drop-active'));
  dropZone.addEventListener('drop', async e => {
    e.preventDefault();
    dropZone.classList.remove('std-drop-active');
    const file = e.dataTransfer.files[0];
    if (file) await deposerFichier(t, refresh, file.path);
  });

  // Bouton parcourir
  dropZone.querySelector('.std-btn-deposer').addEventListener('click', e => {
    e.stopPropagation();
    deposerFichier(t, refresh);
  });

  // Accessibilité clavier sur la zone
  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter') dropZone.querySelector('.std-btn-deposer').click();
  });

  card.appendChild(dropZone);
  renderRessourcesInline(t.id, card.querySelector(`#std-res-${t.id}`));
  return card;
}

function _buildJalonCard(t) {
  const cls      = deadlineClass(t.deadline);
  const label    = deadlineLabel(t.deadline);
  const catColor = CATEGORIES[t.category]?.color ?? '#888';

  const card = document.createElement('div');
  card.className = 'std-card std-card-jalon';
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="std-card-header">
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category)}</span>
      <span class="jalon-badge">Jalon</span>
      <span class="deadline-badge ${cls}">${label}</span>
    </div>
    <div class="std-card-title">${escapeHtml(t.title)}</div>
    <div class="std-card-meta">#${escapeHtml(t.channel_name)}</div>
    <div class="std-card-deadline">Le <strong>${formatDate(t.deadline)}</strong></div>
    ${t.description ? `<div class="std-card-desc">${escapeHtml(t.description)}</div>` : ''}
    <div class="std-jalon-info">
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style="flex-shrink:0">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
      </svg>
      Événement : aucun rendu numérique requis. Assurez-vous d'être présent(e).
    </div>
  `;
  return card;
}

function _buildAttenteCard(t, container) {
  const catColor  = CATEGORIES[t.category]?.color ?? '#888';
  const canReplace = deadlineClass(t.deadline) !== 'deadline-passed';

  const card = document.createElement('div');
  card.className = 'std-card std-card-attente';
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="std-card-header">
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category)}</span>
      <span class="timeline-status rendu">Rendu ✓</span>
    </div>
    <div class="std-card-title">${escapeHtml(t.title)}</div>
    <div class="std-card-meta">#${escapeHtml(t.channel_name)}</div>
    <div class="std-card-file">
      <span class="std-file-icon">📄</span>
      <span class="std-file-name" title="${escapeHtml(t.file_name)}">${escapeHtml(t.file_name)}</span>
      <span class="stc-pending-note">En attente de note</span>
    </div>
    <div class="std-card-deadline">Déposé le ${formatDate(t.submitted_at)}</div>
  `;

  if (canReplace) {
    const btn = document.createElement('button');
    btn.className = 'btn-ghost std-btn-replace';
    btn.textContent = '↺ Remplacer le fichier';
    btn.tabIndex = 0;
    btn.addEventListener('click', () => deposerFichier(t, async () => {
      if (container) await renderStudentDashboard(container);
    }));
    btn.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
    card.appendChild(btn);
  }

  return card;
}

function _buildNoteCard(t) {
  const catColor = CATEGORIES[t.category]?.color ?? '#888';
  const gClass   = gradeClass(t.note);
  const gLabel   = formatGrade(t.note);

  const card = document.createElement('div');
  card.className = 'std-card std-card-note';
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="std-card-header">
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category)}</span>
      <span class="note-badge ${gClass}">${gLabel}</span>
    </div>
    <div class="std-card-title">${escapeHtml(t.title)}</div>
    <div class="std-card-meta">#${escapeHtml(t.channel_name)}</div>
    ${t.feedback ? `
      <div class="feedback-callout">
        <div class="feedback-callout-label">💬 Commentaire du professeur</div>
        <div class="feedback-callout-text">"${escapeHtml(t.feedback)}"</div>
      </div>
    ` : ''}
  `;
  return card;
}

// ─── Panel "Mes travaux" (vue compacte — panneau droit) ───────────────────────

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

  const aRendre = travaux.filter(t => t.depot_id == null && t.type !== 'jalon');
  const rendus  = travaux.filter(t => t.depot_id != null);

  if (aRendre.length) {
    body.appendChild(_sectionTitle('A rendre'));
    for (const t of aRendre) body.appendChild(_makePanelCard(t));
  }
  if (rendus.length) {
    body.appendChild(_sectionTitle('Rendus'));
    for (const t of rendus) body.appendChild(_makePanelCard(t));
  }
}

function _sectionTitle(text) {
  const el = document.createElement('div');
  el.className   = 'panel-section-title';
  el.textContent = text;
  return el;
}

function _makePanelCard(t) {
  const rendu    = t.depot_id != null;
  const card     = document.createElement('div');
  card.className = `student-travail-card ${rendu ? 'rendu' : ''}`;
  card.tabIndex  = 0;

  const cls      = deadlineClass(t.deadline);
  const label    = deadlineLabel(t.deadline);
  const catColor = CATEGORIES[t.category]?.color ?? '#888';

  card.innerHTML = `
    <div class="stc-header">
      <span class="stc-title">${escapeHtml(t.title)}</span>
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category ?? 'TP')}</span>
      ${!rendu ? `<span class="deadline-badge ${cls}">${label}</span>` : ''}
    </div>
    <div class="stc-meta">
      #${escapeHtml(t.channel_name)}
      ${t.group_name ? ` &middot; <span class="group-tag">${escapeHtml(t.group_name)}</span>` : ''}
      &middot; limite le ${formatDate(t.deadline)}
    </div>
    ${t.description ? `<div class="stc-description">${escapeHtml(t.description)}</div>` : ''}
    <div class="stc-depot-area" id="depot-area-${t.id}">
      ${rendu ? _renderRenduInfo(t) : ''}
    </div>
    <div class="stc-ressources-zone" id="stc-res-${t.id}"></div>
    ${!rendu ? `<button class="btn-primary stc-btn-deposer" data-travail-id="${t.id}" tabindex="0">Deposer un fichier</button>` : ''}
  `;

  if (!rendu) {
    const btn = card.querySelector('.stc-btn-deposer');
    btn.addEventListener('click', () => deposerFichier(t));
    btn.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
  }

  renderRessourcesInline(t.id, card.querySelector(`#stc-res-${t.id}`));
  return card;
}

function _renderRenduInfo(t) {
  return `
    <div class="stc-rendu-info">
      <span class="stc-file-name" title="${escapeHtml(t.file_name)}">${escapeHtml(t.file_name)}</span>
      <span class="stc-submitted-at">Depose le ${formatDate(t.submitted_at)}</span>
      ${t.note != null
        ? `<span class="note-badge ${gradeClass(t.note)}">${formatGrade(t.note)}</span>`
        : '<span class="stc-pending-note">Non note</span>'
      }
    </div>
    ${t.feedback ? `
      <div class="feedback-callout stc-feedback">
        <div class="feedback-callout-text">"${escapeHtml(t.feedback)}"</div>
      </div>` : ''}
  `;
}
