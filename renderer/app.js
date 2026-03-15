'use strict';

// ─── Etat global ─────────────────────────────────────────────────────────────
const state = {
  activeChannelId:    null,
  activeDmStudentId:  null,
  activePromoId:      null,
  panelOpen:          false,
  currentTravailId:   null,
  pendingNoteDepotId: null,
};

// ─── Utilitaires — IPC ───────────────────────────────────────────────────────
// Tous les appels IPC renvoient { ok, data } ou { ok: false, error }.
// Cette fonction extrait data ou affiche l'erreur.

async function call(fn, ...args) {
  const result = await fn(...args);
  if (!result.ok) {
    showError(result.error ?? 'Une erreur est survenue.');
    return null;
  }
  return result.data;
}

// ─── Utilitaires — Affichage ─────────────────────────────────────────────────

let errorTimer = null;
function showError(msg) {
  const toast = document.getElementById('error-toast');
  document.getElementById('error-toast-msg').textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => toast.classList.add('hidden'), 4000);
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateSeparator(isoStr) {
  const d         = new Date(isoStr);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString())     return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function deadlineClass(deadlineStr) {
  const diff = new Date(deadlineStr).getTime() - Date.now();
  if (diff < 0)                    return 'deadline-passed';
  if (diff < 48 * 60 * 60 * 1000) return 'deadline-soon';
  return 'deadline-ok';
}

function deadlineLabel(deadlineStr) {
  const cls = deadlineClass(deadlineStr);
  if (cls === 'deadline-passed') return 'Delai depasse';
  if (cls === 'deadline-soon')   return 'Moins de 48h';
  return 'En cours';
}

function avatarColor(str) {
  const palette = [
    '#e53935','#8e24aa','#1e88e5','#00897b',
    '#43a047','#fb8c00','#6d4c41','#546e7a',
  ];
  let hash = 0;
  for (const c of str) hash = (hash << 5) - hash + c.charCodeAt(0);
  return palette[Math.abs(hash) % palette.length];
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

async function renderSidebar() {
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
    section.dataset.promoId = promo.id;

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
               data-channel-name="${escapeHtml(ch.name)}">
            <span class="channel-prefix">#</span>
            ${escapeHtml(ch.name)}
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
            ${escapeHtml(s.name)}
          </div>
        `).join('')}
      </div>
    `;

    nav.appendChild(section);

    section.querySelector('.promo-header').addEventListener('click', () => {
      section.classList.toggle('collapsed');
    });
  }

  // Delegation d'evenements unique sur le nav
  nav.addEventListener('click', e => {
    const channelEl = e.target.closest('[data-channel-id]');
    const dmEl      = e.target.closest('[data-student-id]');

    if (channelEl) {
      setActiveItem(channelEl);
      openChannel(
        parseInt(channelEl.dataset.channelId),
        parseInt(channelEl.dataset.promoId),
        channelEl.dataset.channelName
      );
    } else if (dmEl) {
      setActiveItem(dmEl);
      openDm(
        parseInt(dmEl.dataset.studentId),
        parseInt(dmEl.dataset.promoId),
        dmEl.dataset.studentName
      );
    }
  });
}

function setActiveItem(el) {
  document.querySelectorAll('.channel-item.active, .dm-item.active')
    .forEach(x => x.classList.remove('active'));
  el.classList.add('active');
}

// ─── Ouverture canal / DM ────────────────────────────────────────────────────

async function openChannel(channelId, promoId, channelName) {
  state.activeChannelId   = channelId;
  state.activeDmStudentId = null;
  state.activePromoId     = promoId;

  document.getElementById('channel-icon').textContent = '#';
  document.getElementById('channel-name').textContent = channelName ?? '';
  document.getElementById('message-input').placeholder = `Envoyer dans #${channelName ?? ''}`;
  document.getElementById('btn-travaux').style.display = '';

  await renderMessages();
  if (state.panelOpen) await renderTravaux();
}

async function openDm(studentId, promoId, studentName) {
  state.activeDmStudentId = studentId;
  state.activeChannelId   = null;
  state.activePromoId     = promoId;

  document.getElementById('channel-icon').textContent = '@';
  document.getElementById('channel-name').textContent = studentName ?? '';
  document.getElementById('message-input').placeholder = `Message prive a ${studentName ?? ''}`;
  document.getElementById('btn-travaux').style.display = 'none';

  closeTravauxPanel();
  await renderMessages();
}

// ─── Messages ────────────────────────────────────────────────────────────────

