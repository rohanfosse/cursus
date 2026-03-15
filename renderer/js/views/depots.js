import { call }      from '../api.js';
import { state }     from '../state.js';
import { showToast, avatarColor, escapeHtml, formatDate, makeAvatar, formatGrade, gradeClass } from '../utils.js';
import { renderTravaux } from './travaux.js';

// ─── Helper : pills de liens ──────────────────────────────────────────────────

function _hostLabel(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function _depotLinkPills(linkUrl, deployUrl) {
  let html = '';
  if (linkUrl) {
    html += `<button class="link-pill-btn link-pill-repo" data-url="${escapeHtml(linkUrl)}" title="${escapeHtml(linkUrl)}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
      ${escapeHtml(_hostLabel(linkUrl))}
    </button>`;
  }
  if (deployUrl) {
    html += `<button class="link-pill-btn link-pill-deploy" data-url="${escapeHtml(deployUrl)}" title="${escapeHtml(deployUrl)}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      ${escapeHtml(_hostLabel(deployUrl))}
    </button>`;
  }
  return html;
}

// ─── Modal depots ─────────────────────────────────────────────────────────────

export async function openDepotsModal(travail) {
  state.currentTravailId = travail.id;

  document.getElementById('modal-depots-title').textContent  = travail.title;
  document.getElementById('modal-depots-header-sub').textContent = formatDate(travail.deadline);

  await populateStudentSelect();
  await renderDepots(travail.id);

  document.getElementById('modal-depots-overlay').classList.remove('hidden');
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

export async function renderDepots(travailId) {
  const body   = document.getElementById('modal-depots-body');
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

    const avatar = makeAvatar(d.avatar_initials, avatarColor(d.student_name), 32);

    const info = document.createElement('div');
    info.className = 'depot-info';
    info.innerHTML = `
      <div class="depot-student">${escapeHtml(d.student_name)}</div>
      ${d.link_url
        ? `<div class="depot-link-pills">${_depotLinkPills(d.link_url, d.deploy_url)}</div>`
        : `<div class="depot-file" title="${escapeHtml(d.file_name)}">${escapeHtml(d.file_name)}</div>`
      }
      <div class="depot-date">Depose le ${formatDate(d.submitted_at)}</div>
      ${d.feedback ? `<div class="depot-feedback">${escapeHtml(d.feedback)}</div>` : ''}
    `;

    const actions = document.createElement('div');
    actions.className = 'depot-actions';

    if (d.note != null) {
      const badge = document.createElement('span');
      badge.className = `note-badge ${gradeClass(d.note)}`;
      badge.textContent = formatGrade(d.note);
      actions.appendChild(badge);
    } else {
      const btnNote = document.createElement('button');
      btnNote.className = 'btn-set-note';
      btnNote.textContent = 'Attribuer une note';
      btnNote.addEventListener('click', () => openNoteModal(d.id));
      actions.appendChild(btnNote);
    }

    const btnFeedback = document.createElement('button');
    btnFeedback.className = 'btn-set-feedback';
    btnFeedback.textContent = d.feedback ? 'Modifier le commentaire' : 'Commenter';
    btnFeedback.addEventListener('click', () => toggleFeedbackForm(d, info, btnFeedback));
    actions.appendChild(btnFeedback);

    row.appendChild(avatar);
    row.appendChild(info);
    row.appendChild(actions);
    body.appendChild(row);
  }
}

// Feedback inline sous la ligne du depot
function toggleFeedbackForm(depot, infoEl, btnFeedback) {
  const existingForm = infoEl.querySelector('.feedback-form');
  if (existingForm) { existingForm.remove(); return; }

  const form = document.createElement('div');
  form.className = 'feedback-form';
  form.innerHTML = `
    <textarea placeholder="Commentaire de correction…" rows="3">${escapeHtml(depot.feedback ?? '')}</textarea>
    <div class="feedback-form-actions">
      <button class="btn-ghost" style="font-size:12px;padding:4px 10px">Annuler</button>
      <button class="btn-primary" style="font-size:12px;padding:4px 10px">Enregistrer</button>
    </div>
  `;

  form.querySelector('.btn-ghost').addEventListener('click', () => form.remove());
  form.querySelector('.btn-primary').addEventListener('click', async () => {
    const text = form.querySelector('textarea').value.trim();
    const ok   = await call(window.api.setFeedback, { depotId: depot.id, feedback: text });
    if (ok === null) return;
    showToast('Commentaire enregistre.', 'success');
    await renderDepots(state.currentTravailId);
  });

  infoEl.appendChild(form);
  form.querySelector('textarea').focus();
}

// ─── Modal note ────────────────────────────────────────────────────────────────

function openNoteModal(depotId) {
  state.pendingNoteDepotId = depotId;
  document.querySelectorAll('input[name="note-grade"]').forEach(r => { r.checked = false; });
  document.getElementById('note-error').textContent = '';
  document.getElementById('modal-note-overlay').classList.remove('hidden');
}

export function bindNoteModal() {
  const overlay = document.getElementById('modal-note-overlay');

  const close = () => {
    overlay.classList.add('hidden');
    state.pendingNoteDepotId = null;
  };

  document.getElementById('modal-note-close').addEventListener('click',  close);
  document.getElementById('modal-note-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const confirm = async () => {
    const selected = document.querySelector('input[name="note-grade"]:checked');
    const errEl    = document.getElementById('note-error');

    if (!selected) {
      errEl.textContent = 'Selectionnez une note.';
      return;
    }
    errEl.textContent = '';

    const ok = await call(window.api.setNote, {
      depotId: state.pendingNoteDepotId,
      note:    selected.value,
    });
    if (ok === null) return;

    close();
    showToast('Note enregistree.', 'success');
    await renderDepots(state.currentTravailId);
    await renderTravaux();
  };

  document.getElementById('modal-note-confirm').addEventListener('click', confirm);
}

// ─── Liaison du formulaire de depot ─────────────────────────────────────────

export function bindDepotsModal() {
  const overlay = document.getElementById('modal-depots-overlay');

  // Délégation pour les pills de liens (ouvrir dans le navigateur externe)
  overlay.addEventListener('click', e => {
    const pill = e.target.closest('.link-pill-btn[data-url]');
    if (pill) { call(window.api.openExternal, pill.dataset.url); return; }
  });

  document.getElementById('modal-depots-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  document.getElementById('modal-depot-btn').addEventListener('click', async () => {
    const studentId = parseInt(document.getElementById('depot-student-select').value);
    if (!studentId) { showToast('Selectionnez un etudiant.'); return; }

    const filePath = await call(window.api.openFileDialog);
    if (filePath === null) return;
    if (!filePath)         return; // dialogue annule

    const fileName = filePath.split(/[\\/]/).pop();
    const ok = await call(window.api.addDepot, {
      travailId: state.currentTravailId,
      studentId,
      fileName,
      filePath,
    });
    if (ok === null) return;

    showToast('Fichier depose.', 'success');
    await renderDepots(state.currentTravailId);
    await renderTravaux();
  });
}
