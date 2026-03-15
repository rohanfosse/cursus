import { call }      from '../api.js';
import { escapeHtml, formatDate } from '../utils.js';
import { CATEGORIES } from './timeline.js';

// ─── Ouverture de l'échéancier ────────────────────────────────────────────────

export async function openEcheancier() {
  const overlay = document.getElementById('echeancier-overlay');
  overlay.classList.remove('hidden');
  await renderEcheancier();
}

export function bindEcheancier() {
  const overlay = document.getElementById('echeancier-overlay');

  document.getElementById('btn-echeancier-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

// ─── Rendu ────────────────────────────────────────────────────────────────────

async function renderEcheancier() {
  const body = document.getElementById('echeancier-body');
  body.innerHTML = '<div class="timeline-loading">Chargement…</div>';

  const data = await call(window.api.getTeacherSchedule);
  if (!data) { body.innerHTML = ''; return; }

  const { aNoter, jalons, brouillons, urgents } = data;
  body.innerHTML = '';

  // ── Section : À noter ────────────────────────────────────────────────────
  body.appendChild(buildSection({
    id:       'ech-anoter',
    icon:     '✏️',
    title:    'À corriger',
    count:    aNoter.length,
    empty:    'Tous les rendus ont une note.',
    emptyGood: true,
    items:    aNoter,
    renderItem: (r) => `
      <div class="ech-item ech-anoter">
        <div class="ech-item-left">
          <div class="ech-avatar" style="background:${catColor(r.category)}">${catInitial(r.category)}</div>
          <div class="ech-item-info">
            <div class="ech-item-title">${escapeHtml(r.travail_title)}</div>
            <div class="ech-item-sub">
              <span class="ech-promo-tag" style="background:${r.promo_color}20;color:${r.promo_color}">${escapeHtml(r.promo_name)}</span>
              #${escapeHtml(r.channel_name)}
              &middot; <strong>${escapeHtml(r.student_name)}</strong>
              &middot; ${escapeHtml(r.file_name)}
            </div>
            <div class="ech-item-date">Déposé le ${formatDate(r.submitted_at)}</div>
          </div>
        </div>
      </div>
    `,
  }));

  // ── Section : Urgences (échéances < 7j) ──────────────────────────────────
  body.appendChild(buildSection({
    id:       'ech-urgents',
    icon:     '⏰',
    title:    'Échéances dans 7 jours',
    count:    urgents.length,
    empty:    'Aucun devoir n\'arrive à échéance dans les 7 prochains jours.',
    emptyGood: true,
    items:    urgents,
    renderItem: (t) => {
      const pct = t.students_total > 0 ? Math.round((t.depots_count / t.students_total) * 100) : 0;
      const cc  = catColor(t.category);
      return `
        <div class="ech-item ech-urgent">
          <div class="ech-item-left">
            <div class="ech-avatar" style="background:${cc}">${catInitial(t.category)}</div>
            <div class="ech-item-info">
              <div class="ech-item-title">${escapeHtml(t.title)}</div>
              <div class="ech-item-sub">
                <span class="ech-promo-tag" style="background:${t.promo_color}20;color:${t.promo_color}">${escapeHtml(t.promo_name)}</span>
                #${escapeHtml(t.channel_name)}
                &middot; limite <strong>${formatDate(t.deadline)}</strong>
              </div>
              <div class="ech-progress-row">
                <div class="ech-progress-track">
                  <div class="ech-progress-fill" style="width:${pct}%;background:${cc}"></div>
                </div>
                <span class="ech-progress-label">${t.depots_count}/${t.students_total} rendus (${pct}%)</span>
              </div>
            </div>
          </div>
        </div>
      `;
    },
  }));

  // ── Section : Jalons à venir ──────────────────────────────────────────────
  body.appendChild(buildSection({
    id:       'ech-jalons',
    icon:     '🏁',
    title:    'Jalons dans 30 jours',
    count:    jalons.length,
    empty:    'Aucun jalon prévu dans les 30 prochains jours.',
    emptyGood: false,
    items:    jalons,
    renderItem: (j) => `
      <div class="ech-item ech-jalon">
        <div class="ech-item-left">
          <div class="ech-avatar ech-avatar-jalon">⚑</div>
          <div class="ech-item-info">
            <div class="ech-item-title">${escapeHtml(j.title)}</div>
            <div class="ech-item-sub">
              <span class="ech-promo-tag" style="background:${j.promo_color}20;color:${j.promo_color}">${escapeHtml(j.promo_name)}</span>
              #${escapeHtml(j.channel_name)}
              &middot; le <strong>${formatDate(j.deadline)}</strong>
            </div>
            ${j.description ? `<div class="ech-item-desc">${escapeHtml(j.description)}</div>` : ''}
          </div>
        </div>
      </div>
    `,
  }));

  // ── Section : Brouillons ──────────────────────────────────────────────────
  body.appendChild(buildSection({
    id:       'ech-brouillons',
    icon:     '📝',
    title:    'Brouillons à publier',
    count:    brouillons.length,
    empty:    'Aucun brouillon en attente.',
    emptyGood: true,
    items:    brouillons,
    renderItem: (t) => `
      <div class="ech-item ech-brouillon">
        <div class="ech-item-left">
          <div class="ech-avatar" style="background:${catColor(t.category)}">${catInitial(t.category)}</div>
          <div class="ech-item-info">
            <div class="ech-item-title">${escapeHtml(t.title)} <span class="draft-badge">Brouillon</span></div>
            <div class="ech-item-sub">
              <span class="ech-promo-tag" style="background:${t.promo_color}20;color:${t.promo_color}">${escapeHtml(t.promo_name)}</span>
              #${escapeHtml(t.channel_name)}
              &middot; deadline <strong>${formatDate(t.deadline)}</strong>
            </div>
          </div>
        </div>
      </div>
    `,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function catColor(category) {
  return CATEGORIES[category]?.color ?? '#888';
}

function catInitial(category) {
  return (category ?? '?')[0];
}

function buildSection({ id, icon, title, count, empty, emptyGood, items, renderItem }) {
  const section = document.createElement('div');
  section.className = 'ech-section';
  section.id = id;

  const header = document.createElement('div');
  header.className = 'ech-section-header';
  header.innerHTML = `
    <span class="ech-section-icon">${icon}</span>
    <span class="ech-section-title">${title}</span>
    ${count > 0
      ? `<span class="ech-count ech-count-${count > 0 ? 'warn' : 'ok'}">${count}</span>`
      : `<span class="ech-count ech-count-ok">0</span>`
    }
  `;
  section.appendChild(header);

  if (!items.length) {
    const msg = document.createElement('div');
    msg.className = `ech-empty ${emptyGood ? 'ech-empty-good' : ''}`;
    msg.textContent = empty;
    section.appendChild(msg);
    return section;
  }

  const list = document.createElement('div');
  list.className = 'ech-list';
  list.innerHTML = items.map(renderItem).join('');
  section.appendChild(list);

  return section;
}
