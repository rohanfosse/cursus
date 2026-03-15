// ─── Formatage des dates ────────────────────────────────────────────────────

export function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateSeparator(isoStr) {
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

export function isoForDatetimeLocal() {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// ─── Deadlines ──────────────────────────────────────────────────────────────

export function deadlineClass(deadlineStr) {
  const diff = new Date(deadlineStr).getTime() - Date.now();
  if (diff < 0)                          return 'deadline-passed';
  if (diff < 24 * 60 * 60 * 1000)       return 'deadline-critical';
  if (diff < 3  * 24 * 60 * 60 * 1000)  return 'deadline-soon';
  if (diff < 7  * 24 * 60 * 60 * 1000)  return 'deadline-warning';
  return 'deadline-ok';
}

export function deadlineLabel(deadlineStr) {
  const diff = new Date(deadlineStr).getTime() - Date.now();
  if (diff < 0) {
    const d = Math.ceil(-diff / (24 * 3600 * 1000));
    return d === 1 ? "Retard d'1 jour" : `Retard de ${d}j`;
  }
  const h = diff / (3600 * 1000);
  if (h < 1)   return "Moins d'1h !";
  if (h < 24)  return `Dans ${Math.ceil(h)}h`;
  const d = Math.ceil(h / 24);
  if (d === 1) return 'Demain';
  if (d <= 7)  return `Dans ${d} jours`;
  if (d <= 30) return `Dans ${Math.round(d / 7)} sem.`;
  return `Dans ${Math.ceil(d / 30)} mois`;
}

// ─── Couleurs d'avatars ─────────────────────────────────────────────────────

const PALETTE = [
  '#e53935','#8e24aa','#1e88e5','#00897b',
  '#43a047','#fb8c00','#6d4c41','#546e7a',
];

export function avatarColor(str) {
  let hash = 0;
  for (const c of str) hash = (hash << 5) - hash + c.charCodeAt(0);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// ─── Securite HTML ──────────────────────────────────────────────────────────

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Met en evidence les occurrences d'un terme dans un texte
export function highlightTerm(text, term) {
  if (!term) return escapeHtml(text);
  const escaped  = escapeHtml(text);
  const escapedT = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(
    new RegExp(escapedT, 'gi'),
    m => `<mark class="search-highlight">${m}</mark>`
  );
}

// ─── Toast de notification ──────────────────────────────────────────────────

let _toastTimer = null;

export function showToast(msg, type = 'error') {
  const el = document.getElementById('app-toast');
  el.textContent = msg;
  el.className = `toast-${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}

// ─── Notation A/B/C/D (ou numérique legacy) ─────────────────────────────────

export function formatGrade(note) {
  if (note == null) return '';
  if (typeof note === 'number' || (typeof note === 'string' && !isNaN(parseFloat(note)) && ['A','B','C','D'].indexOf(note) === -1)) {
    return `${note}/20`;
  }
  return String(note);
}

export function gradeClass(note) {
  if (note == null) return '';
  if (typeof note === 'string' && ['A','B','C','D'].includes(note)) {
    return note === 'A' ? 'note-good' : note === 'B' ? 'note-mid' : note === 'C' ? 'note-mid' : 'note-low';
  }
  const n = parseFloat(note);
  return n >= 14 ? 'note-good' : n >= 10 ? 'note-mid' : 'note-low';
}

// Toast avec bouton "Annuler" — retourne une Promise<boolean> (true = annulé)
export function showUndoToast(msg, duration = 5000) {
  return new Promise(resolve => {
    const el = document.getElementById('app-toast');
    el.className = 'toast-undo';
    el.innerHTML = `<span class="toast-msg">${escapeHtml(msg)}</span><button class="toast-undo-btn">Annuler</button>`;
    clearTimeout(_toastTimer);
    let done = false;

    el.querySelector('.toast-undo-btn').addEventListener('click', () => {
      if (done) return;
      done = true;
      clearTimeout(_toastTimer);
      el.classList.add('hidden');
      resolve(true);
    }, { once: true });

    _toastTimer = setTimeout(() => {
      if (!done) { done = true; el.classList.add('hidden'); resolve(false); }
    }, duration);
  });
}

// ─── DOM ────────────────────────────────────────────────────────────────────

export function el(id) {
  return document.getElementById(id);
}

// Cree un element avec des proprietes optionnelles
export function make(tag, props = {}) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  return node;
}

// Cree un avatar DOM — photoData (base64 data URL) optionnel
export function makeAvatar(initials, colorStr, size = 34, photoData = null) {
  const div = document.createElement('div');
  div.className = 'msg-avatar';
  div.style.cssText = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.33)}px;flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;`;

  if (photoData) {
    div.style.background = 'transparent';
    const img = document.createElement('img');
    img.src = photoData;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    div.appendChild(img);
  } else {
    div.style.background = colorStr;
    div.style.color      = '#fff';
    div.textContent      = initials;
  }
  return div;
}
