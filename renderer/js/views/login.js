import { call }        from '../api.js';
import { state }       from '../state.js';
import { avatarColor, escapeHtml } from '../utils.js';

const SESSION_KEY = 'cc_session';

// ─── Persistance de session ────────────────────────────────────────────────────

function saveSession(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch {}
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'); } catch { return null; }
}

export function logout(onLogin) {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  state.currentUser = null;
  showLoginScreen(onLogin);
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function showLoginScreen(onLogin) {
  const overlay = document.getElementById('login-overlay');
  overlay.classList.remove('hidden');

  // Auto-login si session sauvegardée
  const saved = loadSession();
  if (saved) {
    _applyLogin(saved, onLogin);
    return;
  }

  _showEmailForm(onLogin);
}

// ─── Formulaire email + mot de passe ─────────────────────────────────────────

function _showEmailForm(onLogin, prefillEmail = '') {
  const overlay = document.getElementById('login-overlay');
  overlay.innerHTML = `
    <div id="login-panel">
      <div id="login-logo">
        <div class="logo-mark">Cu</div>
        <span class="logo-text">Cursus</span>
      </div>
      <h2 id="login-title">Connexion</h2>
      <p id="login-subtitle">Entrez vos identifiants pour continuer</p>

      <form id="login-form" style="width:100%;display:flex;flex-direction:column;gap:12px;margin-top:8px;">
        <div class="form-group">
          <label class="form-label" for="login-email">Adresse email</label>
          <input type="email" id="login-email" class="form-input"
                 placeholder="prenom.nom@viacesi.fr" autocomplete="email" required
                 value="${escapeHtml(prefillEmail)}"/>
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">Mot de passe</label>
          <input type="password" id="login-password" class="form-input"
                 placeholder="••••••••" autocomplete="current-password" required/>
        </div>
        <span id="login-error" class="field-error" style="margin-top:-4px;"></span>
        <button type="submit" class="btn-primary" style="margin-top:4px;">Se connecter</button>
      </form>

      <button id="btn-new-account" class="btn-ghost" style="margin-top:16px;width:100%;font-size:13px;">
        Nouveau compte étudiant
      </button>
    </div>
  `;

  const form    = document.getElementById('login-form');
  const errEl   = document.getElementById('login-error');
  const emailEl = document.getElementById('login-email');
  const pwdEl   = document.getElementById('login-password');

  // Focus sur le bon champ
  if (prefillEmail) pwdEl.focus();
  else emailEl.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    const email    = emailEl.value.trim();
    const password = pwdEl.value;

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion…';

    const identity = await call(window.api.loginWithCredentials, email, password);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';

    if (!identity) {
      errEl.textContent = 'Email ou mot de passe incorrect.';
      pwdEl.value = '';
      pwdEl.focus();
      return;
    }

    const initials = identity.avatar_initials
      ?? identity.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const user = {
      id:              identity.id,
      name:            identity.name,
      avatar_initials: initials,
      photo_data:      identity.photo_data ?? null,
      type:            identity.type,
      promo_id:        identity.promo_id,
      promo_name:      identity.promo_name,
    };

    saveSession(user);
    _applyLogin(user, onLogin);
  });

  document.getElementById('btn-new-account').addEventListener('click', () => {
    _showRegisterForm(onLogin);
  });
}

// ─── Application du login ─────────────────────────────────────────────────────

function _applyLogin(user, onLogin) {
  state.currentUser = user;
  document.getElementById('login-overlay').classList.add('hidden');
  onLogin(user);
}

// ─── Impersonification (prof → étudiant) ─────────────────────────────────────

