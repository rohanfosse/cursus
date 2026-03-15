import { call }      from '../api.js';
import { state }     from '../state.js';
import { showToast } from '../utils.js';
import { deadlineClass, deadlineLabel, formatDate, escapeHtml, isoForDatetimeLocal } from '../utils.js';

let _onOpenDepots = null;
let _onOpenSuivi  = null;

export function initTravaux({ onOpenDepots, onOpenSuivi }) {
  _onOpenDepots = onOpenDepots;
  _onOpenSuivi  = onOpenSuivi;
}

// ─── Panel travaux ────────────────────────────────────────────────────────────

export function openPanel() {
  state.rightPanel = 'travaux';
  const panel = document.getElementById('right-panel');
  panel.innerHTML = buildPanelHTML();
  panel.classList.remove('hidden');
  bindPanelEvents();
  if (state.activeChannelId) renderTravaux();
}

export function closePanel() {
  state.rightPanel = null;
  document.getElementById('right-panel').classList.add('hidden');
}

function buildPanelHTML() {
  return `
    <div class="panel-header">
      <h2>Travaux</h2>
      <button class="btn-ghost" id="btn-close-panel">Fermer</button>
    </div>
    <div class="panel-body" id="panel-body">
      <button class="btn-primary" id="btn-new-travail">Nouveau travail</button>
      <div id="travaux-list"></div>
    </div>
  `;
}

function bindPanelEvents() {
  document.getElementById('btn-close-panel').addEventListener('click', closePanel);
  document.getElementById('btn-new-travail').addEventListener('click', openNewTravailModal);
}

export async function renderTravaux() {
  if (!state.activeChannelId) return;

  const list    = document.getElementById('travaux-list');
  if (!list) return;

  const travaux = await call(window.api.getTravaux, state.activeChannelId);
  if (!travaux) return;

  list.innerHTML = '';

  if (!travaux.length) {
    list.innerHTML = `<div class="empty-state"><p>Aucun travail pour ce canal.</p></div>`;
    return;
  }

  for (const t of travaux) {
    const cls   = deadlineClass(t.deadline);
    const label = deadlineLabel(t.deadline);
    const count = t.depots_count   ?? 0;
    const total = t.students_total ?? 0;
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'travail-card';
    card.innerHTML = `
      <div class="travail-title">${escapeHtml(t.title)}</div>
      <div class="travail-desc">${escapeHtml(t.description ?? '')}</div>
      <div class="travail-footer">
        <span class="deadline-badge ${cls}">${label} — ${formatDate(t.deadline)}</span>
        <span class="depots-progress"><strong>${count}/${total}</strong> rendus</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
    `;

    // Clic gauche : ouvrir les depots
    card.addEventListener('click', () => _onOpenDepots?.(t));

    // Bouton suivi au survol (injecte en JS pour eviter la collision d'evenements)
    const btnSuivi = document.createElement('button');
    btnSuivi.className = 'btn-ghost';
    btnSuivi.style.cssText = 'margin-top:8px;width:100%;font-size:12px;';
    btnSuivi.textContent = 'Voir le suivi complet';
    btnSuivi.addEventListener('click', e => { e.stopPropagation(); _onOpenSuivi?.(t); });
    card.appendChild(btnSuivi);

    list.appendChild(card);
  }
}

// ─── Modal nouveau travail ────────────────────────────────────────────────────

function openNewTravailModal() {
  const overlay = document.getElementById('modal-new-travail-overlay');
  overlay.classList.remove('hidden');

  // Deadline par defaut : dans 2 semaines
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  document.getElementById('nt-deadline').value =
    new Date(twoWeeks - twoWeeks.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  document.getElementById('nt-title').focus();
}

export function bindNewTravailForm() {
  const overlay = document.getElementById('modal-new-travail-overlay');

  document.getElementById('modal-new-travail-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  document.getElementById('btn-cancel-travail').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  document.getElementById('form-new-travail').addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.activeChannelId) { showToast('Selectionnez d\'abord un canal.'); return; }

    const title       = document.getElementById('nt-title').value.trim();
    const description = document.getElementById('nt-description').value.trim();
    const deadline    = document.getElementById('nt-deadline').value;
    if (!title || !deadline) return;

    const ok = await call(window.api.createTravail, {
      channelId: state.activeChannelId,
      title,
      description,
      deadline: deadline.replace('T', ' ') + ':00',
    });
    if (ok === null) return;

    overlay.classList.add('hidden');
    document.getElementById('form-new-travail').reset();
    showToast('Travail cree.', 'success');
    await renderTravaux();
  });
}
