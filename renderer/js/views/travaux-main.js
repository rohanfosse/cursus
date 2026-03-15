import { call }      from '../api.js';
import { state }     from '../state.js';
import { escapeHtml, formatDate, deadlineClass, deadlineLabel } from '../utils.js';
import { CATEGORIES } from './timeline.js';
import { renderGantt, setGanttPromo, openTravailDetail } from './gantt.js';
import { renderRendus, setRendusPromo } from './rendus.js';

let _activeTab   = 'list'; // 'list' | 'rendus'
let _activePromo = null;   // null = toutes
let _activeView  = 'gantt'; // 'gantt' | 'rendus' (boutons header)

// ─── Initialisation de la section Travaux ────────────────────────────────────

export async function initTravauxSection() {
  await renderTravauxSidebar();
  await switchTravauxView('gantt');
}

// ─── Sidebar Travaux ─────────────────────────────────────────────────────────

export async function renderTravauxSidebar() {
  await renderPromoFilter();
  await renderTravauxNav();
  bindSidebarTabs();
}

function bindSidebarTabs() {
  const tabs = document.querySelectorAll('#travaux-sidebar-tabs .trv-tab');
  tabs.forEach(tab => {
    tab.onclick = async () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _activeTab = tab.dataset.tab;
      await renderTravauxNav();
      // Si on clique sur "Rendus" dans sidebar, passer la vue principale aux rendus
      if (_activeTab === 'rendus') {
        await switchTravauxView('rendus');
      } else {
        await switchTravauxView('gantt');
      }
    };
  });
}

async function renderPromoFilter() {
  const container = document.getElementById('travaux-promo-filter');
  if (!container) return;

  if (state.currentUser?.type !== 'teacher') {
    container.innerHTML = '';
    return;
  }

  const promotions = await call(window.api.getPromotions);
  if (!promotions) return;

  container.innerHTML = `
    <div class="trv-promo-filter">
      <button class="trv-promo-btn active" data-promo-id="">Toutes</button>
      ${promotions.map(p => `
        <button class="trv-promo-btn" data-promo-id="${p.id}">
          <span class="promo-dot" style="background:${p.color}"></span>
          ${escapeHtml(p.name)}
        </button>
      `).join('')}
    </div>
  `;

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-promo-id]');
    if (!btn) return;
    container.querySelectorAll('.trv-promo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _activePromo = btn.dataset.promoId ? parseInt(btn.dataset.promoId) : null;
    setGanttPromo(_activePromo);
    setRendusPromo(_activePromo);
    await renderTravauxNav();
    await switchTravauxView(_activeView);
  });
}

