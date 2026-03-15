import { call }      from '../api.js';
import { state }     from '../state.js';
import { escapeHtml, formatDate, deadlineClass, deadlineLabel } from '../utils.js';
import { renderRessourcesInline } from './ressources.js';

// Categories disponibles et leurs couleurs
export const CATEGORIES = {
  TP:      { label: 'TP',      color: '#4A90D9' },
  Projet:  { label: 'Projet',  color: '#7B68EE' },
  Devoir:  { label: 'Devoir',  color: '#50C878' },
  Examen:  { label: 'Examen',  color: '#E74C3C' },
  Rendu:   { label: 'Rendu',   color: '#F39C12' },
};

// Filtres actifs
let _promoFilter    = null; // null = toutes les promos
let _categoryFilter = null;

// ─── Ouverture de la timeline ─────────────────────────────────────────────────

export async function openTimeline() {
  _promoFilter    = null;
  _categoryFilter = null;

  const overlay = document.getElementById('timeline-overlay');
  overlay.classList.remove('hidden');

  // Titres selon le rôle
  document.getElementById('timeline-title').textContent =
    state.currentUser?.type === 'teacher'
      ? 'Timeline des travaux — toutes les promotions'
      : 'Ma timeline';

  // Onglets promo (prof uniquement)
  await renderPromoTabs();

  // Reset filtres catégorie visuellement
  document.querySelectorAll('#timeline-filters [data-cat]')
    .forEach(b => b.classList.remove('active'));

  await renderTimeline();
}

export function bindTimeline() {
  const overlay = document.getElementById('timeline-overlay');

  document.getElementById('btn-timeline-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  // Filtres catégorie
  overlay.querySelector('#timeline-filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    if (btn.classList.contains('active')) {
      btn.classList.remove('active');
      _categoryFilter = null;
    } else {
      overlay.querySelectorAll('#timeline-filters [data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _categoryFilter = btn.dataset.cat;
    }
    renderTimeline();
  });
}

// ─── Onglets promo (prof) ────────────────────────────────────────────────────

async function renderPromoTabs() {
  const container = document.getElementById('timeline-promo-tabs');
  if (!container) return;

  if (state.currentUser?.type !== 'teacher') {
    container.innerHTML = '';
    return;
  }

  const promotions = await call(window.api.getPromotions);
  if (!promotions) return;

  container.innerHTML = `
    <button class="promo-tab active" data-promo-id="">Toutes</button>
    ${promotions.map(p => `
      <button class="promo-tab" data-promo-id="${p.id}">
        <span class="promo-dot" style="background:${p.color}"></span>
        ${escapeHtml(p.name)}
      </button>
    `).join('')}
  `;

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-promo-id]');
    if (!btn) return;
    container.querySelectorAll('.promo-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _promoFilter = btn.dataset.promoId ? parseInt(btn.dataset.promoId) : null;
    _categoryFilter = null;
    document.querySelectorAll('#timeline-filters [data-cat]').forEach(b => b.classList.remove('active'));
    renderTimeline();
  });
}

// ─── Rendu de la timeline ────────────────────────────────────────────────────

