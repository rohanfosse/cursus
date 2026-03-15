import { call }      from '../api.js';
import { state }     from '../state.js';
import { escapeHtml, formatDate } from '../utils.js';
import { CATEGORIES } from './timeline.js';

// Durées par défaut (jours) quand start_date est absent
const DEFAULT_DURATIONS = {
  Projet: 60, Examen: 21, Devoir: 14, TP: 14, Rendu: 7,
};

let _currentPromoId = null;

export function setGanttPromo(promoId) {
  _currentPromoId = promoId;
}

export async function renderGantt(container) {
  container.innerHTML = '<div class="gantt-loading">Chargement du Gantt…</div>';

  const user = state.currentUser;
  let travaux;

  if (user?.type === 'student') {
    travaux = await call(window.api.getStudentTravaux, user.id);
    // Adapter la structure pour le gantt
    travaux = (travaux || []).map(t => ({
      ...t, promo_name: '', promo_color: 'var(--accent)', channel_name: t.channel_name,
    }));
  } else {
    const raw = await call(window.api.getGanttData, _currentPromoId ?? null);
    travaux = raw || [];
  }

  if (!travaux.length) {
    container.innerHTML = '<div class="gantt-empty">Aucun travail à afficher.</div>';
    return;
  }

  // Calculer les dates de début/fin effectives
  const now = new Date();
  const items = travaux.map(t => {
    const deadline  = new Date(t.deadline.replace(' ', 'T'));
    const startRaw  = t.start_date ? new Date(t.start_date.replace(' ', 'T')) : null;
    const defaultDays = DEFAULT_DURATIONS[t.category] ?? 14;
    const start = startRaw ?? new Date(deadline.getTime() - defaultDays * 86400000);
    return { ...t, _start: start, _deadline: deadline };
  });

  // Plage globale
  const minDate = new Date(Math.min(...items.map(i => i._start)));
  const maxDate = new Date(Math.max(...items.map(i => i._deadline)));
  // Arrondir au 1er du mois
  minDate.setDate(1); minDate.setHours(0, 0, 0, 0);
  maxDate.setMonth(maxDate.getMonth() + 1, 1); maxDate.setHours(0, 0, 0, 0);

  const totalMs = maxDate - minDate;

  // Générer les colonnes mois
  const months = [];
  let cur = new Date(minDate);
  while (cur < maxDate) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  // Grouper par promo/channel
  const groups = new Map();
  for (const t of items) {
    const key = t.promo_name ? `${t.promo_name} — #${t.channel_name}` : `#${t.channel_name}`;
    if (!groups.has(key)) groups.set(key, { color: t.promo_color, items: [] });
    groups.get(key).items.push(t);
  }

  // Construire le HTML
  const LEFT_W = 220;

  let html = `
    <div class="gantt-wrapper">
      <div class="gantt-header-row">
        <div class="gantt-label-col" style="width:${LEFT_W}px;min-width:${LEFT_W}px"></div>
        <div class="gantt-months">
          ${months.map(m => `
            <div class="gantt-month-cell" style="width:${(new Date(m.getFullYear(), m.getMonth()+1,1) - m) / totalMs * 100}%">
              ${m.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
            </div>
          `).join('')}
        </div>
      </div>
      <div class="gantt-body">
  `;

  // Ligne "Aujourd'hui"
  const todayPct = Math.max(0, Math.min(100, (now - minDate) / totalMs * 100));

  for (const [groupName, group] of groups) {
    html += `
      <div class="gantt-group-header">
        <div class="gantt-group-dot" style="background:${group.color}"></div>
        ${escapeHtml(groupName)}
      </div>
    `;

    for (const t of group.items) {
      const startPct   = Math.max(0, (t._start - minDate) / totalMs * 100);
      const endPct     = Math.min(100, (t._deadline - minDate) / totalMs * 100);
      const widthPct   = Math.max(0.5, endPct - startPct);
      const catColor   = CATEGORIES[t.category]?.color ?? '#888';
      const isPast     = t._deadline < now;
      const isJalon    = t.type === 'jalon';
      const pct        = t.students_total > 0 ? Math.round((t.depots_count / t.students_total) * 100) : 0;

      const barClass = `gantt-bar ${isPast ? 'past' : ''} ${isJalon ? 'jalon' : ''}`;

      html += `
        <div class="gantt-row" data-travail-id="${t.id}">
          <div class="gantt-label-col" style="width:${LEFT_W}px;min-width:${LEFT_W}px">
            <span class="gantt-row-cat" style="background:${catColor}20;color:${catColor}">${escapeHtml(t.category)}</span>
            <span class="gantt-row-title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>
          </div>
          <div class="gantt-track">
            <div class="gantt-today-line" style="left:${todayPct}%"></div>
            ${isJalon ? `
              <div class="${barClass}" style="left:${endPct}%;transform:translateX(-50%) rotate(45deg);width:10px;height:10px;background:${catColor};border-radius:2px;position:absolute;top:50%;margin-top:-5px;"
                   title="${escapeHtml(t.title)} — ${formatDate(t.deadline)}"></div>
            ` : `
              <div class="${barClass}" style="left:${startPct}%;width:${widthPct}%;background:${catColor};"
                   title="${escapeHtml(t.title)} — ${formatDate(t._start)} → ${formatDate(t.deadline)}">
                <div class="gantt-bar-fill" style="width:${pct}%;background:rgba(0,0,0,.25)"></div>
                <span class="gantt-bar-label">${escapeHtml(t.title)}</span>
              </div>
            `}
          </div>
        </div>
      `;
    }
  }

  html += `</div></div>`;
  container.innerHTML = html;

  // Clic sur une ligne → modal détail
  container.addEventListener('click', e => {
    const row = e.target.closest('.gantt-row[data-travail-id]');
    if (!row) return;
    const id = parseInt(row.dataset.travailId);
    const t  = items.find(x => x.id === id);
    if (t) openTravailDetail(t);
  });
}

// ─── Modal détail d'un travail ────────────────────────────────────────────────

export function openTravailDetail(t) {
  const overlay = document.getElementById('modal-travail-detail-overlay');
  const title   = document.getElementById('modal-travail-detail-title');
  const sub     = document.getElementById('modal-travail-detail-sub');
  const body    = document.getElementById('modal-travail-detail-body');

  const catColor = CATEGORIES[t.category]?.color ?? '#888';
  const pct = t.students_total > 0 ? Math.round(((t.depots_count ?? 0) / t.students_total) * 100) : 0;

  title.textContent = t.title;
  sub.innerHTML = `
    <span class="category-badge" style="background:${catColor}20;color:${catColor};border-color:${catColor}40">${escapeHtml(t.category)}</span>
    ${t.type === 'jalon' ? '<span class="jalon-badge">Jalon</span>' : ''}
    ${!t.published ? '<span class="draft-badge">Brouillon</span>' : ''}
  `;

  body.innerHTML = `
    <div class="travail-detail-body">
      <div class="tdb-row">
        <span class="tdb-label">Promotion</span>
        <span>${escapeHtml(t.promo_name ?? '')} — #${escapeHtml(t.channel_name ?? '')}</span>
      </div>
      ${t.group_name ? `<div class="tdb-row"><span class="tdb-label">Groupe</span><span class="group-tag">${escapeHtml(t.group_name)}</span></div>` : ''}
      ${t.start_date ? `<div class="tdb-row"><span class="tdb-label">Début</span><span>${formatDate(t.start_date)}</span></div>` : ''}
      <div class="tdb-row">
        <span class="tdb-label">${t.type === 'jalon' ? 'Date' : 'Deadline'}</span>
        <strong>${formatDate(t.deadline)}</strong>
      </div>
      ${t.description ? `<div class="tdb-desc">${escapeHtml(t.description)}</div>` : ''}
      ${t.type !== 'jalon' && t.students_total != null ? `
        <div class="tdb-progress">
          <div class="tdb-progress-label">
            <span>${t.depots_count ?? 0} / ${t.students_total} rendus</span>
            <span>${pct}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${pct}%;background:${catColor}"></div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('modal-travail-detail-close').onclick = () =>
    overlay.classList.add('hidden');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.add('hidden'); };
  overlay.classList.remove('hidden');
}
