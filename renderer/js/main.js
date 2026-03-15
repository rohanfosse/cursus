import { state }           from './state.js';
import { renderMessages, sendMessage, initSearch } from './views/chat.js';
import { renderSidebar, initSidebar }              from './views/sidebar.js';
import { openPanel, closePanel, renderTravaux, initTravaux, bindNewTravailForm } from './views/travaux.js';
import { openDepotsModal, renderDepots, bindDepotsModal, bindNoteModal }         from './views/depots.js';
import { openSuiviModal, bindSuiviModal, openProfilPanel }                       from './views/suivi.js';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Initialisation des vues ───────────────────────────────────────────────

  initSidebar({
    onChannel: ({ id, promo, name, type }) => openChannel(id, promo, name, type),
    onDm:      ({ id, promo, name })       => openDm(id, promo, name),
  });

  initTravaux({
    onOpenDepots: (travail) => openDepotsModal(travail),
    onOpenSuivi:  (travail) => openSuiviModal(travail),
  });

  initSearch();

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

  // ── Bouton Travaux ────────────────────────────────────────────────────────

  document.getElementById('btn-travaux').addEventListener('click', () => {
    if (state.rightPanel === 'travaux') closePanel();
    else openPanel();
  });

  // ── Modals ────────────────────────────────────────────────────────────────

  bindNewTravailForm();
  bindDepotsModal();
  bindNoteModal();
  bindSuiviModal();
});

// ─── Ouverture d'un canal ────────────────────────────────────────────────────

async function openChannel(channelId, promoId, channelName, channelType) {
  state.activeChannelId   = channelId;
  state.activeDmStudentId = null;
  state.activePromoId     = promoId;
  state.activeChannelType = channelType ?? 'chat';

  // Fermer le profil si ouvert, garder travaux
  if (state.rightPanel === 'profil') {
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

  // Input : desactiver pour les canaux d'annonce (infos etudiants)
  const inputArea = document.getElementById('message-input-area');
  const inputEl   = document.getElementById('message-input');
  if (channelType === 'annonce') {
    inputEl.placeholder = 'Canal d\'annonces';
    inputArea.classList.add('readonly');
    document.getElementById('message-input-wrapper').classList.add('hidden');
    let notice = document.getElementById('readonly-notice');
    if (!notice) {
      notice = document.createElement('p');
      notice.id        = 'readonly-notice';
      notice.className = 'readonly-notice';
      notice.textContent = 'Ce canal est en lecture seule pour les etudiants.';
      inputArea.appendChild(notice);
    }
  } else {
    inputArea.classList.remove('readonly');
    document.getElementById('message-input-wrapper').classList.remove('hidden');
    const notice = document.getElementById('readonly-notice');
    if (notice) notice.remove();
    inputEl.placeholder = `Envoyer dans #${channelName ?? ''}`;
  }

  document.getElementById('btn-travaux').style.display = '';

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
  document.getElementById('btn-travaux').style.display = 'none';

  // Ouvrir le profil dans le panel droit
  await openProfilPanel(studentId);

  // Si le panel travaux etait ouvert, le fermer
  if (state.rightPanel === 'travaux') closePanel();

  await renderMessages();
}
