import { call }      from '../api.js';
import { state }     from '../state.js';
import {
  showToast, avatarColor, escapeHtml, formatDate,
  deadlineClass, deadlineLabel, makeAvatar, formatGrade, gradeClass,
} from '../utils.js';
import { renderTravaux } from './travaux.js';

// ─── Helper : pills de liens ──────────────────────────────────────────────────

function _hostLabel(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function _suiviLinkPills(linkUrl, deployUrl) {
  let html = '<span class="suivi-link-pills">';
  if (linkUrl) {
    html += `<button class="link-pill-btn link-pill-repo suivi-pill" data-url="${escapeHtml(linkUrl)}" title="${escapeHtml(linkUrl)}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
      ${escapeHtml(_hostLabel(linkUrl))}
    </button>`;
  }
  if (deployUrl) {
    html += `<button class="link-pill-btn link-pill-deploy suivi-pill" data-url="${escapeHtml(deployUrl)}" title="${escapeHtml(deployUrl)}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      ${escapeHtml(_hostLabel(deployUrl))}
    </button>`;
  }
  return html + '</span>';
}

// ─── Modal suivi ──────────────────────────────────────────────────────────────

export async function openSuiviModal(travail) {
  state.currentTravailId = travail.id;

  document.getElementById('suivi-title').textContent = travail.title;
  const deadlineBadge = document.getElementById('suivi-deadline');
  deadlineBadge.textContent = `${deadlineLabel(travail.deadline)} — ${formatDate(travail.deadline)}`;
  deadlineBadge.className   = `deadline-badge ${deadlineClass(travail.deadline)}`;

  await renderSuivi(travail.id);

  document.getElementById('modal-suivi-overlay').classList.remove('hidden');
}

async function renderSuivi(travailId) {
  const body    = document.getElementById('suivi-body');
  const [rows, travail] = await Promise.all([
    call(window.api.getTravauxSuivi, travailId),
    call(window.api.getTravailById,  travailId),
  ]);
  if (!rows) return;

  const total  = rows.length;
  const rendus = rows.filter(r => r.depot_id != null).length;
  const pct    = total > 0 ? Math.round((rendus / total) * 100) : 0;

  // Barre de progression
  document.getElementById('suivi-progress-label-count').textContent = `${rendus} / ${total} rendus`;
  document.getElementById('suivi-progress-label-pct').textContent   = `${pct} %`;
  document.getElementById('suivi-progress-fill').style.width        = `${pct}%`;

  // Bouton export
  document.getElementById('btn-export-csv').dataset.travailId = travailId;

  // Stats + action de masse
  _renderSuiviStats(rows, travailId);

  body.innerHTML = '';

  for (const r of rows) {
    const rendu = r.depot_id != null;
    const row   = document.createElement('div');
    row.className = `suivi-row ${rendu ? 'rendu' : 'non-rendu'}`;

    const statusDot = document.createElement('div');
    statusDot.className = 'suivi-status';

    const avatar = makeAvatar(r.avatar_initials, avatarColor(r.student_name), 30, r.photo_data ?? null);

    const info = document.createElement('div');
    info.className = 'suivi-info';

    const groupBadge = r.travail_group_name
      ? `<span class="group-tag" style="font-size:10px">${escapeHtml(r.travail_group_name)}</span>`
      : '';

    if (rendu) {
      const fileOrLink = r.link_url
        ? _suiviLinkPills(r.link_url, r.deploy_url)
        : `<span class="suivi-file-name">${escapeHtml(r.file_name)}</span>`;
      info.innerHTML = `
        <div class="suivi-name">${escapeHtml(r.student_name)} ${groupBadge}</div>
        <div class="suivi-detail">
          ${fileOrLink} &middot; Depose le ${formatDate(r.submitted_at)}
        </div>
        ${r.feedback ? `<div class="suivi-feedback">${escapeHtml(r.feedback)}</div>` : ''}
      `;
    } else {
      info.innerHTML = `
        <div class="suivi-name">${escapeHtml(r.student_name)} ${groupBadge}</div>
        <div class="suivi-detail">Non rendu</div>
      `;
    }

    const noteArea = document.createElement('div');
    noteArea.className = 'suivi-note-area';

    if (rendu) {
      if (r.note != null) {
        const badge = document.createElement('span');
        badge.className = `note-badge ${gradeClass(r.note)}`;
        badge.textContent = formatGrade(r.note);
        noteArea.appendChild(badge);
      } else {
        const btn = document.createElement('button');
        btn.className   = 'btn-set-note';
        btn.textContent = 'Attribuer';
        btn.addEventListener('click', () => openInlineNoteInput(r.depot_id, noteArea, travailId));
        noteArea.appendChild(btn);
      }
    }

    // Reassignation de groupe (si le travail est groupe)
    if (travail?.group_id) {
      const groupEl = await buildGroupSelect(travailId, r.student_id, r.travail_group_id);
      row.appendChild(groupEl);
    }

    row.appendChild(statusDot);
    row.appendChild(avatar);
    row.appendChild(info);
    row.appendChild(noteArea);
    body.appendChild(row);
  }
}

// ─── Stats + action de masse ──────────────────────────────────────────────────

function _renderSuiviStats(rows, travailId) {
  let statsEl = document.getElementById('suivi-stats-section');
  if (!statsEl) {
    statsEl = document.createElement('div');
    statsEl.id = 'suivi-stats-section';
    const progressWrapper = document.querySelector('.suivi-progress-wrapper');
    if (progressWrapper?.parentElement) {
      progressWrapper.parentElement.insertBefore(statsEl, progressWrapper.nextSibling);
    }
  }

  const graded = rows.filter(r => r.note != null);
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of graded) {
    const n = String(r.note).toUpperCase();
    if (n in counts) counts[n]++;
  }
  const nonRendus = rows.filter(r => r.depot_id == null).length;

  statsEl.innerHTML = `
    <div class="suivi-stats-bar">
      <span class="suivi-stats-label">Notes :</span>
      <span class="suivi-stat-chip suivi-stat-a">A <strong>${counts.A}</strong></span>
      <span class="suivi-stat-chip suivi-stat-b">B <strong>${counts.B}</strong></span>
      <span class="suivi-stat-chip suivi-stat-c">C <strong>${counts.C}</strong></span>
      <span class="suivi-stat-chip suivi-stat-d">D <strong>${counts.D}</strong></span>
      <span class="suivi-stat-chip suivi-stat-nr">Non rendus <strong>${nonRendus}</strong></span>
    </div>
    ${nonRendus > 0 ? `
    <div class="suivi-mass-action">
      <button class="btn-ghost" id="btn-mass-d" style="color:var(--color-danger);border-color:var(--color-danger)20">
        Marquer les non-rendus comme D (${nonRendus})
      </button>
    </div>` : ''}
  `;

  statsEl.querySelector('#btn-mass-d')?.addEventListener('click', async () => {
    const n = await call(window.api.markNonSubmittedAsD, travailId);
    if (n === null) return;
    showToast(`${n} étudiant${n > 1 ? 's' : ''} marqué${n > 1 ? 's' : ''} D.`, 'success');
    await renderSuivi(travailId);
    await renderTravaux();
  });
}

