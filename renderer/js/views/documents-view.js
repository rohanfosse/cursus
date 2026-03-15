import { call }      from '../api.js';
import { state }     from '../state.js';
import { escapeHtml, showToast, formatDate } from '../utils.js';

// État local
let _activeChannelId   = null;
let _activeChannelName = '';
let _searchQuery       = '';
let _typeFilter        = 'all'; // 'all' | 'pdf' | 'image' | 'link'
let _isTeacher         = false;
let _navInitialized    = false; // évite de re-lier les écouteurs promo/canal

// ─── Initialisation ───────────────────────────────────────────────────────────

export async function initDocumentsSection() {
  _isTeacher = state.currentUser?.type === 'teacher';

  const btnAdd = document.getElementById('btn-add-doc');
  if (btnAdd) btnAdd.style.display = _isTeacher ? '' : 'none';

  if (!_navInitialized) {
    _navInitialized = true;
    await renderDocumentsSidebar();
    _bindTypeFilter();
    _initDragDrop();
  }
}

// ─── Sidebar (promo + canaux) ──────────────────────────────────────────────────

export async function renderDocumentsSidebar() {
  const promoFilter  = document.getElementById('doc-promo-filter');
  const channelNav   = document.getElementById('doc-channel-nav');
  if (!promoFilter || !channelNav) return;

  const promotions = await call(window.api.getPromotions);
  if (!promotions) return;

  // Boutons de promo
  promoFilter.innerHTML = promotions.map(p => `
    <button class="doc-promo-btn" data-promo-id="${p.id}"
            style="--promo-color:${p.color}">
      <span class="doc-promo-dot" style="background:${p.color}"></span>
      ${escapeHtml(p.name)}
    </button>
  `).join('');

  promoFilter.addEventListener('click', async e => {
    const btn = e.target.closest('[data-promo-id]');
    if (!btn) return;
    promoFilter.querySelectorAll('.doc-promo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await renderDocChannelNav(parseInt(btn.dataset.promoId));
  });

  // Ouvrir la première promo par défaut
  if (promotions.length) {
    promoFilter.querySelector('.doc-promo-btn')?.classList.add('active');
    await renderDocChannelNav(promotions[0].id);
  }
}

async function renderDocChannelNav(promoId) {
  const channelNav = document.getElementById('doc-channel-nav');
  if (!channelNav) return;

  const channels = await call(window.api.getChannels, promoId);
  if (!channels) return;

  const chatChannels = channels.filter(c => c.type === 'chat');

  channelNav.innerHTML = chatChannels.map(ch => `
    <button class="doc-channel-item${_activeChannelId === ch.id ? ' active' : ''}"
            data-channel-id="${ch.id}" data-channel-name="${escapeHtml(ch.name)}">
      <span class="doc-channel-icon">#</span>
      <span class="doc-channel-name">${escapeHtml(ch.name)}</span>
    </button>
  `).join('');

  channelNav.addEventListener('click', e => {
    const btn = e.target.closest('[data-channel-id]');
    if (!btn) return;
    channelNav.querySelectorAll('.doc-channel-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _activeChannelId   = parseInt(btn.dataset.channelId);
    _activeChannelName = btn.dataset.channelName;
    document.getElementById('documents-area-channel-name').textContent =
      `#${_activeChannelName} — Documents`;
    _searchQuery = '';
    const searchInput = document.getElementById('doc-search-input');
    if (searchInput) searchInput.value = '';
    renderDocuments();
  });

  // Auto-sélectionner le premier canal
  if (chatChannels.length && !_activeChannelId) {
    const first = chatChannels[0];
    _activeChannelId   = first.id;
    _activeChannelName = first.name;
    document.getElementById('documents-area-channel-name').textContent =
      `#${_activeChannelName} — Documents`;
    channelNav.querySelector('.doc-channel-item')?.classList.add('active');
    renderDocuments();
  }
}

// ─── Affichage des documents ──────────────────────────────────────────────────

export async function renderDocuments() {
  const container = document.getElementById('documents-main-content');
  if (!container) return;

  if (!_activeChannelId) {
    container.innerHTML = '<div class="doc-empty">Selectionnez un canal dans la barre laterale.</div>';
    return;
  }

  container.innerHTML = '<div class="doc-loading">Chargement…</div>';

  const docs = await call(window.api.getChannelDocuments, _activeChannelId);
  if (!docs) { container.innerHTML = ''; return; }

  // Filtrage recherche + type
  const query = _searchQuery.trim().toLowerCase();
  let filtered = query
    ? docs.filter(d =>
        d.name.toLowerCase().includes(query) ||
        d.category.toLowerCase().includes(query) ||
        (d.description ?? '').toLowerCase().includes(query))
    : docs;

  if (_typeFilter !== 'all') {
    filtered = filtered.filter(d => {
      if (_typeFilter === 'link')  return d.type === 'link';
      if (_typeFilter === 'pdf')   return d.type !== 'link' && d.name.toLowerCase().endsWith('.pdf');
      if (_typeFilter === 'image') return d.type !== 'link' && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(d.name);
      return true;
    });
  }

  container.innerHTML = '';

  if (!filtered.length) {
    container.innerHTML = `<div class="doc-empty">${
      query ? `Aucun document pour « ${escapeHtml(query)} ».` : 'Aucun document dans ce canal.'
    }</div>`;
    return;
  }

  // Grouper par catégorie
  const byCategory = new Map();
  for (const d of filtered) {
    if (!byCategory.has(d.category)) byCategory.set(d.category, []);
    byCategory.get(d.category).push(d);
  }

  for (const [category, items] of byCategory) {
    const section = document.createElement('div');
    section.className = 'doc-section';

    section.innerHTML = `<div class="doc-section-title">${escapeHtml(category)}</div>`;

    const grid = document.createElement('div');
    grid.className = 'doc-grid';

    for (const d of items) {
      const card = buildDocCard(d);
      grid.appendChild(card);
    }

    section.appendChild(grid);
    container.appendChild(section);
  }
}

function buildDocCard(d) {
  const isLink = d.type === 'link';
  const ext    = isLink ? '' : (d.name.match(/\.([^.]+)$/) ?? ['', ''])[1].toUpperCase();

  const card = document.createElement('div');
  card.className = 'doc-card';
  card.innerHTML = `
    <div class="doc-card-icon ${isLink ? 'doc-icon-link' : 'doc-icon-file'}">
      ${isLink
        ? `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>`
      }
      ${!isLink && ext ? `<span class="doc-ext-badge">${escapeHtml(ext)}</span>` : ''}
    </div>
    <div class="doc-card-body">
      <div class="doc-card-name">${escapeHtml(d.name)}</div>
      ${d.description ? `<div class="doc-card-desc">${escapeHtml(d.description)}</div>` : ''}
      <div class="doc-card-meta">${isLink ? escapeHtml(d.path_or_url) : 'Fichier local'}</div>
      ${d.created_at ? `<div class="doc-card-date">${formatDate(d.created_at)}</div>` : ''}
    </div>
    <div class="doc-card-actions">
      <button class="btn-ghost doc-btn-open" title="Ouvrir / Prévisualiser">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
      </button>
      ${!isLink ? `<button class="btn-ghost doc-btn-download" title="Télécharger">📥</button>` : ''}
      ${_isTeacher ? `<button class="btn-ghost doc-btn-delete" title="Supprimer">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>` : ''}
    </div>
  `;

  card.querySelector('.doc-btn-open').addEventListener('click', async () => {
    if (isLink) {
      await call(window.api.openExternal, d.path_or_url);
    } else {
      await openDocPreview(d);
    }
  });

  card.querySelector('.doc-btn-download')?.addEventListener('click', async () => {
    const result = await call(window.api.downloadFile, d.path_or_url);
    if (result === null) return;
    if (result) showToast(`Téléchargé : ${result}`, 'success');
  });

  if (_isTeacher) {
    card.querySelector('.doc-btn-delete')?.addEventListener('click', async () => {
      const ok = await call(window.api.deleteChannelDocument, d.id);
      if (ok === null) return;
      showToast('Document supprime.', 'success');
      renderDocuments();
    });
  }

  return card;
}

// ─── Liaison du modal "Ajouter un document" ───────────────────────────────────

export function bindDocumentsModal() {
  const overlay = document.getElementById('modal-add-doc-overlay');
  if (!overlay) return;

  document.getElementById('modal-add-doc-close').addEventListener('click', () => overlay.classList.add('hidden'));
  document.getElementById('btn-cancel-doc').addEventListener('click',       () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });

  // Switch link / file
  overlay.querySelectorAll('input[name="doc-type"]').forEach(r => {
    r.addEventListener('change', () => {
      const isLink = r.value === 'link' && r.checked;
      document.getElementById('doc-link-field').style.display = isLink ? '' : 'none';
      document.getElementById('doc-file-field').style.display = isLink ? 'none' : '';
    });
  });

  // Parcourir fichier
  document.getElementById('btn-doc-browse')?.addEventListener('click', async () => {
    const res = await window.api.openFileDialog();
    if (res?.ok && res.data) {
      document.getElementById('doc-path-input').value = res.data;
    }
  });

  // Soumission du formulaire
  document.getElementById('form-add-doc').addEventListener('submit', async e => {
    e.preventDefault();
    if (!_activeChannelId) { showToast('Selectionnez d\'abord un canal.'); return; }

    const type        = overlay.querySelector('input[name="doc-type"]:checked')?.value ?? 'link';
    const category    = document.getElementById('doc-category-input').value.trim();
    const name        = document.getElementById('doc-name-input').value.trim();
    const url         = document.getElementById('doc-url-input').value.trim();
    const filePath    = document.getElementById('doc-path-input').value.trim();
    const description = document.getElementById('doc-description-input').value.trim();
    const pathOrUrl   = type === 'link' ? url : filePath;

    if (!category || !name || !pathOrUrl) return;

    const ok = await call(window.api.addChannelDocument, {
      channelId:  _activeChannelId,
      category,
      type,
      name,
      pathOrUrl,
      description: description || null,
    });
    if (ok === null) return;

    overlay.classList.add('hidden');
    document.getElementById('form-add-doc').reset();
    document.getElementById('doc-link-field').style.display = '';
    document.getElementById('doc-file-field').style.display = 'none';
    showToast('Document ajoute.', 'success');
    renderDocuments();
  });

  // Bouton + Ajouter (ouvre modal)
  document.getElementById('btn-add-doc')?.addEventListener('click', async () => {
    // Pré-remplir la datalist avec les catégories existantes
    if (_activeChannelId) {
      const cats = await call(window.api.getChannelDocumentCategories, _activeChannelId);
      const dl = document.getElementById('doc-category-list');
      if (dl && cats) {
        dl.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
      }
    }
    document.getElementById('form-add-doc').reset();
    document.getElementById('doc-link-field').style.display = '';
    document.getElementById('doc-file-field').style.display = 'none';
    overlay.classList.remove('hidden');
    document.getElementById('doc-category-input').focus();
  });

  // Recherche en temps réel
  document.getElementById('doc-search-input')?.addEventListener('input', e => {
    _searchQuery = e.target.value;
    renderDocuments();
  });
}

// ─── Visionneuse in-app ───────────────────────────────────────────────────────

export async function openDocPreview(doc) {
  const overlay   = document.getElementById('document-preview-overlay');
  const titleEl   = document.getElementById('doc-preview-title');
  const bodyEl    = document.getElementById('doc-preview-body');
  const dlBtn     = document.getElementById('doc-preview-download');
  const extBtn    = document.getElementById('doc-preview-open-ext');
  const closeBtn  = document.getElementById('doc-preview-close');
  if (!overlay) return;

  titleEl.textContent = doc.name;
  bodyEl.innerHTML    = '<div class="doc-preview-loading">Chargement…</div>';
  overlay.classList.remove('hidden');

  // Stocker le chemin pour le bouton download
  dlBtn.dataset.filePath = doc.path_or_url;

  const res = await call(window.api.readFileBase64, doc.path_or_url);
  if (!res) { bodyEl.innerHTML = '<div class="doc-preview-error">Impossible de lire le fichier.</div>'; return; }

  const { mime, b64, ext } = res;
  const dataUrl = `data:${mime};base64,${b64}`;

  if (mime === 'application/pdf') {
    bodyEl.innerHTML = `<embed src="${dataUrl}" type="application/pdf" width="100%" height="100%">`;
  } else if (mime.startsWith('image/')) {
    bodyEl.innerHTML = `<img src="${dataUrl}" alt="${escapeHtml(doc.name)}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
  } else if (mime === 'text/plain') {
    const text = atob(b64);
    bodyEl.innerHTML = `<pre class="doc-preview-text">${escapeHtml(text)}</pre>`;
  } else {
    bodyEl.innerHTML = `
      <div class="doc-preview-unsupported">
        <div style="font-size:48px">📄</div>
        <p>Prévisualisation non disponible pour ce type de fichier (.${ext}).</p>
        <button class="btn-primary" id="doc-preview-open-ext-fallback">Ouvrir avec l'application par défaut</button>
      </div>
    `;
    bodyEl.querySelector('#doc-preview-open-ext-fallback')?.addEventListener('click', async () => {
      await call(window.api.openPath, doc.path_or_url);
    });
  }

  // Fermeture
  const close = () => overlay.classList.add('hidden');
  closeBtn.onclick  = close;
  overlay.onclick   = e => { if (e.target === overlay) close(); };

  // Téléchargement
  dlBtn.onclick = async () => {
    const result = await call(window.api.downloadFile, doc.path_or_url);
    if (result === null) return;
    if (result) showToast(`Téléchargé : ${result}`, 'success');
  };

  // Ouvrir en externe
  extBtn.onclick = async () => {
    await call(window.api.openPath, doc.path_or_url);
  };
}

// ─── Filtres de type de document ──────────────────────────────────────────────

function _bindTypeFilter() {
  const bar = document.getElementById('doc-type-filter');
  if (!bar) return;
  bar.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    _typeFilter = btn.dataset.filter;
    bar.querySelectorAll('.doc-filter-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.filter === _typeFilter)
    );
    renderDocuments();
  });
}

// ─── Drag & Drop dans le panneau documents ────────────────────────────────────

function _initDragDrop() {
  const panel = document.getElementById('documents-area');
  if (!panel) return;

  // Overlay visuel
  const overlay = document.createElement('div');
  overlay.id        = 'doc-drop-overlay';
  overlay.className = 'doc-drop-overlay hidden';
  overlay.innerHTML = `
    <div class="doc-drop-inner">
      <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
      <p>Relâchez pour ajouter<br>au canal actuel</p>
    </div>
  `;
  panel.appendChild(overlay);

  let _counter = 0;

  panel.addEventListener('dragenter', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    _counter++;
    overlay.classList.remove('hidden');
  });

  panel.addEventListener('dragleave', () => {
    _counter--;
    if (_counter <= 0) { _counter = 0; overlay.classList.add('hidden'); }
  });

  panel.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  panel.addEventListener('drop', e => {
    e.preventDefault();
    _counter = 0;
    overlay.classList.add('hidden');

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    if (!_activeChannelId) {
      showToast('Sélectionnez d\'abord un canal.', 'error');
      return;
    }

    // Pré-remplir et ouvrir la modale "Ajouter un document"
    const file   = files[0];
    const modal  = document.getElementById('modal-add-doc-overlay');
    if (!modal) return;

    document.getElementById('form-add-doc').reset();

    // Sélectionner le type "fichier"
    const fileRadio = modal.querySelector('input[name="doc-type"][value="file"]');
    if (fileRadio) {
      fileRadio.checked = true;
      fileRadio.dispatchEvent(new Event('change'));
    }

    // Pré-remplir nom et chemin
    const nameInput = document.getElementById('doc-name-input');
    const pathInput = document.getElementById('doc-path-input');
    if (nameInput) nameInput.value = file.name.replace(/\.[^.]+$/, '');
    if (pathInput && file.path) pathInput.value = file.path; // Electron expose file.path

    modal.classList.remove('hidden');
    document.getElementById('doc-category-input')?.focus();
  });
}
