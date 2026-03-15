// ─── Préférences utilisateur (localStorage) ──────────────────────────────────

const STORAGE_KEY = 'cesi_prefs';

function _getPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
  catch { return {}; }
}

function _savePrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function getPref(key, defaultVal = false) {
  return _getPrefs()[key] ?? defaultVal;
}

export function setPref(key, value) {
  const prefs = _getPrefs();
  prefs[key] = value;
  _savePrefs(prefs);
}

// ─── Ouverture de la modale ───────────────────────────────────────────────────

export function openSettings() {
  const prefs = _getPrefs();

  const docsToggle = document.getElementById('settings-docs-default');
  if (docsToggle) docsToggle.checked = prefs.docsOpenByDefault ?? false;

  // Afficher la première section par défaut
  _switchSettingsSection('general');

  document.getElementById('modal-settings-overlay').classList.remove('hidden');
}

// ─── Navigation entre sections ────────────────────────────────────────────────

function _switchSettingsSection(name) {
  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
  document.querySelectorAll('.settings-section').forEach(sec => {
    sec.classList.toggle('hidden', sec.id !== `settings-section-${name}`);
  });
}

// ─── Liaison des événements ───────────────────────────────────────────────────

export function bindSettings() {
  const overlay = document.getElementById('modal-settings-overlay');
  if (!overlay) return;

  document.getElementById('modal-settings-close')
    .addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  // Navigation entre catégories
  overlay.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click', () => _switchSettingsSection(btn.dataset.section));
  });

  // Toggle "Documents ouverts par défaut"
  document.getElementById('settings-docs-default')
    ?.addEventListener('change', e => setPref('docsOpenByDefault', e.target.checked));
}