async function renderMessages() {
  const list = document.getElementById('messages-list');
  list.innerHTML = '';

  let messages;
  if (state.activeChannelId) {
    messages = await call(window.api.getChannelMessages, state.activeChannelId);
  } else if (state.activeDmStudentId) {
    messages = await call(window.api.getDmMessages, state.activeDmStudentId);
  } else {
    return;
  }

  if (!messages) return;

  if (!messages.length) {
    list.innerHTML = `
      <div class="empty-state">
        <p>Aucun message pour l'instant.<br>Soyez le premier a ecrire.</p>
      </div>
    `;
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

    const initials = msg.author_type === 'teacher'
      ? msg.author_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
      : msg.author_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    const bgColor = msg.author_type === 'teacher'
      ? 'var(--accent)'
      : avatarColor(msg.author_name);

    const avatarEl = document.createElement('div');
    avatarEl.className = 'msg-avatar';
    avatarEl.style.background = bgColor;
    avatarEl.style.color = '#fff';
    avatarEl.textContent = initials;

    row.innerHTML = `
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-author ${msg.author_type}">${escapeHtml(msg.author_name)}</span>
          <span class="msg-time">${formatTime(msg.created_at)}</span>
        </div>
        <div class="msg-content">${escapeHtml(msg.content)}</div>
      </div>
    `;
    row.insertBefore(avatarEl, row.firstChild);
    list.appendChild(row);
  }

  const container = document.getElementById('messages-container');
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input   = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content) return;
  if (!state.activeChannelId && !state.activeDmStudentId) return;

  const result = await call(window.api.sendMessage, {
    channelId:   state.activeChannelId   ?? null,
    dmStudentId: state.activeDmStudentId ?? null,
    authorName:  'Rohan Fosse',
    authorType:  'teacher',
    content,
  });

  if (result === null) return; // erreur deja affichee

  input.value = '';
  input.style.height = 'auto';
  await renderMessages();
}

// ─── Panel Travaux ───────────────────────────────────────────────────────────

function openTravauxPanel() {
  state.panelOpen = true;
  document.getElementById('panel-travaux').classList.remove('hidden');
  if (state.activeChannelId) renderTravaux();
}

function closeTravauxPanel() {
  state.panelOpen = false;
  document.getElementById('panel-travaux').classList.add('hidden');
}

async function renderTravaux() {
  if (!state.activeChannelId) return;

  const list    = document.getElementById('travaux-list');
  const travaux = await call(window.api.getTravaux, state.activeChannelId);
  if (!travaux) return;

  list.innerHTML = '';

  if (!travaux.length) {
    list.innerHTML = `<div class="empty-state"><p>Aucun travail pour ce canal.</p></div>`;
    return;
  }

  for (const t of travaux) {
    const cls   = deadlineClass(t.deadline);
    const label = deadlineLabel(t.deadline);
    const count = t.depots_count ?? 0;

    const card = document.createElement('div');
    card.className = 'travail-card';
    card.innerHTML = `
      <div class="travail-title">${escapeHtml(t.title)}</div>
      <div class="travail-desc">${escapeHtml(t.description ?? '')}</div>
      <span class="deadline-badge ${cls}">${label} — ${formatDate(t.deadline)}</span>
      <div class="depots-count">${count} depot${count > 1 ? 's' : ''}</div>
    `;
    card.addEventListener('click', () => openDepotsModal(t));
    list.appendChild(card);
  }
}

// ─── Modal Depots ─────────────────────────────────────────────────────────────

async function openDepotsModal(travail) {
  state.currentTravailId = travail.id;

  document.getElementById('modal-title').textContent = travail.title;

  // Peupler le select d'etudiants
  await populateStudentSelect();

  await renderDepots(travail.id);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

async function populateStudentSelect() {
  const select = document.getElementById('depot-student-select');
  select.innerHTML = '<option value="">Selectionner un etudiant</option>';
  if (!state.activePromoId) return;

  const students = await call(window.api.getStudents, state.activePromoId);
  if (!students) return;

  for (const s of students) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    select.appendChild(opt);
  }
}

async function renderDepots(travailId) {
  const body   = document.getElementById('modal-body');
  const depots = await call(window.api.getDepots, travailId);
  if (!depots) return;

  body.innerHTML = '';

  if (!depots.length) {
    body.innerHTML = `<div class="empty-state"><p>Aucun depot pour l'instant.</p></div>`;
    return;
  }

  for (const d of depots) {
    const row = document.createElement('div');
    row.className = 'depot-row';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'msg-avatar';
    avatarEl.style.cssText = 'width:32px;height:32px;font-size:11px';
    avatarEl.style.background = avatarColor(d.student_name);
    avatarEl.style.color = '#fff';
    avatarEl.textContent = d.avatar_initials;

    const info = document.createElement('div');
    info.className = 'depot-info';
    info.innerHTML = `
      <div class="depot-student">${escapeHtml(d.student_name)}</div>
      <div class="depot-file" title="${escapeHtml(d.file_name)}">${escapeHtml(d.file_name)}</div>
      <div class="depot-date">Depose le ${formatDate(d.submitted_at)}</div>
    `;

    row.appendChild(avatarEl);
    row.appendChild(info);

    if (d.note != null) {
      const badge = document.createElement('span');
      badge.className = 'note-badge';
      badge.textContent = `${d.note}/20`;
      row.appendChild(badge);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn-set-note';
      btn.textContent = 'Attribuer une note';
      btn.addEventListener('click', () => openNoteModal(d.id));
      row.appendChild(btn);
    }

    body.appendChild(row);
  }
}

