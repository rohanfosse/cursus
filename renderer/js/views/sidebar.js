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
  const nav         = document.getElementById('sidebar-nav');
  const promotions  = await call(window.api.getPromotions);
  const allStudents = await call(window.api.getAllStudents);
  if (!promotions || !allStudents) return;

  nav.innerHTML = '';

  for (const promo of promotions) {
    const channels = await call(window.api.getChannels, promo.id);
    if (!channels) continue;
    const students = allStudents.filter(s => s.promo_id === promo.id);

    const section = document.createElement('div');
    section.className = 'promo-section';

    const annonceBadge = (type) =>
      type === 'annonce' ? `<span class="channel-annonce">Annonce</span>` : '';

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
               data-channel-type="${ch.type}">
            <span class="channel-prefix">#</span>
            <span>${escapeHtml(ch.name)}</span>
            ${annonceBadge(ch.type)}
          </div>
        `).join('')}
        <div class="section-label">Messages directs</div>
        ${students.map(s => `
          <div class="dm-item"
               data-student-id="${s.id}"
               data-promo-id="${promo.id}"
               data-student-name="${escapeHtml(s.name)}">
            <span class="student-avatar-sm"
                  style="background:${avatarColor(s.name)};color:#fff">${escapeHtml(s.avatar_initials)}</span>
            <span>${escapeHtml(s.name)}</span>
          </div>
        `).join('')}
      </div>
    `;

    section.querySelector('.promo-header').addEventListener('click', () => {
      section.classList.toggle('collapsed');
    });

    nav.appendChild(section);
  }

  // Delegation unique sur le nav
  nav.addEventListener('click', e => {
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
  });
}

export function setActiveItem(el) {
  document.querySelectorAll('.channel-item.active, .dm-item.active')
    .forEach(x => x.classList.remove('active'));
  el.classList.add('active');
}
