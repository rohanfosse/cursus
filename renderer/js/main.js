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

document.addEventListener('DOMContentLoaded', async () => {

  // ── Ecran de connexion ────────────────────────────────────────────────────

  await showLoginScreen(onLogin);
});

async function onLogin(user) {

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

  // ── Adapter l'interface selon le role ─────────────────────────────────────

  const isStudent = user.type === 'student';

  // Les etudiants ne voient pas le bouton "Travaux" (panel prof)
  // mais ont acces a "Mes travaux"
  const btnTravaux     = document.getElementById('btn-travaux');
  const btnMesTravaux  = document.getElementById('btn-mes-travaux');

  if (isStudent) {
    btnTravaux.style.display = 'none';
    if (btnMesTravaux) btnMesTravaux.style.display = '';
  } else {
    if (btnMesTravaux) btnMesTravaux.style.display = 'none';
  }

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

  // ── Bouton Travaux (professeur) ───────────────────────────────────────────

  btnTravaux.addEventListener('click', () => {
    if (state.rightPanel === 'travaux') closePanel();
    else openPanel();
  });

  // ── Bouton Mes travaux (etudiant) ─────────────────────────────────────────

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

  // ── Modals ────────────────────────────────────────────────────────────────

  bindNewTravailForm();
  bindDepotsModal();
  bindNoteModal();
  bindSuiviModal();
  bindRessourcesModal();
  bindTimeline();

  document.getElementById('btn-timeline').addEventListener('click', () => openTimeline());
}

// ─── Ouverture d'un canal ────────────────────────────────────────────────────

async function openChannel(channelId, promoId, channelName, channelType) {
  state.activeChannelId   = channelId;
  state.activeDmStudentId = null;
  state.activePromoId     = promoId;
  state.activeChannelType = channelType ?? 'chat';

  // Fermer le profil si ouvert, garder travaux
  if (state.rightPanel === 'profil' || state.rightPanel === 'mes-travaux') {
    state.rightPanel = null;
    document.getElementById('right-panel').classList.add('hidden');
  }

  // Header
  document.getElementById('channel-icon').textContent = '#';
  document.getElementById('channel-name').textContent = channelName ?? '';

  const badge = document.getElementById('channel-type-badge');
  if (channelType === 'annonce') {
    badge.textContent = 'Annonce';
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  // Input : canal d'annonce — lecture seule pour les etudiants
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

  // DMs accessibles au professeur seulement
  if (state.currentUser?.type === 'teacher') {
    document.getElementById('btn-travaux').style.display = 'none';
    await openProfilPanel(studentId);
    if (state.rightPanel === 'travaux') closePanel();
  }

  await renderMessages();
}