// ─── Modal Note ───────────────────────────────────────────────────────────────

function openNoteModal(depotId) {
  state.pendingNoteDepotId = depotId;
  document.getElementById('note-input').value = '';
  document.getElementById('note-error').textContent = '';
  document.getElementById('modal-note-overlay').classList.remove('hidden');
  document.getElementById('note-input').focus();
}

function closeNoteModal() {
  document.getElementById('modal-note-overlay').classList.add('hidden');
  state.pendingNoteDepotId = null;
}

// ─── Modal Nouveau Travail ────────────────────────────────────────────────────

function openNewTravailModal() {
  document.getElementById('modal-new-travail-overlay').classList.remove('hidden');
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const iso = new Date(twoWeeks - twoWeeks.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
  document.getElementById('nt-deadline').value = iso;
  document.getElementById('nt-title').focus();
}

function closeNewTravailModal() {
  document.getElementById('modal-new-travail-overlay').classList.add('hidden');
  document.getElementById('form-new-travail').reset();
}

// ─── Initialisation & evenements ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await renderSidebar();

  // — Envoi de message
  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('message-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  document.getElementById('message-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  // — Panel travaux
  document.getElementById('btn-travaux').addEventListener('click', () => {
    state.panelOpen ? closeTravauxPanel() : openTravauxPanel();
  });
  document.getElementById('btn-close-panel').addEventListener('click', closeTravauxPanel);

  // — Nouveau travail
  document.getElementById('btn-new-travail').addEventListener('click', openNewTravailModal);
  document.getElementById('btn-cancel-travail').addEventListener('click', closeNewTravailModal);
  document.getElementById('modal-new-travail-close').addEventListener('click', closeNewTravailModal);
  document.getElementById('modal-new-travail-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-new-travail-overlay')) closeNewTravailModal();
  });

  document.getElementById('form-new-travail').addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.activeChannelId) {
      showError('Selectionnez d\'abord un canal.');
      return;
    }
    const title       = document.getElementById('nt-title').value.trim();
    const description = document.getElementById('nt-description').value.trim();
    const deadline    = document.getElementById('nt-deadline').value;
    if (!title || !deadline) return;

    const result = await call(window.api.createTravail, {
      channelId: state.activeChannelId,
      title,
      description,
      deadline: deadline.replace('T', ' ') + ':00',
    });
    if (result === null) return;

    closeNewTravailModal();
    await renderTravaux();
  });

  // — Modal depots : fermeture
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  });
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) {
      document.getElementById('modal-overlay').classList.add('hidden');
    }
  });

  // — Modal depots : depot de fichier
  document.getElementById('modal-depot-btn').addEventListener('click', async () => {
    const studentId = parseInt(document.getElementById('depot-student-select').value);
    if (!studentId) {
      showError('Selectionnez un etudiant avant de deposer un fichier.');
      return;
    }

    const result = await call(window.api.openFileDialog);
    if (result === null) return;  // dialogue annule ou erreur
    const filePath = result;
    if (!filePath) return;        // dialogue annule sans erreur

    const fileName = filePath.split(/[\\/]/).pop();

    const depotResult = await call(window.api.addDepot, {
      travailId: state.currentTravailId,
      studentId,
      fileName,
      filePath,
    });
    if (depotResult === null) return;

    await renderDepots(state.currentTravailId);
    await renderTravaux();
  });

  // — Modal note : confirmer
  document.getElementById('modal-note-confirm').addEventListener('click', async () => {
    const raw    = document.getElementById('note-input').value.replace(',', '.');
    const parsed = parseFloat(raw);

    if (isNaN(parsed) || parsed < 0 || parsed > 20) {
      document.getElementById('note-error').textContent = 'Entrez un nombre entre 0 et 20.';
      return;
    }
    document.getElementById('note-error').textContent = '';

    const result = await call(window.api.setNote, {
      depotId: state.pendingNoteDepotId,
      note: parsed,
    });
    if (result === null) return;

    closeNoteModal();
    await renderDepots(state.currentTravailId);
    await renderTravaux();
  });

  // Valider la note avec Entree
  document.getElementById('note-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('modal-note-confirm').click();
  });

  // — Modal note : annuler / fermer
  document.getElementById('modal-note-cancel').addEventListener('click', closeNoteModal);
  document.getElementById('modal-note-close').addEventListener('click',  closeNoteModal);
  document.getElementById('modal-note-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-note-overlay')) closeNoteModal();
  });
});
