import { call }        from '../api.js';
import { state }       from '../state.js';
import { showToast }   from '../utils.js';
import {
  formatTime, formatDateSeparator,
  avatarColor, escapeHtml, highlightTerm,
  makeAvatar,
} from '../utils.js';

// ─── Rendu des messages ──────────────────────────────────────────────────────

export async function renderMessages(searchTerm = '') {
  const list = document.getElementById('messages-list');
  list.innerHTML = '';

  let messages = null;

  if (searchTerm && state.activeChannelId) {
    messages = await call(window.api.searchMessages, state.activeChannelId, searchTerm);
  } else if (state.activeChannelId) {
    messages = await call(window.api.getChannelMessages, state.activeChannelId);
  } else if (state.activeDmStudentId) {
    messages = await call(window.api.getDmMessages, state.activeDmStudentId);
  }

  if (!messages) return;

  // Compteur de resultats en mode recherche
  const countEl = document.getElementById('search-results-count');
  if (countEl) {
    countEl.textContent = searchTerm
      ? `${messages.length} resultat${messages.length > 1 ? 's' : ''}`
      : '';
  }

  if (!messages.length) {
    list.innerHTML = `<div class="empty-state"><p>${
      searchTerm ? 'Aucun message ne correspond a cette recherche.' : 'Aucun message pour l\'instant.'
    }</p></div>`;
    return;
  }

  let lastDateStr = null;

  for (const msg of messages) {
    const dateStr = new Date(msg.created_at).toDateString();
    if (dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.innerHTML = `<span>${formatDateSeparator(msg.created_at)}</span>`;
      list.appendChild(sep);
    }

    const row = document.createElement('div');
    row.className = 'msg-row';

    const initials = msg.author_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const bgColor  = msg.author_type === 'teacher' ? 'var(--accent)' : avatarColor(msg.author_name);
    const content  = searchTerm
      ? highlightTerm(msg.content, searchTerm)
      : escapeHtml(msg.content);

    row.appendChild(makeAvatar(initials, bgColor));
    row.insertAdjacentHTML('beforeend', `
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-author ${msg.author_type}">${escapeHtml(msg.author_name)}</span>
          <span class="msg-time">${formatTime(msg.created_at)}</span>
        </div>
        <div class="msg-content">${content}</div>
      </div>
    `);

    list.appendChild(row);
  }

  if (!searchTerm) scrollToBottom();
}

function scrollToBottom() {
  const c = document.getElementById('messages-container');
  c.scrollTop = c.scrollHeight;
}

// ─── Envoi de message ────────────────────────────────────────────────────────

export async function sendMessage() {
  const input   = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content) return;
  if (!state.activeChannelId && !state.activeDmStudentId) return;

  const ok = await call(window.api.sendMessage, {
    channelId:   state.activeChannelId   ?? null,
    dmStudentId: state.activeDmStudentId ?? null,
    authorName:  'Rohan Fosse',
    authorType:  'teacher',
    content,
  });

  if (ok === null) return;

  input.value = '';
  input.style.height = 'auto';
  await renderMessages();
}

// ─── Recherche ────────────────────────────────────────────────────────────────

export function initSearch() {
  const wrapper   = document.getElementById('search-wrapper');
  const input     = document.getElementById('search-input');
  const clearBtn  = document.getElementById('btn-search-clear');
  const btnSearch = document.getElementById('btn-search');

  btnSearch.addEventListener('click', () => {
    state.searchActive = !state.searchActive;
    wrapper.classList.toggle('hidden', !state.searchActive);
    if (state.searchActive) {
      input.value = '';
      input.focus();
      document.getElementById('search-results-count').textContent = '';
    } else {
      renderMessages();
    }
  });

  let debounce = null;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => renderMessages(input.value.trim()), 250);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    document.getElementById('search-results-count').textContent = '';
    renderMessages();
    input.focus();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.searchActive) {
      state.searchActive = false;
      wrapper.classList.add('hidden');
      input.value = '';
      renderMessages();
    }
  });
}