async function buildGroupSelect(travailId, studentId, currentGroupId) {
  const wrap = document.createElement('div');
  wrap.className = 'suivi-group-select-wrap';

  // Recuperer les groupes de la promo
  const travail = await call(window.api.getTravailById, travailId);
  if (!travail) return wrap;

  const channelId = travail.channel_id;
  // On recupère les groupes via la promo (en passant par le channel)
  // Pour simplifier on charge tous les groupes deja présents dans le suivi
  const tgm = await call(window.api.getTravailGroupMembers, travailId);
  if (!tgm) return wrap;

  // Liste unique de groupes
  const groupMap = new Map();
  for (const m of tgm) groupMap.set(m.group_id, m.group_name);

  const select = document.createElement('select');
  select.className = 'suivi-group-select form-select';
  select.innerHTML = '<option value="">— aucun groupe —</option>';
  for (const [gid, gname] of groupMap) {
    const opt = document.createElement('option');
    opt.value = gid;
    opt.textContent = gname;
    if (gid === currentGroupId) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', async () => {
    const newGroupId = select.value ? parseInt(select.value) : null;
    await call(window.api.setTravailGroupMember, { travailId, studentId, groupId: newGroupId });
    showToast('Groupe mis a jour.', 'success');
    await renderSuivi(travailId);
  });

  wrap.appendChild(select);
  return wrap;
}

