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

// ─── Mode de dépôt par travail ────────────────────────────────────────────
// Persiste entre les re-renders pour ne pas reset le toggle au refresh
const _depotMode = new Map(); // travailId -> 'file' | 'link'

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

// ─── Soumission d'un lien (GitHub, Figma, Vercel…) ───────────────────────────

export async function soumettreLien(travail, linkUrl, deployUrl, onSuccess = null) {
  const ok = await call(window.api.addDepot, {
    travailId: travail.id,
    studentId: state.currentUser.id,
    linkUrl,
    deployUrl: deployUrl || null,
  });
  if (ok === null) return;

  showToast('Lien soumis !', 'success');
  document.dispatchEvent(new CustomEvent('depot:success'));

  if (onSuccess) {
    await onSuccess();
  } else {
    await renderStudentDashboard(document.getElementById('student-travaux-container'));
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

  // ── Distribution des notes + ponctualité ──────────────────────────────────
  const gradedTravaux = sorted.filter(t => t.depot_id != null && t.note != null && t.type !== 'jalon');
  if (gradedTravaux.length) {
    const gradeCounts = { A: 0, B: 0, C: 0, D: 0 };
    for (const t of gradedTravaux) {
      const n = String(t.note).toUpperCase();
      if (n in gradeCounts) gradeCounts[n]++;
    }

    const onTimeCount = sorted.filter(t =>
      t.depot_id != null && t.type !== 'jalon' && t.submitted_at && t.deadline &&
      t.submitted_at <= t.deadline
    ).length;
    const submittedCount = sorted.filter(t => t.depot_id != null && t.type !== 'jalon').length;
    const punctualityPct = submittedCount > 0 ? Math.round((onTimeCount / submittedCount) * 100) : null;

    const gradeEl = document.createElement('div');
    gradeEl.className = 'std-grade-distribution';
    gradeEl.innerHTML = `
      <span class="std-grade-dist-label">Notes :</span>
      <span class="std-grade-pill std-grade-a">A <strong>${gradeCounts.A}</strong></span>
      <span class="std-grade-pill std-grade-b">B <strong>${gradeCounts.B}</strong></span>
      <span class="std-grade-pill std-grade-c">C <strong>${gradeCounts.C}</strong></span>
      <span class="std-grade-pill std-grade-d">D <strong>${gradeCounts.D}</strong></span>
      ${punctualityPct !== null ? `<span class="std-punctuality">⏱ ${punctualityPct}% dans les délais</span>` : ''}
    `;
    container.appendChild(gradeEl);
  }

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

  const refresh = async () => {
    if (container) await renderStudentDashboard(container);
  };

  // ── Toggle Fichier / Lien ─────────────────────────────────────────────────
  const mode = _depotMode.get(t.id) ?? 'file';

  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'depot-type-toggle';
  toggleWrap.innerHTML = `
    <button class="depot-toggle-btn${mode === 'file' ? ' active' : ''}" data-mode="file">
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
      Fichier local
    </button>
    <button class="depot-toggle-btn${mode === 'link' ? ' active' : ''}" data-mode="link">
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
      Lien web
    </button>
  `;

  // ── Zone Fichier ──────────────────────────────────────────────────────────
  const dropZone = document.createElement('div');
  dropZone.className = `std-drop-zone${isLate ? ' std-drop-zone-late' : ''}${mode === 'link' ? ' hidden' : ''}`;
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

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('std-drop-active'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('std-drop-active'));
  dropZone.addEventListener('drop', async e => {
    e.preventDefault();
    dropZone.classList.remove('std-drop-active');
    const file = e.dataTransfer.files[0];
    if (file) await deposerFichier(t, refresh, file.path);
  });
  dropZone.querySelector('.std-btn-deposer').addEventListener('click', e => {
    e.stopPropagation();
    deposerFichier(t, refresh);
  });
  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter') dropZone.querySelector('.std-btn-deposer').click();
  });

  // ── Formulaire Lien ───────────────────────────────────────────────────────
  const linkForm = document.createElement('div');
  linkForm.className = `depot-link-form${mode === 'file' ? ' hidden' : ''}`;
  linkForm.innerHTML = `
    <div class="depot-link-field">
      <label class="depot-link-label">
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
        Code source <span class="depot-link-required">*</span>
      </label>
      <input class="depot-link-input" id="link-main-${t.id}" type="url"
        placeholder="https://github.com/votre-repo  |  https://www.figma.com/…"
        autocomplete="off" spellcheck="false">
    </div>
    <div class="depot-link-field">
      <label class="depot-link-label">
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        Version en ligne <span class="depot-link-optional">(optionnel)</span>
      </label>
      <input class="depot-link-input" id="link-deploy-${t.id}" type="url"
        placeholder="https://mon-projet.vercel.app  |  https://netlify.app/…"
        autocomplete="off" spellcheck="false">
    </div>
    <button class="btn-primary depot-link-submit${isLate ? ' std-btn-late' : ''}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
      ${isLate ? 'Soumettre (en retard)' : 'Soumettre le lien'}
    </button>
    <p class="depot-link-error hidden" id="link-err-${t.id}">Veuillez saisir l'URL du code source.</p>
  `;

  linkForm.querySelector('.depot-link-submit').addEventListener('click', async () => {
    const mainUrl   = linkForm.querySelector(`#link-main-${t.id}`).value.trim();
    const deployUrl = linkForm.querySelector(`#link-deploy-${t.id}`).value.trim();
    const errEl     = linkForm.querySelector(`#link-err-${t.id}`);
    if (!mainUrl) { errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    await soumettreLien(t, mainUrl, deployUrl || null, refresh);
  });

  // ── Branchement du toggle ─────────────────────────────────────────────────
  toggleWrap.addEventListener('click', e => {
    const btn = e.target.closest('.depot-toggle-btn');
    if (!btn) return;
    const newMode = btn.dataset.mode;
    if (_depotMode.get(t.id) === newMode) return;
    _depotMode.set(t.id, newMode);
    toggleWrap.querySelectorAll('.depot-toggle-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === newMode)
    );
    dropZone.classList.toggle('hidden', newMode === 'link');
    linkForm.classList.toggle('hidden', newMode === 'file');
  });

  card.appendChild(toggleWrap);
  card.appendChild(dropZone);
  card.appendChild(linkForm);
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
      ${t.link_url
        ? _buildLinkPills(t.link_url, t.deploy_url)
        : `<span class="std-file-icon">📄</span>
           <span class="std-file-name" title="${escapeHtml(t.file_name)}">${escapeHtml(t.file_name)}</span>`
      }
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

function _buildLinkPills(linkUrl, deployUrl) {
  const pills = [];
  if (linkUrl) {
    const host = (() => { try { return new URL(linkUrl).hostname.replace('www.',''); } catch { return 'Code'; } })();
    pills.push(`<a class="link-pill-btn link-pill-repo" href="${escapeHtml(linkUrl)}" target="_blank" title="${escapeHtml(linkUrl)}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
      ${escapeHtml(host)}
    </a>`);
  }
  if (deployUrl) {
    const host2 = (() => { try { return new URL(deployUrl).hostname.replace('www.',''); } catch { return 'Démo'; } })();
    pills.push(`<a class="link-pill-btn link-pill-deploy" href="${escapeHtml(deployUrl)}" target="_blank" title="${escapeHtml(deployUrl)}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      ${escapeHtml(host2)}
    </a>`);
  }
  return `<div class="link-pills-wrap">${pills.join('')}</div>`;
}

function _renderRenduInfo(t) {
  return `
    <div class="stc-rendu-info">
      ${t.link_url
        ? _buildLinkPills(t.link_url, t.deploy_url)
        : `<span class="stc-file-name" title="${escapeHtml(t.file_name)}">${escapeHtml(t.file_name)}</span>`
      }
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
