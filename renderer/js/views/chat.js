import { call }        from '../api.js';
import { state }       from '../state.js';
import { showToast }   from '../utils.js';
import {
  formatTime, formatDateSeparator,
  avatarColor, escapeHtml, highlightTerm,
  makeAvatar,
} from '../utils.js';
import { refreshLucide } from '../lucide.js';

const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

// ─── Réactions en mémoire ────────────────────────────────────────────────────

const _reactions = new Map(); // msgId -> { check, thumb, bulb, question, eye }
const _userVotes = new Map(); // msgId -> Set<type>

const REACT_TYPES = [
  { type: 'check',    icon: 'check'       },
  { type: 'thumb',    icon: 'thumbs-up'   },
  { type: 'bulb',     icon: 'lightbulb'   },
  { type: 'question', icon: 'help-circle' },
  { type: 'eye',      icon: 'eye'         },
];

function _initReactions(msgId, dbJson) {
  if (_reactions.has(msgId)) return;
  const base = { check: 0, thumb: 0, bulb: 0, question: 0, eye: 0 };
  if (dbJson) { try { Object.assign(base, JSON.parse(dbJson)); } catch {} }
  _reactions.set(msgId, base);
  if (!_userVotes.has(msgId)) _userVotes.set(msgId, new Set());
}

function _renderReactions(msgId) {
  const el = document.getElementById(`react-${msgId}`);
  if (!el) return;
  const r    = _reactions.get(msgId) ?? {};
  const mine = _userVotes.get(msgId) ?? new Set();
  el.innerHTML = REACT_TYPES
    .filter(t => (r[t.type] ?? 0) > 0)
    .map(t => `<button class="msg-reaction-pill${mine.has(t.type) ? ' mine' : ''}"
        data-msg-id="${msgId}" data-react-type="${t.type}" aria-label="Réaction ${t.type}">
      <i data-lucide="${t.icon}" aria-hidden="true"></i>
      <span>${r[t.type]}</span>
    </button>`)
    .join('');
  refreshLucide();
}

function _toggleReact(msgId, type) {
  const r    = _reactions.get(msgId);
  const mine = _userVotes.get(msgId);
  if (!r || !mine) return;
  if (mine.has(type)) { mine.delete(type); r[type] = Math.max(0, (r[type] ?? 1) - 1); }
  else               { mine.add(type);    r[type] = (r[type] ?? 0) + 1; }
  _renderReactions(msgId);
}

// ─── Picker de réactions ─────────────────────────────────────────────────────

let _pickerTarget = null;

