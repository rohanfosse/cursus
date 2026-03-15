import { call }        from '../api.js';
import { state }       from '../state.js';
import { avatarColor, escapeHtml } from '../utils.js';

// Callbacks injectes par main.js pour ne pas creer de dependances circulaires
let _onChannel = null;
let _onDm      = null;

export function initSidebar({ onChannel, onDm }) {
  _onChannel = onChannel;
  _onDm      = onDm;
}

export async function renderSidebar() {
  const nav  = document.getElementById('sidebar-nav');
  const user = state.currentUser;

  // Mettre a jour le badge utilisateur dans le header
  const badgeEl = document.getElementById('teacher-badge');
  if (badgeEl && user) {
    const color = user.type === 'teacher' ? 'var(--accent)' : avatarColor(user.name);
    badgeEl.innerHTML = `
      <div class="avatar teacher-avatar" style="background:${color};color:#fff">${escapeHtml(user.avatar_initials)}</div>
      <div class="sidebar-user-info">
        <span class="sidebar-user-name">${escapeHtml(user.name)}</span>
        <span class="sidebar-user-role">${user.type === 'teacher' ? 'Professeur' : escapeHtml(user.promo_name ?? '')}</span>
      </div>
    `;
  }

  nav.innerHTML = '';

  // ── Vue etudiant — sidebar simplifiee ─────────────────────────────────────
  if (user?.type === 'student') {
    await renderStudentSidebar(nav, user);
    return;
  }

  // ── Vue professeur — toutes les promos ────────────────────────────────────
  await renderTeacherSidebar(nav);
}

// ─── Sidebar professeur ───────────────────────────────────────────────────────

async function renderTeacherSidebar(nav) {
  const promotions  = await call(window.api.getPromotions);
  const allStudents = await call(window.api.getAllStudents);
  if (!promotions || !allStudents) return;

  for (const promo of promotions) {
    const channels = await call(window.api.getChannels, promo.id);
    if (!channels) continue;
    const students = allStudents.filter(s => s.promo_id === promo.id);

    const section = buildPromoSection(promo, channels, students, true);
    nav.appendChild(section);
  }

  // Bouton "Nouvelle promotion"
  const btnNew = document.createElement('button');
  btnNew.className = 'btn-new-promo';
  btnNew.textContent = '+ Nouvelle promotion';
  btnNew.addEventListener('click', () => openNewPromoForm(nav));
  nav.appendChild(btnNew);

  attachNavDelegation(nav);
}