// Sélection de note inline A/B/C/D dans le suivi
function openInlineNoteInput(depotId, container, travailId) {
  container.innerHTML = '';

  const select = document.createElement('select');
  select.className = 'form-select';
  select.style.cssText = 'width:72px;font-size:12px;padding:3px 4px;';
  select.innerHTML = `
    <option value="">—</option>
    <option value="A">A</option>
    <option value="B">B</option>
    <option value="C">C</option>
    <option value="D">D</option>
  `;

  const btnOk = document.createElement('button');
  btnOk.className   = 'btn-primary';
  btnOk.style.cssText = 'padding:4px 10px;font-size:12px;';
  btnOk.textContent = 'OK';

  const save = async () => {
    const val = select.value;
    if (!val) { select.style.borderColor = 'var(--color-danger)'; return; }
    const ok = await call(window.api.setNote, { depotId, note: val });
    if (ok === null) return;
    showToast('Note enregistree.', 'success');
    await renderSuivi(travailId);
    await renderTravaux();
  };

  btnOk.addEventListener('click', save);
  select.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });

  container.appendChild(select);
  container.appendChild(btnOk);
  select.focus();
}

// ─── Export CSV ────────────────────────────────────────────────────────────────

export function bindSuiviModal() {
  const overlay = document.getElementById('modal-suivi-overlay');

  // Délégation pour les pills de liens (ouvrir dans le navigateur externe)
  overlay.addEventListener('click', e => {
    const pill = e.target.closest('.suivi-pill[data-url]');
    if (pill) { call(window.api.openExternal, pill.dataset.url); return; }
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  document.getElementById('modal-suivi-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  document.getElementById('btn-export-csv').addEventListener('click', async e => {
    const travailId = parseInt(e.currentTarget.dataset.travailId);
    const result = await call(window.api.exportCsv, travailId);
    if (result === null) return;
    if (result) showToast(`Exporte : ${result}`, 'success');
  });
}

// ─── Profil etudiant (panel droit) ────────────────────────────────────────────

export async function openProfilPanel(studentId) {
  state.rightPanel = 'profil';
  const panel = document.getElementById('right-panel');
  panel.classList.remove('hidden');

  const data = await call(window.api.getStudentProfile, studentId);
  if (!data) return;

  const { student, travaux } = data;
  const rendus  = travaux.filter(t => t.depot_id != null).length;
  const notes   = travaux.filter(t => t.note != null).map(t => t.note);
  const moyenne = notes.length
    ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1)
    : null;

  panel.innerHTML = `
    <div class="profil-header">
      <div class="msg-avatar" style="background:${avatarColor(student.name)};color:#fff;width:38px;height:38px;font-size:14px;flex-shrink:0;">${escapeHtml(student.avatar_initials)}</div>
      <div class="profil-info">
        <div class="profil-name">${escapeHtml(student.name)}</div>
        <div class="profil-promo">${escapeHtml(student.promo_name)}</div>
      </div>
      <button class="btn-ghost" id="btn-close-profil">Fermer</button>
    </div>
    <div style="padding:10px 16px 6px;font-size:12px;color:var(--text-muted);display:flex;gap:16px;border-bottom:1px solid rgba(255,255,255,.07);">
      <span><strong style="color:var(--text-primary)">${rendus}</strong> rendu${rendus > 1 ? 's' : ''}</span>
      ${moyenne != null ? `<span>Moyenne : <strong style="color:var(--text-primary)">${moyenne}/20</strong></span>` : ''}
    </div>
    <div class="panel-body" id="profil-body">
      ${travaux.length ? '' : '<div class="empty-state"><p>Aucun travail dans cette promo.</p></div>'}
    </div>
  `;

  document.getElementById('btn-close-profil').addEventListener('click', () => {
    state.rightPanel = null;
    panel.classList.add('hidden');
  });

  const body = document.getElementById('profil-body');
  for (const t of travaux) {
    const item = document.createElement('div');
    item.className = 'profil-travail-item';
    item.innerHTML = `
      <div class="profil-travail-title">${escapeHtml(t.title)}</div>
      <div class="profil-travail-canal">#${escapeHtml(t.channel_name)} &middot; ${formatDate(t.deadline)}</div>
      <div class="profil-depot-row">
        ${t.depot_id
          ? `<span class="profil-depot-file" title="${escapeHtml(t.file_name)}">${escapeHtml(t.file_name)}</span>
             ${t.note != null ? `<span class="note-badge">${t.note}/20</span>` : '<span style="font-size:11px;color:var(--text-muted)">Non note</span>'}`
          : `<span class="profil-non-rendu">Non rendu</span>`
        }
      </div>
      ${t.feedback ? `<div style="font-size:11px;color:var(--text-secondary);font-style:italic;margin-top:4px;">${escapeHtml(t.feedback)}</div>` : ''}
    `;
    body.appendChild(item);
  }
}
