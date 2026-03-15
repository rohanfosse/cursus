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

// ─── Ouverture de la timeline ─────────────────────────────────────────────────

export async function openTimeline() {
  const overlay = document.getElementById('timeline-overlay');
  overlay.classList.remove('hidden');
  await renderTimeline(null);
}

export function bindTimeline() {
  const overlay = document.getElementById('timeline-overlay');

  document.getElementById('btn-timeline-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  // Filtres categorie
  overlay.querySelector('#timeline-filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;

    const cat = btn.dataset.cat;

    // Toggle
    if (btn.classList.contains('active')) {
      btn.classList.remove('active');
      renderTimeline(null);
    } else {
      overlay.querySelectorAll('#timeline-filters [data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTimeline(cat);
    }
  });
}

async function renderTimeline(categoryFilter) {
  const body = document.getElementById('timeline-body');
  body.innerHTML = '<div class="timeline-loading">Chargement…</div>';

  const user = state.currentUser;
  let travaux;

  if (user?.type === 'student') {
    travaux = await call(window.api.getStudentTravaux, user.id);
  } else {
    // Professeur : vue globale de tous les travaux (on passe par getPromotions + getTravaux)
    travaux = await loadAllTravaux();
  }

  if (!travaux) { body.innerHTML = ''; return; }

  if (categoryFilter) {
    travaux = travaux.filter(t => t.category === categoryFilter);
  }

  // Trier par deadline croissante
  travaux = [...travaux].sort((a, b) => a.deadline.localeCompare(b.deadline));

  body.innerHTML = '';

  if (!travaux.length) {
    body.innerHTML = `<div class="timeline-empty">Aucun travail${categoryFilter ? ` dans la categorie "${categoryFilter}"` : ''}.</div>`;
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

      const card = document.createElement('div');
      card.className = `timeline-card ${rendu ? 'rendu' : ''} ${isPast && !rendu ? 'retard' : ''}`;

      card.innerHTML = `
        <div class="timeline-line">
          <div class="timeline-dot" style="background:${catColor}"></div>
        </div>
        <div class="timeline-card-content">
          <div class="timeline-card-header">
            <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">
              ${escapeHtml(t.category)}
            </span>
            ${rendu
              ? '<span class="timeline-status rendu">Rendu</span>'
              : isPast
                ? '<span class="timeline-status retard">En retard</span>'
                : `<span class="deadline-badge ${dlClass}">${dlLabel}</span>`
            }
          </div>
          <div class="timeline-card-title">${escapeHtml(t.title)}</div>
          <div class="timeline-card-meta">
            ${t.channel_name ? `#${escapeHtml(t.channel_name)}` : ''}
            ${t.group_name   ? ` &middot; <span class="group-tag">${escapeHtml(t.group_name)}</span>` : ''}
            &middot; limite le <strong>${formatDate(t.deadline)}</strong>
          </div>
          ${t.description ? `<div class="timeline-card-desc">${escapeHtml(t.description)}</div>` : ''}
          ${rendu && user?.type === 'student' ? `
            <div class="timeline-rendu-info">
              <span>${escapeHtml(t.file_name)}</span>
              ${t.note != null ? `<span class="note-badge">${t.note}/20</span>` : '<span class="stc-pending-note">Non note</span>'}
            </div>
          ` : ''}
          <div class="timeline-ressources-zone" id="tl-res-${t.id}"></div>
        </div>
      `;

      monthEl.appendChild(card);

      // Charger les ressources en parallele
      renderRessourcesInline(t.id, card.querySelector(`#tl-res-${t.id}`));
    }
  }
}

async function loadAllTravaux() {
  // Pour le prof : aggreger tous les travaux de toutes les promos
  const promotions = await call(window.api.getPromotions);
  if (!promotions) return null;

  const all = [];
  for (const promo of promotions) {
    const channels = await call(window.api.getChannels, promo.id);
    if (!channels) continue;
    for (const ch of channels) {
      if (ch.type !== 'chat') continue;
      const travaux = await call(window.api.getTravaux, ch.id);
      if (!travaux) continue;
      for (const t of travaux) {
        all.push({ ...t, channel_name: ch.name });
      }
    }
  }
  return all;
}