export async function showImpersonateModal(onLogin) {
  const identities = await call(window.api.getIdentities);
  if (!identities) return;

  const students = identities.filter(i => i.type === 'student');

  let modal = document.getElementById('impersonate-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'impersonate-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:480px">
        <div class="modal-header">
          <h3 class="modal-title">Accéder à un compte étudiant</h3>
          <button class="modal-close" id="btn-close-impersonate" aria-label="Fermer">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </div>
        <div id="impersonate-list" style="display:flex;flex-direction:column;gap:6px;max-height:420px;overflow-y:auto;padding:12px 0;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('btn-close-impersonate').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  const list = document.getElementById('impersonate-list');
  list.innerHTML = '';

  for (const s of students) {
    const initials = s.avatar_initials ?? s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const color    = avatarColor(s.name);
    const btn      = document.createElement('button');
    btn.className  = 'login-identity-card';
    btn.style.cssText = 'flex-direction:row;gap:12px;padding:10px 14px;text-align:left;';
    btn.innerHTML  = `
      ${s.photo_data
        ? `<div class="login-avatar" style="overflow:hidden;background:transparent;flex-shrink:0"><img src="${s.photo_data}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/></div>`
        : `<div class="login-avatar" style="background:${color};flex-shrink:0">${escapeHtml(initials)}</div>`
      }
      <div>
        <div class="login-identity-name" style="font-size:13px;">${escapeHtml(s.name)}</div>
        <div class="login-identity-promo" style="font-size:11px;">${escapeHtml(s.promo_name ?? '')}</div>
      </div>
    `;
    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
      const user = {
        id:              s.id,
        name:            s.name,
        avatar_initials: initials,
        photo_data:      s.photo_data ?? null,
        type:            'student',
        promo_id:        s.promo_id,
        promo_name:      s.promo_name,
      };
      // Ne pas sauvegarder en session (retour teacher au rechargement)
      state.currentUser = user;
      document.getElementById('login-overlay').classList.add('hidden');
      onLogin(user);
    });
    list.appendChild(btn);
  }

  modal.classList.remove('hidden');
}

// ─── Formulaire d'inscription ─────────────────────────────────────────────────

async function _showRegisterForm(onLogin) {
  const overlay = document.getElementById('login-overlay');

  const promotions   = await call(window.api.getPromotions);
  const promoOptions = (promotions ?? [])
    .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join('');

  overlay.innerHTML = `
    <div id="login-panel" style="max-width:480px;">
      <div id="login-logo">
        <div class="logo-mark">Cu</div>
        <span class="logo-text">Cursus</span>
      </div>
      <h2 id="login-title">Nouveau compte étudiant</h2>
      <p id="login-subtitle">Utilisez votre adresse @viacesi.fr</p>

      <form id="register-form" style="width:100%;display:flex;flex-direction:column;gap:12px;margin-top:8px;">

        <div class="register-photo-row">
          <div id="register-avatar-preview" class="register-avatar-preview">?</div>
          <button type="button" id="btn-pick-photo" class="btn-ghost" style="font-size:12px;">
            Choisir une photo
          </button>
          <button type="button" id="btn-remove-photo" class="btn-ghost register-btn-remove" style="display:none;font-size:12px;">
            Supprimer
          </button>
        </div>

        <div style="display:flex;gap:10px;">
          <div class="form-group" style="flex:1">
            <label class="form-label">Prénom</label>
            <input type="text" id="reg-firstname" class="form-input" placeholder="ex : Alice" required autocomplete="off"/>
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Nom</label>
            <input type="text" id="reg-lastname" class="form-input" placeholder="ex : Martin" required autocomplete="off"/>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Adresse email</label>
          <input type="email" id="reg-email" class="form-input" placeholder="prenom.nom@viacesi.fr" required autocomplete="off"/>
          <span id="reg-email-error" class="field-error"></span>
        </div>

        <div class="form-group">
          <label class="form-label">Promotion</label>
          <select id="reg-promo" class="form-select" required>
            <option value="">Choisir une promotion…</option>
            ${promoOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Mot de passe</label>
          <input type="password" id="reg-password" class="form-input" placeholder="Choisissez un mot de passe" required autocomplete="new-password" minlength="4"/>
        </div>

        <div style="display:flex;gap:10px;margin-top:6px;">
          <button type="button" id="btn-back-login" class="btn-ghost" style="flex:1">Retour</button>
          <button type="submit" class="btn-primary" style="flex:2">Créer mon compte</button>
        </div>
      </form>
    </div>
  `;

  let pendingPhoto = null;

  const updatePreview = () => {
    const firstName = document.getElementById('reg-firstname').value.trim();
    const lastName  = document.getElementById('reg-lastname').value.trim();
    const preview   = document.getElementById('register-avatar-preview');
    const name      = `${firstName} ${lastName}`.trim();
    const initials  = name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    if (pendingPhoto) {
      preview.innerHTML = `<img src="${pendingPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    } else {
      preview.textContent = initials;
      preview.style.background = name ? avatarColor(name) : 'var(--bg-active)';
    }
  };

  document.getElementById('reg-firstname').addEventListener('input', updatePreview);
  document.getElementById('reg-lastname').addEventListener('input', updatePreview);

  document.getElementById('btn-pick-photo').addEventListener('click', async () => {
    const data = await call(window.api.openImageDialog);
    if (!data) return;
    pendingPhoto = data;
    document.getElementById('btn-remove-photo').style.display = '';
    updatePreview();
  });

  document.getElementById('btn-remove-photo').addEventListener('click', () => {
    pendingPhoto = null;
    document.getElementById('btn-remove-photo').style.display = 'none';
    updatePreview();
  });

  document.getElementById('btn-back-login').addEventListener('click', () => {
    _showEmailForm(onLogin);
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = document.getElementById('reg-firstname').value.trim();
    const lastName  = document.getElementById('reg-lastname').value.trim();
    const email     = document.getElementById('reg-email').value.trim().toLowerCase();
    const promoId   = parseInt(document.getElementById('reg-promo').value);
    const password  = document.getElementById('reg-password').value;
    const emailErr  = document.getElementById('reg-email-error');

    emailErr.textContent = '';

    if (!email.endsWith('@viacesi.fr')) {
      emailErr.textContent = 'L\'adresse doit se terminer par @viacesi.fr';
      return;
    }
    if (!promoId) return;

    const fullName = `${firstName} ${lastName}`;

    try {
      const result = await call(window.api.registerStudent, {
        name:      fullName,
        email,
        promoId,
        photoData: pendingPhoto,
        password,
      });

      if (result === null) return;

      const student = await call(window.api.getStudentByEmail, email);
      if (!student) return;

      const initials = fullName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const user = {
        id:              student.id,
        name:            student.name,
        avatar_initials: initials,
        photo_data:      student.photo_data ?? null,
        type:            'student',
        promo_id:        student.promo_id,
        promo_name:      student.promo_name,
      };
      saveSession(user);
      _applyLogin(user, onLogin);

    } catch (err) {
      emailErr.textContent = err.message ?? 'Erreur lors de la création du compte.';
    }
  });
}
