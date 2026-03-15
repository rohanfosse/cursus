import { state }           from './state.js';
import { call }            from './api.js';
import { deadlineClass }   from './utils.js';
import { renderMessages, sendMessage, initSearch, renderPinnedBanner } from './views/chat.js';
import { renderSidebar, initSidebar }              from './views/sidebar.js';
import { openPanel, closePanel, renderTravaux, initTravaux, bindNewTravailForm } from './views/travaux.js';
import { bindDepotsModal, bindNoteModal }                                        from './views/depots.js';
import { bindSuiviModal, openProfilPanel }                                       from './views/suivi.js';
import { openGestionDevoir, bindGestionDevoir }                                  from './views/gestion-devoir.js';
import { showLoginScreen }                         from './views/login.js';
import { renderStudentTravaux }                    from './views/student-dashboard.js';
import { openTimeline, bindTimeline }              from './views/timeline.js';
import { openRessourcesModal, bindRessourcesModal } from './views/ressources.js';
import { openEcheancier, bindEcheancier }           from './views/echeancier.js';
import { initTravauxSection, switchTravauxView, renderTravauxSidebar } from './views/travaux-main.js';
import { initDocumentsSection, bindDocumentsModal } from './views/documents-view.js';
import { openSettings, bindSettings, getPref }      from './views/settings.js';
import { initCmdPalette }                           from './views/cmd-palette.js';

document.addEventListener('DOMContentLoaded', async () => {
  await showLoginScreen(onLogin);
});

async function onLogin(user) {

  // ── Mettre à jour le mini-avatar dans le nav-rail ─────────────────────────
  const navAvatar = document.getElementById('nav-user-avatar');
  if (navAvatar) {
    if (user.photo_data) {
      navAvatar.innerHTML = `<img src="${user.photo_data}" alt="${user.name}">`;
    } else {
      navAvatar.textContent = (user.avatar_initials ?? user.name.slice(0,2)).toUpperCase();
      navAvatar.style.background = user.type === 'teacher' ? 'var(--accent)' : '#666';
    }
    navAvatar.title = user.name;
  }

  // ── Initialisation des vues ───────────────────────────────────────────────

  initSidebar({
    onChannel: ({ id, promo, name, type }) => openChannel(id, promo, name, type),
    onDm:      ({ id, promo, name })       => openDm(id, promo, name),
  });

  initCmdPalette({
    onChannel: ({ id, promo, name, type }) => openChannel(id, promo, name, type),
    onDm:      ({ id, promo, name })       => openDm(id, promo, name),
    onSection: (section) => switchSection(section),
  });

  // ── Bouton recherche globale dans la barre de titre ───────────────────────
  document.getElementById('global-search-btn')?.addEventListener('click', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  });

  // ── Fermeture visionneuse document (touche Échap) ─────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('document-preview-overlay')?.classList.add('hidden');
    }
  });

  _initResizeHandles();

  initTravaux({
    onOpenGestion:    (travail) => openGestionDevoir(travail),
    onOpenRessources: (travail) => openRessourcesModal(travail),
  });

  initSearch();

  // ── Adapter l'interface selon le rôle ─────────────────────────────────────

  const isStudent = user.type === 'student';
  const btnTravaux     = document.getElementById('btn-travaux');
  const btnMesTravaux  = document.getElementById('btn-mes-travaux');
  const btnEcheancier  = document.getElementById('btn-echeancier');

  if (isStudent) {
    btnTravaux.style.display    = 'none';
    if (btnMesTravaux)  btnMesTravaux.style.display  = '';
    if (btnEcheancier)  btnEcheancier.style.display  = 'none';
  } else {
    if (btnMesTravaux)  btnMesTravaux.style.display  = 'none';
    if (btnEcheancier)  btnEcheancier.style.display  = '';
  }

  // ── Navigation rail ───────────────────────────────────────────────────────

  document.getElementById('nav-btn-messages').addEventListener('click',  () => switchSection('messages'));
  document.getElementById('nav-btn-travaux').addEventListener('click',   () => switchSection('travaux'));
  document.getElementById('nav-btn-documents').addEventListener('click', () => toggleDocumentsPanel());

  // Avatar → Paramètres
  document.getElementById('nav-user-avatar').addEventListener('click', () => openSettings());

  // ── Chargement initial ────────────────────────────────────────────────────

  await renderSidebar();

  // ── Envoi de message ──────────────────────────────────────────────────────

  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('message-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('message-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  // ── Bouton Travaux (professeur — panel droit) ──────────────────────────────

  btnTravaux.addEventListener('click', () => {
    if (state.rightPanel === 'travaux') closePanel();
    else openPanel();
  });

  // ── Bouton Mes travaux (étudiant) ─────────────────────────────────────────

  if (btnMesTravaux) {
    btnMesTravaux.addEventListener('click', () => {
      if (state.rightPanel === 'mes-travaux') {
        state.rightPanel = null;
        document.getElementById('right-panel').classList.add('hidden');
      } else {
        renderStudentTravaux();
      }
    });
  }

  // ── Vue Gantt / rendus (section travaux) ──────────────────────────────────

  document.getElementById('btn-view-gantt').addEventListener('click', () => switchTravauxView('gantt'));
  document.getElementById('btn-view-rendus').addEventListener('click', () => switchTravauxView('rendus'));

  // ── Modals ────────────────────────────────────────────────────────────────

  bindNewTravailForm();
  bindDepotsModal();
  bindNoteModal();
  bindSuiviModal();
  bindRessourcesModal();
  bindTimeline();
  bindEcheancier();
  bindDocumentsModal();
  bindGestionDevoir();
  bindSettings();

  document.getElementById('btn-timeline').addEventListener('click', () => openTimeline());

  const btnEch = document.getElementById('btn-echeancier');
  if (btnEch) btnEch.addEventListener('click', () => openEcheancier());

  // ── Bouton fermeture du panneau Documents ─────────────────────────────────
  document.getElementById('btn-close-doc-panel')?.addEventListener('click', () => toggleDocumentsPanel(false));

  // ── Badge Travaux + écoute de dépôt réussi ───────────────────────────────
  await updateTravauxBadge();
  document.addEventListener('depot:success', () => updateTravauxBadge());

  // ── Préférence : Documents ouverts par défaut ─────────────────────────────
  if (getPref('docsOpenByDefault')) {
    await toggleDocumentsPanel(true);
  }

  // ── Fermeture du right-panel en cliquant en dehors (petits écrans) ────────
  document.addEventListener('click', e => {
    if (window.innerWidth > 1100) return;
    const panel = document.getElementById('right-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    if (!panel.contains(e.target)) {
      state.rightPanel = null;
      panel.classList.add('hidden');
    }
  });

  // ── Fermeture du panneau Documents en cliquant en dehors (petits écrans) ──
  document.addEventListener('click', e => {
    if (window.innerWidth > 1280) return;
    const panel = document.getElementById('documents-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    if (!panel.contains(e.target) && !document.getElementById('nav-btn-documents').contains(e.target)) {
      toggleDocumentsPanel(false);
    }
  });

  // ── Modal détail travail (depuis timeline) ───────────────────────────────
  // Câblé dynamiquement dans gantt.js / timeline.js
}