async function renderTimeline() {
  const body = document.getElementById('timeline-body');
  body.innerHTML = '<div class="timeline-loading">Chargement…</div>';

  const user = state.currentUser;
  let travaux;

  if (user?.type === 'student') {
    travaux = await call(window.api.getStudentTravaux, user.id);
  } else {
    travaux = await loadAllTravaux(_promoFilter);
  }

  if (!travaux) { body.innerHTML = ''; return; }

  if (_categoryFilter) {
    travaux = travaux.filter(t => t.category === _categoryFilter);
  }

  // Trier par deadline croissante
  travaux = [...travaux].sort((a, b) => a.deadline.localeCompare(b.deadline));

  body.innerHTML = '';

  if (!travaux.length) {
    body.innerHTML = `<div class="timeline-empty">Aucun travail${_categoryFilter ? ` en "${_categoryFilter}"` : ''}${_promoFilter ? ' pour cette promotion' : ''}.</div>`;
    return;
  }

  // Grouper par mois
  const byMonth = new Map();
  for (const t of travaux) {
    const key = t.deadline.slice(0, 7); // YYYY-MM
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(t);
  }

  const now = new Date();

  for (const [monthKey, items] of byMonth) {
    const [year, month] = monthKey.split('-');
    const monthName = new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const monthEl = document.createElement('div');
    monthEl.className = 'timeline-month';
    monthEl.innerHTML = `<div class="timeline-month-label">${monthName}</div>`;
    body.appendChild(monthEl);

    for (const t of items) {
      const deadline  = new Date(t.deadline.replace(' ', 'T'));
      const isPast    = deadline < now;
      const rendu     = t.depot_id != null;
      const dlClass   = deadlineClass(t.deadline);
      const dlLabel   = deadlineLabel(t.deadline);
      const catColor  = CATEGORIES[t.category]?.color ?? '#888';
      const isJalon   = t.type === 'jalon';

      // Pour le prof : infos progression
      const promoLine = (user?.type === 'teacher' && t.promo_name)
        ? `<span class="timeline-promo-tag" style="background:${t.promo_color}20;color:${t.promo_color}">${escapeHtml(t.promo_name)}</span>`
        : '';

      const progressLine = (user?.type === 'teacher' && !isJalon && t.students_total != null)
        ? (() => {
            const pct = t.students_total > 0 ? Math.round((t.depots_count / t.students_total) * 100) : 0;
            return `
              <div class="timeline-progress">
                <div class="timeline-progress-track">
                  <div class="timeline-progress-fill" style="width:${pct}%;background:${catColor}"></div>
                </div>
                <span class="timeline-progress-label">${t.depots_count}/${t.students_total} rendus</span>
              </div>
            `;
          })()
        : '';

      const card = document.createElement('div');
      card.className = `timeline-card${rendu ? ' rendu' : ''}${isPast && !rendu && !isJalon ? ' retard' : ''}${isJalon ? ' jalon' : ''}`;

      card.innerHTML = `
        <div class="timeline-line">
          <div class="timeline-dot" style="background:${catColor}"></div>
        </div>
        <div class="timeline-card-content">
          <div class="timeline-card-header">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">
                ${escapeHtml(t.category)}
              </span>
              ${isJalon ? '<span class="jalon-badge">Jalon</span>' : ''}
              ${promoLine}
            </div>
            ${isJalon
              ? (isPast
                  ? '<span class="timeline-status past-jalon">Passé</span>'
                  : `<span class="deadline-badge ${dlClass}">${dlLabel}</span>`)
              : (rendu
                  ? '<span class="timeline-status rendu">Rendu ✓</span>'
                  : isPast
                    ? '<span class="timeline-status retard">En retard</span>'
                    : `<span class="deadline-badge ${dlClass}">${dlLabel}</span>`)
            }
          </div>
          <div class="timeline-card-title">${escapeHtml(t.title)}</div>
          <div class="timeline-card-meta">
            ${t.channel_name ? `#${escapeHtml(t.channel_name)}` : ''}
            ${t.group_name   ? ` &middot; <span class="group-tag">${escapeHtml(t.group_name)}</span>` : ''}
            &middot; ${isJalon ? 'le' : 'limite le'} <strong>${formatDate(t.deadline)}</strong>
          </div>
          ${t.description ? `<div class="timeline-card-desc">${escapeHtml(t.description)}</div>` : ''}
          ${progressLine}
          ${rendu && user?.type === 'student' ? `
            <div class="timeline-rendu-info">
              <span>${escapeHtml(t.file_name)}</span>
              ${t.note != null ? `<span class="note-badge">${t.note}/20</span>` : '<span class="stc-pending-note">Non noté</span>'}
            </div>
          ` : ''}
          <div class="timeline-ressources-zone" id="tl-res-${t.id}"></div>
        </div>
      `;

      monthEl.appendChild(card);

      renderRessourcesInline(t.id, card.querySelector(`#tl-res-${t.id}`));
    }
  }
}

// ─── Chargement tous les travaux (prof) ──────────────────────────────────────

async function loadAllTravaux(promoId = null) {
  const promotions = await call(window.api.getPromotions);
  if (!promotions) return null;

  const all = [];
  for (const promo of promotions) {
    if (promoId && promo.id !== promoId) continue;

    const channels = await call(window.api.getChannels, promo.id);
    if (!channels) continue;
    for (const ch of channels) {
      if (ch.type !== 'chat') continue;
      const travaux = await call(window.api.getTravaux, ch.id);
      if (!travaux) continue;
      for (const t of travaux) {
        all.push({ ...t, channel_name: ch.name, promo_name: promo.name, promo_color: promo.color });
      }
    }
  }
  return all;
}
