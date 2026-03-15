import { call }       from '../api.js';
import { escapeHtml } from '../utils.js';

let _items         = [];
let _selectedIndex = -1;
let _cbs           = {};

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initCmdPalette({ onChannel, onDm, onSection }) {
  _cbs = { onChannel, onDm, onSection };

  // Ctrl+K / Cmd+K → ouvrir
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      _open();
    }
  });

  // Fermer en cliquant sur l'overlay
  document.getElementById('cmd-palette-overlay')
    .addEventListener('click', e => { if (e.target.id === 'cmd-palette-overlay') _close(); });

  document.getElementById('cmd-palette-input').addEventListener('input',   _onSearch);
  document.getElementById('cmd-palette-input').addEventListener('keydown', _onKeyNav);
}

// ─── Ouvrir / Fermer ──────────────────────────────────────────────────────────

async function _open() {
  const overlay = document.getElementById('cmd-palette-overlay');
  overlay.classList.remove('hidden');
  const inp = document.getElementById('cmd-palette-input');
  inp.value = '';
  _selectedIndex = -1;
  await _loadItems();
  _render(_items);
  inp.focus();
}

function _close() {
  document.getElementById('cmd-palette-overlay').classList.add('hidden');
}

// ─── Chargement des items ─────────────────────────────────────────────────────

async function _loadItems() {
  _items = [
    { type: 'section', label: 'Messages', icon: '💬', section: 'messages' },
    { type: 'section', label: 'Travaux',  icon: '📋', section: 'travaux'  },
  ];
  try {
    const promos = await call(window.api.getPromotions) ?? [];
    for (const p of promos) {
      const chs = await call(window.api.getChannels, p.id) ?? [];
      for (const ch of chs) {
        _items.push({ type: 'channel', label: ch.name, sub: p.name,
                      id: ch.id, promoId: p.id, chType: ch.type });
      }
    }
    const students = await call(window.api.getAllStudents) ?? [];
    for (const s of students) {
      _items.push({ type: 'dm', label: s.name, sub: 'Message direct',
                    id: s.id, promoId: s.promo_id });
    }
  } catch (_) {}
}

// ─── Recherche + navigation clavier ──────────────────────────────────────────

function _onSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  const filtered = q
    ? _items.filter(i => i.label.toLowerCase().includes(q) || (i.sub ?? '').toLowerCase().includes(q))
    : _items;
  _selectedIndex = -1;
  _render(filtered);
}

function _onKeyNav(e) {
  const els = document.querySelectorAll('#cmd-palette-results .cmd-item');
  if (!els.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _selectedIndex = Math.min(_selectedIndex + 1, els.length - 1);
    _updateSel(els);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _selectedIndex = Math.max(_selectedIndex - 1, 0);
    _updateSel(els);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const idx = _selectedIndex >= 0 ? _selectedIndex : 0;
    els[idx]?.click();
  } else if (e.key === 'Escape') {
    _close();
  }
}

function _updateSel(els) {
  els.forEach((el, i) => el.classList.toggle('selected', i === _selectedIndex));
  els[_selectedIndex]?.scrollIntoView({ block: 'nearest' });
}

// ─── Rendu de la liste ────────────────────────────────────────────────────────

function _render(items) {
  const container = document.getElementById('cmd-palette-results');
  if (!items.length) {
    container.innerHTML = '<div class="cmd-empty">Aucun résultat</div>';
    return;
  }

  const groups = [
    { label: 'Navigation',       filter: i => i.type === 'section' },
    { label: 'Canaux',           filter: i => i.type === 'channel' },
    { label: 'Messages directs', filter: i => i.type === 'dm'      },
  ];

  let html = '';
  for (const g of groups) {
    const gr = items.filter(g.filter);
    if (!gr.length) continue;
    html += `<div class="cmd-group-label">${escapeHtml(g.label)}</div>`;
    for (const item of gr) {
      const icon = item.type === 'section' ? item.icon
                 : item.type === 'channel' ? '#' : '@';
      html += `
        <div class="cmd-item"
             data-type="${item.type}"
             data-id="${item.id ?? ''}"
             data-promo="${item.promoId ?? ''}"
             data-section="${item.section ?? ''}"
             data-name="${escapeHtml(item.label)}"
             data-ch-type="${item.chType ?? 'chat'}">
          <span class="cmd-item-icon">${escapeHtml(String(icon))}</span>
          <span class="cmd-item-name">${escapeHtml(item.label)}</span>
          ${item.sub ? `<span class="cmd-item-sub">${escapeHtml(item.sub)}</span>` : ''}
        </div>`;
    }
  }
  container.innerHTML = html;

  container.querySelectorAll('.cmd-item').forEach(el => {
    el.addEventListener('click', () => {
      _close();
      const { type, section } = el.dataset;
      const id     = parseInt(el.dataset.id)    || 0;
      const promo  = parseInt(el.dataset.promo) || 0;
      const name   = el.dataset.name;
      const chType = el.dataset.chType;
      if      (type === 'section') _cbs.onSection?.(section);
      else if (type === 'channel') _cbs.onChannel?.({ id, promo, name, type: chType });
      else if (type === 'dm')      _cbs.onDm?.({ id, promo, name });
    });
  });
}