// ─── Badge Travaux ─────────────────────────────────────────────────────────

async function updateTravauxBadge() {
  const badge = document.getElementById('nav-badge-travaux');
  if (!badge) return;
  const user = state.currentUser;
  if (!user || user.type !== 'student') return;

  const travaux = await call(window.api.getStudentTravaux, user.id);
  const pending = (travaux ?? []).filter(t => t.depot_id == null && t.type !== 'jalon');
  badge.classList.toggle('hidden', pending.length === 0);
  badge.textContent = pending.length > 9 ? '9+' : String(pending.length || '');
}

// ─── Panneau Documents (toggle) ──────────────────────────────────────────────

let _documentsOpen = false;

async function toggleDocumentsPanel(forceOpen) {
  const shouldOpen = forceOpen !== undefined ? forceOpen : !_documentsOpen;
  if (shouldOpen === _documentsOpen) return;
  _documentsOpen = shouldOpen;

  const panel = document.getElementById('documents-panel');
  panel.classList.toggle('hidden', !_documentsOpen);
  document.getElementById('nav-btn-documents').classList.toggle('active', _documentsOpen);

  if (_documentsOpen) {
    await initDocumentsSection();
  }
}

// ─── Basculer entre Messages / Travaux ───────────────────────────────────────

let _currentSection = 'messages';

async function switchSection(section) {
  if (_currentSection === section) return;
  _currentSection = section;

  document.getElementById('nav-btn-messages').classList.toggle('active', section === 'messages');
  document.getElementById('nav-btn-travaux').classList.toggle('active',  section === 'travaux');

  document.getElementById('sidebar-section-messages').classList.toggle('hidden', section !== 'messages');
  document.getElementById('sidebar-section-travaux').classList.toggle('hidden',  section !== 'travaux');

  document.getElementById('main-area').classList.toggle('hidden',    section !== 'messages');
  document.getElementById('travaux-area').classList.toggle('hidden', section !== 'travaux');
  if (section !== 'messages') document.getElementById('channel-pending-banner')?.remove();

  if (section === 'travaux') {
    await initTravauxSection();
  }
}

// ─── Redimensionnement des panneaux latéraux ─────────────────────────────────

function _initResizeHandles() {
  _makeResizable('right-panel',     250, 650);
  _makeResizable('documents-panel', 220, 650);
}

