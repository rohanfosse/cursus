import { call }      from '../api.js';
import { state }     from '../state.js';
import { showToast, escapeHtml, formatDate, avatarColor, makeAvatar } from '../utils.js';
import { CATEGORIES } from './timeline.js';
import { openSuiviModal } from './suivi.js';

let _currentPromoId = null;
let _searchTerm     = '';

export function setRendusPromo(promoId) {
  _currentPromoId = promoId;
}

export async function renderRendus(container) {
  container.innerHTML = `
    <div class="rendus-toolbar">
      <input id="rendus-search" class="form-input" type="text"
             placeholder="Rechercher un étudiant ou travail…" style="flex:1;max-width:320px" />
      <span id="rendus-count" class="rendus-count"></span>
    </div>
    <div id="rendus-list-container" class="rendus-list-container">
      <div class="gantt-loading">Chargement…</div>
    </div>
  `;

  const searchInput = container.querySelector('#rendus-search');
  searchInput.addEventListener('input', () => {
    _searchTerm = searchInput.value.trim().toLowerCase();
    renderRendusList(container.querySelector('#rendus-list-container'));
  });

  await renderRendusList(container.querySelector('#rendus-list-container'));
}

async function renderRendusList(container) {
  const user = state.currentUser;

  let rendus;
  if (user?.type === 'student') {
    const travaux = await call(window.api.getStudentTravaux, user.id);
    rendus = (travaux || [])
      .filter(t => t.depot_id != null)
      .map(t => ({
        id: t.depot_id, file_name: t.file_name, file_path: null, note: t.note,
        feedback: t.feedback, submitted_at: t.submitted_at,
        student_name: user.name, avatar_initials: user.avatar_initials, photo_data: user.photo_data,
        travail_title: t.title, category: t.category, deadline: t.deadline,
        channel_name: t.channel_name, promo_name: '', promo_color: 'var(--accent)',
      }));
  } else {
    rendus = await call(window.api.getAllRendus, _currentPromoId ?? null) ?? [];
  }

  // Filtrer par recherche
  if (_searchTerm) {
    rendus = rendus.filter(r =>
      r.student_name?.toLowerCase().includes(_searchTerm) ||
      r.travail_title?.toLowerCase().includes(_searchTerm) ||
      r.channel_name?.toLowerCase().includes(_searchTerm)
    );
  }

  // Mettre à jour le compteur
  const countEl = document.getElementById('rendus-count');
  if (countEl) countEl.textContent = `${rendus.length} dépôt${rendus.length > 1 ? 's' : ''}`;

  if (!rendus.length) {
    container.innerHTML = '<div class="gantt-empty">Aucun rendu trouvé.</div>';
    return;
  }

  // Grouper par travail
  const byTravail = new Map();
  for (const r of rendus) {
    const key = r.travail_title;
    if (!byTravail.has(key)) byTravail.set(key, { meta: r, items: [] });
    byTravail.get(key).items.push(r);
  }

  let html = '';
  for (const [travailTitle, group] of byTravail) {
    const { meta } = group;
    const catColor = CATEGORIES[meta.category]?.color ?? '#888';
    const noted = group.items.filter(r => r.note != null).length;

    html += `
      <div class="rendus-group">
        <div class="rendus-group-header">
          <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(meta.category)}</span>
          <span class="rendus-group-title">${escapeHtml(travailTitle)}</span>
          <span class="rendus-group-meta">#${escapeHtml(meta.channel_name)}</span>
          ${meta.promo_name ? `<span class="ech-promo-tag" style="background:${meta.promo_color}20;color:${meta.promo_color}">${escapeHtml(meta.promo_name)}</span>` : ''}
          <span class="rendus-stats">${group.items.length} rendu${group.items.length > 1 ? 's' : ''} — ${noted} noté${noted > 1 ? 's' : ''}</span>
        </div>
        <div class="rendus-group-items">
          ${group.items.map(r => buildRenduRow(r)).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Câbler les boutons
  container.addEventListener('click', async e => {
    // Voir PDF
    const btnPdf = e.target.closest('[data-open-pdf]');
    if (btnPdf) {
      const fp = btnPdf.dataset.openPdf;
      if (!fp) return showToast('Chemin de fichier non disponible.', 'error');
      const isPdf = fp.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        await call(window.api.openPdf, fp);
      } else {
        await call(window.api.openPath, fp);
      }
    }
  });
}

function buildRenduRow(r) {
  const isPdf = r.file_name?.toLowerCase().endsWith('.pdf');
  const catColor = CATEGORIES[r.category]?.color ?? '#888';

  return `
    <div class="rendu-row">
      <div class="rendu-row-left">
        <div class="rendu-avatar" style="background:${avatarColor(r.student_name)};color:#fff">
          ${escapeHtml(r.avatar_initials ?? '?')}
        </div>
        <div class="rendu-info">
          <div class="rendu-student">${escapeHtml(r.student_name)}</div>
          <div class="rendu-file">
            <span class="rendu-file-icon">${isPdf ? '📄' : '📎'}</span>
            <span>${escapeHtml(r.file_name ?? 'Fichier manquant')}</span>
            <span class="rendu-date">· ${formatDate(r.submitted_at)}</span>
          </div>
          ${r.feedback ? `<div class="rendu-feedback">${escapeHtml(r.feedback)}</div>` : ''}
        </div>
      </div>
      <div class="rendu-row-right">
        ${r.note != null
          ? `<span class="note-badge">${r.note}/20</span>`
          : `<span class="rendu-non-note">Non noté</span>`
        }
        ${r.file_path ? `
          <button class="btn-ghost btn-sm" data-open-pdf="${escapeHtml(r.file_path)}"
                  title="${isPdf ? 'Voir le PDF' : 'Ouvrir le fichier'}">
            ${isPdf ? '👁 Voir' : '📂 Ouvrir'}
          </button>
        ` : ''}
      </div>
    </div>
  `;
}
