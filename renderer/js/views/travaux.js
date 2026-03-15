import { call }      from '../api.js';
import { state }     from '../state.js';
import { showToast } from '../utils.js';
import { deadlineClass, deadlineLabel, formatDate, escapeHtml, isoForDatetimeLocal } from '../utils.js';
import { CATEGORIES } from './timeline.js';

let _onOpenDepots     = null;
let _onOpenSuivi      = null;
let _onOpenRessources = null;

export function initTravaux({ onOpenDepots, onOpenSuivi, onOpenRessources }) {
  _onOpenDepots     = onOpenDepots;
  _onOpenSuivi      = onOpenSuivi;
  _onOpenRessources = onOpenRessources;
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
      <span class="panel-title">Travaux</span>
      <button class="btn-ghost" id="btn-close-panel">Fermer</button>
    </div>
    <div class="panel-body" id="panel-body">
      <button class="btn-primary" id="btn-new-travail" style="width:100%">Nouveau travail</button>
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

  const list = document.getElementById('travaux-list');
  if (!list) return;

  const travaux = await call(window.api.getTravaux, state.activeChannelId);
  if (!travaux) return;

  list.innerHTML = '';

  if (!travaux.length) {
    list.innerHTML = `<div class="empty-state"><p>Aucun travail pour ce canal.</p></div>`;
    return;
  }

  for (const t of travaux) {
    list.appendChild(makeTravailCard(t));
  }
}

function makeTravailCard(t) {
  const isJalon   = t.type === 'jalon';
  const isDraft   = !t.published;
  const cls       = deadlineClass(t.deadline);
  const label     = deadlineLabel(t.deadline);
  const catColor  = CATEGORIES[t.category]?.color ?? '#888';

  const card = document.createElement('div');
  card.className = `travail-card${isJalon ? ' jalon' : ''}${isDraft ? ' draft' : ''}`;

  card.innerHTML = `
    <div class="travail-title">
      <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category ?? 'TP')}</span>
      ${isJalon ? '<span class="jalon-badge">Jalon</span>' : ''}
      ${isDraft  ? '<span class="draft-badge">Brouillon</span>' : ''}
      ${escapeHtml(t.title)}
      ${t.group_name ? `<span class="group-tag">${escapeHtml(t.group_name)}</span>` : ''}
    </div>
    <div class="travail-desc">${escapeHtml(t.description ?? '')}</div>
    <div class="travail-footer">
      <span class="deadline-badge ${cls}">${label} — ${formatDate(t.deadline)}</span>
      ${!isJalon ? `<span class="depots-progress"><strong>${t.depots_count ?? 0}/${t.students_total ?? 0}</strong> rendus</span>` : ''}
    </div>
    ${!isJalon ? `
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${t.students_total > 0 ? Math.round((t.depots_count / t.students_total) * 100) : 0}%"></div>
      </div>` : ''}
  `;

  // Actions
  const actions = document.createElement('div');
  actions.className = 'travail-card-actions';

  const btnRessources = document.createElement('button');
  btnRessources.className = 'btn-ghost';
  btnRessources.style.cssText = 'font-size:12px;flex:1;';
  btnRessources.textContent   = 'Ressources';
  btnRessources.addEventListener('click', e => { e.stopPropagation(); _onOpenRessources?.(t); });
  actions.appendChild(btnRessources);

  if (!isJalon) {
    card.addEventListener('click', () => _onOpenDepots?.(t));

    const btnSuivi = document.createElement('button');
    btnSuivi.className = 'btn-ghost';
    btnSuivi.style.cssText = 'font-size:12px;flex:1;';
    btnSuivi.textContent   = 'Suivi';
    btnSuivi.addEventListener('click', e => { e.stopPropagation(); _onOpenSuivi?.(t); });
    actions.appendChild(btnSuivi);
  }

  // Toggle brouillon / publier
  const btnPublish = document.createElement('button');
  btnPublish.className = 'btn-ghost';
  btnPublish.style.cssText = 'font-size:12px;flex:1;';
  btnPublish.textContent   = isDraft ? 'Publier' : 'Brouillon';
  btnPublish.addEventListener('click', async e => {
    e.stopPropagation();
    const ok = await call(window.api.updateTravailPublished, { travailId: t.id, published: isDraft });
    if (ok === null) return;
    showToast(isDraft ? 'Travail publie.' : 'Passe en brouillon.', 'success');
    await renderTravaux();
  });
  actions.appendChild(btnPublish);

  card.appendChild(actions);
  return card;
}

// ─── Modal nouveau travail ────────────────────────────────────────────────────

async function openNewTravailModal() {
  const overlay = document.getElementById('modal-new-travail-overlay');
  overlay.classList.remove('hidden');

  // Deadline par defaut : dans 2 semaines
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  document.getElementById('nt-deadline').value =
    new Date(twoWeeks - twoWeeks.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  // Basculer les champs selon type devoir/jalon
  updateTravailTypeFields();

  // Charger les groupes de la promo courante
  const groupSelect = document.getElementById('nt-group');
  groupSelect.innerHTML = '<option value="">Toute la promotion</option>';
  if (state.activePromoId) {
    const groups = await call(window.api.getGroups, state.activePromoId);
    if (groups) {
      for (const g of groups) {
        const opt = document.createElement('option');
        opt.value       = g.id;
        opt.textContent = `${g.name} (${g.members_count} eleve${g.members_count > 1 ? 's' : ''})`;
        groupSelect.appendChild(opt);
      }
    }
  }

  document.getElementById('nt-title').focus();
}

function updateTravailTypeFields() {
  const type       = document.querySelector('input[name="nt-type"]:checked')?.value ?? 'devoir';
  const isJalon    = type === 'jalon';
  const devoirOnly = document.getElementById('nt-devoir-only-fields');
  if (devoirOnly) devoirOnly.style.display = isJalon ? 'none' : '';
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

  // Switch devoir / jalon
  overlay.querySelectorAll('input[name="nt-type"]').forEach(r => {
    r.addEventListener('change', updateTravailTypeFields);
  });

  document.getElementById('form-new-travail').addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.activeChannelId) { showToast('Selectionnez d\'abord un canal.'); return; }

    const type        = overlay.querySelector('input[name="nt-type"]:checked')?.value ?? 'devoir';
    const isJalon     = type === 'jalon';
    const title       = document.getElementById('nt-title').value.trim();
    const description = document.getElementById('nt-description').value.trim();
    const startDate   = document.getElementById('nt-start-date')?.value ?? '';
    const deadline    = document.getElementById('nt-deadline').value;
    const groupVal    = !isJalon ? document.getElementById('nt-group').value    : '';
    const category    = document.getElementById('nt-category').value;
    const published   = !document.getElementById('nt-draft')?.checked;
    if (!title || !deadline) return;

    const ok = await call(window.api.createTravail, {
      channelId: state.activeChannelId,
      title,
      description,
      startDate: startDate ? startDate.replace('T', ' ') + ':00' : null,
      deadline:  deadline.replace('T', ' ') + ':00',
      groupId:   groupVal ? parseInt(groupVal) : null,
      category,
      type,
      published,
    });
    if (ok === null) return;

    overlay.classList.add('hidden');
    document.getElementById('form-new-travail').reset();
    updateTravailTypeFields();
    showToast(isJalon ? 'Jalon cree.' : 'Travail cree.', 'success');
    await renderTravaux();
  });
}