function _makeResizable(panelId, minW, maxW) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  panel.prepend(handle);

  let startX, startW;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = panel.getBoundingClientRect().width;
    document.body.classList.add('resizing');

    const onMove = ev => {
      panel.style.transition = 'none';
      const newW = Math.min(maxW, Math.max(minW, startW - (ev.clientX - startX)));
      panel.style.width    = newW + 'px';
      panel.style.minWidth = newW + 'px';
    };

    const onUp = () => {
      panel.style.transition = '';
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// ─── Ouverture d'un canal ────────────────────────────────────────────────────

async function openChannel(channelId, promoId, channelName, channelType) {
  state.activeChannelId   = channelId;
  state.activeDmStudentId = null;
  state.activePromoId     = promoId;
  state.activeChannelType = channelType ?? 'chat';

  // Fermer le panneau droit à chaque changement de canal
  if (state.rightPanel) {
    state.rightPanel = null;
    document.getElementById('right-panel').classList.add('hidden');
  }

  document.getElementById('channel-icon').textContent = '#';
  document.getElementById('channel-name').textContent = channelName ?? '';

  const badge = document.getElementById('channel-type-badge');
  if (channelType === 'annonce') {
    badge.textContent = 'Annonce';
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  const inputArea = document.getElementById('message-input-area');
  const inputEl   = document.getElementById('message-input');
  const isStudent = state.currentUser?.type === 'student';
  const readonly  = channelType === 'annonce' && isStudent;

  if (readonly) {
    inputEl.placeholder = 'Canal d\'annonces';
    inputArea.classList.add('readonly');
    document.getElementById('message-input-wrapper').classList.add('hidden');
    let notice = document.getElementById('readonly-notice');
    if (!notice) {
      notice = document.createElement('p');
      notice.id        = 'readonly-notice';
      notice.className = 'readonly-notice';
      notice.textContent = 'Ce canal est en lecture seule.';
      inputArea.appendChild(notice);
    }
  } else {
    inputArea.classList.remove('readonly');
    document.getElementById('message-input-wrapper').classList.remove('hidden');
    const notice = document.getElementById('readonly-notice');
    if (notice) notice.remove();
    inputEl.placeholder = `Envoyer dans #${channelName ?? ''}`;
  }

  const btnTravaux = document.getElementById('btn-travaux');
  if (state.currentUser?.type === 'teacher') {
    btnTravaux.style.display = '';
  }

  await renderMessages();
  await renderPinnedBanner(channelId);
  if (state.rightPanel === 'travaux') await renderTravaux();

  // ── Bannière travaux en attente (étudiant) ───────────────────────────────
  document.getElementById('channel-pending-banner')?.remove();
  if (state.currentUser?.type === 'student' && channelId) {
    const travaux = await call(window.api.getStudentTravaux, state.currentUser.id);
    const pending = (travaux ?? []).filter(t =>
      t.channel_id === channelId && t.depot_id == null && t.type !== 'jalon'
    );
    if (pending.length) {
      const hasUrgent = pending.some(t =>
        ['deadline-passed', 'deadline-critical'].includes(deadlineClass(t.deadline))
      );
      const banner = document.createElement('div');
      banner.id = 'channel-pending-banner';
      banner.className = `channel-pending-banner${hasUrgent ? ' channel-pending-urgent' : ''}`;
      banner.innerHTML = `
        <span>📋 ${pending.length} travail${pending.length > 1 ? 'x' : ''} à rendre dans ce canal${hasUrgent ? ' — <strong>urgent !</strong>' : ''}</span>
        <button class="btn-primary" style="font-size:11px;padding:3px 10px" id="btn-banner-travaux">Voir mes travaux</button>
      `;
      banner.querySelector('#btn-banner-travaux').addEventListener('click', () => {
        document.getElementById('nav-btn-travaux').click();
      });
      document.getElementById('messages-container').prepend(banner);
    }
  }
}

// ─── Ouverture d'un DM ───────────────────────────────────────────────────────

async function openDm(studentId, promoId, studentName) {
  state.activeDmStudentId = studentId;
  state.activeChannelId   = null;
  state.activePromoId     = promoId;
  state.activeChannelType = 'chat';

  document.getElementById('channel-icon').textContent = '@';
  document.getElementById('channel-name').textContent = studentName ?? '';
  document.getElementById('channel-type-badge').classList.add('hidden');
  document.getElementById('message-input').placeholder = `Message prive — ${studentName ?? ''}`;

  if (state.currentUser?.type === 'teacher') {
    document.getElementById('btn-travaux').style.display = 'none';
    await openProfilPanel(studentId);
    if (state.rightPanel === 'travaux') closePanel();
  }

  await renderMessages();
}