function _showPicker(btn, msgId) {
  let picker = document.getElementById('reaction-picker');
  if (!picker) {
    picker = document.createElement('div');
    picker.id        = 'reaction-picker';
    picker.className = 'reaction-picker hidden';
    picker.innerHTML = REACT_TYPES.map(t =>
      `<button class="reaction-picker-btn" data-type="${t.type}" aria-label="${t.type}">
        <i data-lucide="${t.icon}" aria-hidden="true"></i>
      </button>`
    ).join('');
    document.body.appendChild(picker);
    refreshLucide();

    picker.addEventListener('click', e => {
      const b = e.target.closest('[data-type]');
      if (!b || _pickerTarget === null) return;
      _toggleReact(_pickerTarget, b.dataset.type);
      picker.classList.add('hidden');
      _pickerTarget = null;
    });
    document.addEventListener('click', e => {
      if (!picker.classList.contains('hidden')
          && !picker.contains(e.target)
          && !e.target.closest('.add-reaction-btn')) {
        picker.classList.add('hidden');
        _pickerTarget = null;
      }
    }, true);
  }

  if (!picker.classList.contains('hidden') && _pickerTarget === msgId) {
    picker.classList.add('hidden');
    _pickerTarget = null;
    return;
  }
  _pickerTarget = msgId;
  const rect = btn.getBoundingClientRect();
  picker.style.top  = (rect.top - 52) + 'px';
  picker.style.left = Math.max(4, rect.left - 60) + 'px';
  picker.classList.remove('hidden');
}

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
  let prevAuthor  = null;
  let prevTime    = null;

  const isTeacher = state.currentUser?.type === 'teacher';

  for (const msg of messages) {
    _initReactions(msg.id, msg.reactions);

    const dateStr = new Date(msg.created_at).toDateString();
    if (dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      prevAuthor  = null;
      prevTime    = null;
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.innerHTML = `<span>${formatDateSeparator(msg.created_at)}</span>`;
      list.appendChild(sep);
    }

    const msgTime   = new Date(msg.created_at).getTime();
    const isGrouped = !searchTerm
      && prevAuthor === msg.author_name
      && prevTime !== null
      && (msgTime - prevTime) < GROUP_THRESHOLD_MS;

    prevAuthor = msg.author_name;
    prevTime   = msgTime;

    const content = searchTerm
      ? highlightTerm(msg.content, searchTerm)
      : escapeHtml(msg.content);

    const hoverActions = `
      <div class="msg-hover-actions">
        ${isTeacher && state.activeChannelId ? `
          <button class="msg-action-btn msg-pin-btn${msg.pinned ? ' pinned' : ''}"
                  data-msg-id="${msg.id}" data-pinned="${msg.pinned ? 1 : 0}"
                  title="${msg.pinned ? 'Désépingler' : 'Épingler'}" aria-label="${msg.pinned ? 'Désépingler' : 'Épingler'}">
            <i data-lucide="pin" aria-hidden="true"></i>
          </button>` : ''}
        <button class="msg-action-btn add-reaction-btn"
                data-msg-id="${msg.id}" title="Réagir" aria-label="Ajouter une réaction">
          <i data-lucide="smile-plus" aria-hidden="true"></i>
        </button>
      </div>`;

    const row = document.createElement('div');

    if (isGrouped) {
      row.className = 'msg-row msg-grouped';
      row.dataset.msgId = msg.id;
      row.innerHTML = `
        <div class="msg-grouped-time">${formatTime(msg.created_at)}</div>
        <div class="msg-body">
          <div class="msg-content">${content}</div>
          <div class="msg-reactions-list" id="react-${msg.id}"></div>
        </div>
        ${hoverActions}
      `;
    } else {
      row.className = 'msg-row';
      row.dataset.msgId = msg.id;
      const initials = msg.author_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const bgColor  = msg.author_type === 'teacher' ? 'var(--accent)' : avatarColor(msg.author_name);
      row.appendChild(makeAvatar(initials, bgColor));
      row.insertAdjacentHTML('beforeend', `
        <div class="msg-body">
          <div class="msg-meta">
            <span class="msg-author ${msg.author_type}">${escapeHtml(msg.author_name)}</span>
            <span class="msg-time">${formatTime(msg.created_at)}</span>
          </div>
          <div class="msg-content">${content}</div>
          <div class="msg-reactions-list" id="react-${msg.id}"></div>
        </div>
        ${hoverActions}
      `);
    }

    list.appendChild(row);
    _renderReactions(msg.id);
  }

  if (!searchTerm) scrollToBottom();
  refreshLucide();

  // ── Délégation unique : pin + react-btn + pilules ────────────────────────
  if (!list._handlerBound) {
    list._handlerBound = true;
    list.addEventListener('click', async e => {
      const pin = e.target.closest('.msg-pin-btn');
      if (pin) {
        const msgId  = parseInt(pin.dataset.msgId);
        const pinned = pin.dataset.pinned === '1' ? 0 : 1;
        await call(window.api.togglePinMessage, { messageId: msgId, pinned });
        await renderMessages();
        await renderPinnedBanner(state.activeChannelId);
        return;
      }
      const reactBtn = e.target.closest('.add-reaction-btn');
      if (reactBtn) {
        _showPicker(reactBtn, parseInt(reactBtn.dataset.msgId));
        return;
      }
      const pill = e.target.closest('.msg-reaction-pill');
      if (pill) {
        _toggleReact(parseInt(pill.dataset.msgId), pill.dataset.reactType);
        return;
      }
    });
  }
}

// ─── Bannière messages épinglés ───────────────────────────────────────────────

export async function renderPinnedBanner(channelId) {
  const banner = document.getElementById('pinned-messages-banner');
  const listEl = document.getElementById('pinned-messages-list');
  if (!banner || !listEl) return;

  if (!channelId) { banner.classList.add('hidden'); return; }

  const msgs = await call(window.api.getPinnedMessages, channelId);
  if (!msgs || !msgs.length) { banner.classList.add('hidden'); return; }

  listEl.innerHTML = msgs.map(m => `
    <div class="pinned-msg-item">
      <span class="pinned-msg-author">${escapeHtml(m.author_name)}</span>
      <span class="pinned-msg-content">${escapeHtml(m.content.slice(0, 80))}${m.content.length > 80 ? '…' : ''}</span>
    </div>
  `).join('');

  banner.classList.remove('hidden');
  refreshLucide();
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

  const user = state.currentUser;

  const ok = await call(window.api.sendMessage, {
    channelId:   state.activeChannelId   ?? null,
    dmStudentId: state.activeDmStudentId ?? null,
    authorName:  user?.name ?? 'Inconnu',
    authorType:  user?.type ?? 'student',
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
