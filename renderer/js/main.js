import { state }           from './state.js';
import { renderMessages, sendMessage, initSearch } from './views/chat.js';
import { renderSidebar, initSidebar }              from './views/sidebar.js';
import { openPanel, closePanel, renderTravaux, initTravaux, bindNewTravailForm } from './views/travaux.js';
import { openDepotsModal, renderDepots, bindDepotsModal, bindNoteModal }         from './views/depots.js';
import { openSuiviModal, bindSuiviModal, openProfilPanel }                       from './views/suivi.js';
import { showLoginScreen }                         from './views/login.js';
import { renderStudentTravaux }                    from './views/student-dashboard.js';
import { openTimeline, bindTimeline }              from './views/timeline.js';
import { openRessourcesModal, bindRessourcesModal } from './views/ressources.js';
import { openEcheancier, bindEcheancier }           from './views/echeancier.js';
import { initTravauxSection, switchTravauxView, renderTravauxSidebar } from './views/travaux-main.js';
import { initDocumentsSection, bindDocumentsModal } from './views/documents-view.js';

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

  initTravaux({
    onOpenDepots:     (travail) => openDepotsModal(travail),
    onOpenSuivi:      (travail) => openSuiviModal(travail),
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
  document.getElementById('nav-btn-documents').addEventListener('click', () => switchSection('documents'));

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

  document.getElementById('btn-timeline').addEventListener('click', () => openTimeline());

  const btnEch = document.getElementById('btn-echeancier');
  if (btnEch) btnEch.addEventListener('click', () => openEcheancier());

  // ── Modal détail travail (depuis timeline) ───────────────────────────────
  // Câblé dynamiquement dans gantt.js / timeline.js
}

// ─── Basculer entre Messages / Travaux / Documents ───────────────────────────

let _currentSection = 'messages';

async function switchSection(section) {
  if (_currentSection === section) return;
  _currentSection = section;

  document.getElementById('nav-btn-messages').classList.toggle('active',   section === 'messages');
  document.getElementById('nav-btn-travaux').classList.toggle('active',    section === 'travaux');
  document.getElementById('nav-btn-documents').classList.toggle('active',  section === 'documents');

  document.getElementById('sidebar-section-messages').classList.toggle('hidden',  section !== 'messages');
  document.getElementById('sidebar-section-travaux').classList.toggle('hidden',   section !== 'travaux');
  document.getElementById('sidebar-section-documents').classList.toggle('hidden', section !== 'documents');

  document.getElementById('main-area').classList.toggle('hidden',       section !== 'messages');
  document.getElementById('travaux-area').classList.toggle('hidden',    section !== 'travaux');
  document.getElementById('documents-area').classList.toggle('hidden',  section !== 'documents');

  if (section === 'travaux') {
    await initTravauxSection();
  } else if (section === 'documents') {
    await initDocumentsSection();
  }
}

// ─── Ouverture d'un canal ────────────────────────────────────────────────────

async function openChannel(channelId, promoId, channelName, channelType) {
  state.activeChannelId   = channelId;
  state.activeDmStudentId = null;
  state.activePromoId     = promoId;
  state.activeChannelType = channelType ?? 'chat';

  if (state.rightPanel === 'profil' || state.rightPanel === 'mes-travaux') {
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
  if (state.rightPanel === 'travaux') await renderTravaux();
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
