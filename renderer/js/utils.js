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
  if (diff < 0)                    return 'deadline-passed';
  if (diff < 48 * 60 * 60 * 1000) return 'deadline-soon';
  return 'deadline-ok';
}

export function deadlineLabel(deadlineStr) {
  const cls = deadlineClass(deadlineStr);
  if (cls === 'deadline-passed') return 'Delai depasse';
  if (cls === 'deadline-soon')   return 'Moins de 48 h';
  return 'En cours';
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

// Cree un avatar DOM (evite les styles inline dans innerHTML)
export function makeAvatar(initials, colorStr, size = 34) {
  const div = document.createElement('div');
  div.className = 'msg-avatar';
  div.style.width      = `${size}px`;
  div.style.height     = `${size}px`;
  div.style.background = colorStr;
  div.style.color      = '#fff';
  div.style.fontSize   = `${Math.round(size * 0.33)}px`;
  div.textContent      = initials;
  return div;
}