function openNewPromoForm(nav) {
  // Eviter les doublons
  if (document.getElementById('new-promo-form')) return;

  const COLORS = ['#4A90D9','#7B68EE','#50C878','#E74C3C','#F39C12','#1ABC9C','#E91E63'];

  const wrap = document.createElement('div');
  wrap.id = 'new-promo-form';
  wrap.className = 'new-promo-form';
  wrap.innerHTML = `
    <div class="form-group" style="margin:0">
      <input type="text" id="new-promo-name" class="form-input" placeholder="Nom de la promotion" style="font-size:12px;padding:6px 10px;" />
    </div>
    <div class="promo-color-row" id="promo-color-row">
      ${COLORS.map((c, i) => `<button type="button" class="color-swatch${i === 0 ? ' selected' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
    </div>
    <div style="display:flex;gap:6px;margin-top:6px;">
      <button id="btn-cancel-promo" class="btn-ghost" style="flex:1;font-size:12px;padding:5px">Annuler</button>
      <button id="btn-confirm-promo" class="btn-primary" style="flex:1;font-size:12px;padding:5px">Creer</button>
    </div>
  `;

  let selectedColor = COLORS[0];

  wrap.querySelector('#promo-color-row').addEventListener('click', e => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    wrap.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    selectedColor = swatch.dataset.color;
  });

  wrap.querySelector('#btn-cancel-promo').addEventListener('click', () => wrap.remove());

  wrap.querySelector('#btn-confirm-promo').addEventListener('click', async () => {
    const { showToast } = await import('../utils.js');
    const name = document.getElementById('new-promo-name').value.trim();
    if (!name) return;

    const ok = await call(window.api.createPromotion, { name, color: selectedColor });
    if (ok === null) return;

    wrap.remove();
    showToast('Promotion creee.', 'success');
    _delegationAttached = false;
    await renderSidebar();
  });

  nav.insertBefore(wrap, nav.querySelector('.btn-new-promo'));
  document.getElementById('new-promo-name').focus();
}

// ─── Sidebar etudiant ─────────────────────────────────────────────────────────

async function renderStudentSidebar(nav, user) {
  const [channels, promotions, travaux] = await Promise.all([
    call(window.api.getChannels, user.promo_id),
    call(window.api.getPromotions),
    call(window.api.getStudentTravaux, user.id),
  ]);
  if (!channels || !promotions) return;

  const promo = promotions.find(p => p.id === user.promo_id);
  if (!promo) return;

  const section = buildPromoSection(promo, channels, [], false);
  nav.appendChild(section);

  // ── Lien DM professeur ──────────────────────────────────────────────────
  const dmLabel = document.createElement('div');
  dmLabel.className = 'section-label';
  dmLabel.style.marginTop = '12px';
  dmLabel.textContent = 'Message direct';
  nav.appendChild(dmLabel);

  const dmTeacher = document.createElement('div');
  dmTeacher.className = 'dm-teacher-item';
  dmTeacher.innerHTML = `
    <span class="dm-teacher-avatar">RF</span>
    <span>Professeur Rohan Fosse</span>
  `;
  dmTeacher.addEventListener('click', () => {
    setActiveItem(dmTeacher);
    _onDm?.({ id: user.id, promo: user.promo_id, name: 'Rohan Fosse' });
  });
  nav.appendChild(dmTeacher);

  // ── Pastilles : canaux avec travaux non rendus ───────────────────────────
  if (travaux) {
    const pendingChannels = new Set(
      travaux
        .filter(t => t.depot_id == null && t.type !== 'jalon')
        .map(t => t.channel_id)
    );
    section.querySelectorAll('[data-channel-id]').forEach(el => {
      if (pendingChannels.has(parseInt(el.dataset.channelId))) {
        const dot = document.createElement('span');
        dot.className = 'channel-pending-dot';
        el.appendChild(dot);
      }
    });
  }

  attachNavDelegation(nav);
}

// ─── Construction d'une section promo ────────────────────────────────────────

function buildPromoSection(promo, channels, students, showDms) {
  const section = document.createElement('div');
  section.className = 'promo-section';

  const annonceBadge = (type) =>
    type === 'annonce' ? `<span class="channel-annonce">Annonce</span>` : '';

  const dmRows = showDms && students.length ? `
    <div class="section-label">Messages directs</div>
    ${students.map(s => `
      <div class="dm-item"
           data-student-id="${s.id}"
           data-promo-id="${promo.id}"
           data-student-name="${escapeHtml(s.name)}"
           tabindex="0"
           role="button">
        <span class="student-avatar-sm"
              style="background:${avatarColor(s.name)};color:#fff">${escapeHtml(s.avatar_initials)}</span>
        <span>${escapeHtml(s.name)}</span>
      </div>
    `).join('')}
  ` : '';

  section.innerHTML = `
    <div class="promo-header">
      <span class="promo-dot" style="background:${promo.color}"></span>
      <span>${escapeHtml(promo.name)}</span>
      <span class="promo-chevron">&#9660;</span>
    </div>
    <div class="promo-channels">
      <div class="section-label">Canaux</div>
      ${channels.map(ch => `
        <div class="channel-item"
             data-channel-id="${ch.id}"
             data-promo-id="${promo.id}"
             data-channel-name="${escapeHtml(ch.name)}"
             data-channel-type="${ch.type}"
             tabindex="0"
             role="button">
          <span class="channel-prefix">#</span>
          <span>${escapeHtml(ch.name)}</span>
          ${annonceBadge(ch.type)}
        </div>
      `).join('')}
      ${dmRows}
    </div>
  `;

  section.querySelector('.promo-header').addEventListener('click', () => {
    section.classList.toggle('collapsed');
  });

  return section;
}

// ─── Delegation d'evenements sur le nav ──────────────────────────────────────

let _delegationAttached = false;

function attachNavDelegation(nav) {
  if (_delegationAttached) return;
  _delegationAttached = true;

  const handleNav = e => {
    const channelEl = e.target.closest('[data-channel-id]');
    const dmEl      = e.target.closest('[data-student-id]');

    if (channelEl) {
      setActiveItem(channelEl);
      _onChannel?.({
        id:    parseInt(channelEl.dataset.channelId),
        promo: parseInt(channelEl.dataset.promoId),
        name:  channelEl.dataset.channelName,
        type:  channelEl.dataset.channelType,
      });
    } else if (dmEl) {
      setActiveItem(dmEl);
      _onDm?.({
        id:    parseInt(dmEl.dataset.studentId),
        promo: parseInt(dmEl.dataset.promoId),
        name:  dmEl.dataset.studentName,
      });
    }
  };

  nav.addEventListener('click', handleNav);
  nav.addEventListener('keydown', e => { if (e.key === 'Enter') handleNav(e); });
}

export function setActiveItem(el) {
  document.querySelectorAll('.channel-item.active, .dm-item.active, .dm-teacher-item.active')
    .forEach(x => x.classList.remove('active'));
  el.classList.add('active');
}