async function renderTravauxNav() {
  const nav = document.getElementById('travaux-nav');
  if (!nav) return;

  if (_activeTab === 'rendus') {
    await renderRendusSidebar(nav);
    return;
  }

  // Liste des travaux
  const user = state.currentUser;
  let travaux;

  if (user?.type === 'student') {
    travaux = (await call(window.api.getStudentTravaux, user.id)) ?? [];
  } else {
    const raw = (await call(window.api.getGanttData, _activePromo ?? null)) ?? [];
    travaux = raw;
  }

  if (!travaux.length) {
    nav.innerHTML = '<div class="nav-empty">Aucun travail.</div>';
    return;
  }

  // Grouper par canal
  const byChannel = new Map();
  for (const t of travaux) {
    const key = t.channel_name ?? '';
    if (!byChannel.has(key)) byChannel.set(key, []);
    byChannel.get(key).push(t);
  }

  let html = '';
  for (const [ch, items] of byChannel) {
    html += `
      <div class="trv-nav-channel">
        <div class="trv-nav-channel-label"><span class="channel-prefix">#</span>${escapeHtml(ch)}</div>
        ${items.map(t => {
          const catColor = CATEGORIES[t.category]?.color ?? '#888';
          const isJalon  = t.type === 'jalon';
          const pct = t.students_total > 0 ? Math.round(((t.depots_count ?? 0) / t.students_total) * 100) : null;
          return `
            <div class="trv-nav-item" data-travail-id="${t.id}">
              <span class="trv-nav-dot" style="background:${catColor}"></span>
              <div class="trv-nav-item-content">
                <div class="trv-nav-item-title">${escapeHtml(t.title)}</div>
                <div class="trv-nav-item-meta">
                  ${formatDate(t.deadline)}
                  ${isJalon ? '<span class="jalon-badge" style="font-size:9px">Jalon</span>' : ''}
                  ${!t.published ? '<span class="draft-badge" style="font-size:9px">Brouillon</span>' : ''}
                </div>
                ${pct !== null && !isJalon ? `
                  <div class="trv-nav-progress">
                    <div class="trv-nav-progress-fill" style="width:${pct}%;background:${catColor}"></div>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  nav.innerHTML = html;

  // Clic sur un travail → ouvrir son détail
  nav.addEventListener('click', e => {
    const item = e.target.closest('[data-travail-id]');
    if (!item) return;
    const id = parseInt(item.dataset.travailId);
    const t  = travaux.find(x => x.id === id);
    if (t) openTravailDetail(t);
  });
}

async function renderRendusSidebar(nav) {
  // Dans le sidebar Rendus : stats rapides par promo
  const user = state.currentUser;
  if (user?.type === 'student') {
    nav.innerHTML = '<div class="nav-empty">Vos rendus sont affichés à droite.</div>';
    return;
  }

  const rendus = (await call(window.api.getAllRendus, _activePromo ?? null)) ?? [];
  const noted  = rendus.filter(r => r.note != null).length;
  const unoted = rendus.length - noted;

  // Stats groupées par travail
  const byTravail = new Map();
  for (const r of rendus) {
    if (!byTravail.has(r.travail_id)) byTravail.set(r.travail_id, { title: r.travail_title, category: r.category, count: 0, noted: 0 });
    const g = byTravail.get(r.travail_id);
    g.count++;
    if (r.note != null) g.noted++;
  }

  let html = `
    <div class="trv-rendus-stats">
      <div class="trv-stat"><span>${rendus.length}</span>Dépôts</div>
      <div class="trv-stat ok"><span>${noted}</span>Notés</div>
      ${unoted > 0 ? `<div class="trv-stat warn"><span>${unoted}</span>À noter</div>` : ''}
    </div>
  `;

  for (const [, g] of byTravail) {
    const catColor = CATEGORIES[g.category]?.color ?? '#888';
    const pct = g.count > 0 ? Math.round(g.noted / g.count * 100) : 0;
    html += `
      <div class="trv-nav-item" style="padding:8px 10px">
        <span class="trv-nav-dot" style="background:${catColor}"></span>
        <div class="trv-nav-item-content">
          <div class="trv-nav-item-title">${escapeHtml(g.title)}</div>
          <div class="trv-nav-item-meta">${g.noted}/${g.count} notés</div>
          <div class="trv-nav-progress">
            <div class="trv-nav-progress-fill" style="width:${pct}%;background:${catColor}"></div>
          </div>
        </div>
      </div>
    `;
  }

  nav.innerHTML = html;
}

// ─── Basculer entre Gantt et Rendus ──────────────────────────────────────────

export async function switchTravauxView(view) {
  _activeView = view;
  document.getElementById('gantt-view').classList.toggle('hidden', view !== 'gantt');
  document.getElementById('rendus-view').classList.toggle('hidden', view !== 'rendus');

  document.querySelectorAll('.btn-view').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });

  const icon = document.getElementById('travaux-area-icon');
  const name = document.getElementById('travaux-area-name');
  if (icon && name) {
    icon.textContent = view === 'gantt' ? '📊' : '📁';
    name.textContent = view === 'gantt' ? 'Gantt des travaux' : 'Rendus';
  }

  if (view === 'gantt') {
    setGanttPromo(_activePromo);
    await renderGantt(document.getElementById('gantt-view'));
  } else {
    setRendusPromo(_activePromo);
    await renderRendus(document.getElementById('rendus-view'));
  }
}
