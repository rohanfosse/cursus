import { apiFetch, escHtml, authHeaders } from '../app.js'

const API = window.location.origin

export async function loadImport() {
  const el = document.getElementById('import-content')

  // Charger la liste des promos existantes
  let promos = []
  try {
    const r = await apiFetch('/api/admin/promos-list')
    promos = r?.ok ? r.data : []
  } catch {}

  const promoOptions = promos.map(p => `<option value="${escHtml(p.name)}">${escHtml(p.name)} (ID ${p.id})</option>`).join('')

  el.innerHTML = `
    <div class="grid">
      <div class="card" style="grid-column: span 2">
        <div class="card-title" style="font-size:1.1rem">Seed complet</div>
        <div class="card-sub" style="margin-bottom:1rem">
          Crée les 2 promos (CPI A2 Informatique + FISA Informatique A4) avec leurs canaux par bloc de formation,
          importe tous les examens du calendrier, et les rappels de l'échéancier scolarité. <strong>Idempotent</strong> : peut être relancé sans doublons.
        </div>
        <button class="btn btn-primary" style="font-size:1rem;padding:.6rem 1.5rem" onclick="seedAll()">
          Tout initialiser (promos + examens + rappels)
        </button>
        <div id="seed-result" style="margin-top:1rem;font-size:.85rem"></div>
      </div>
    </div>

    <div class="grid" style="margin-top:1rem">
      <div class="card">
        <div class="card-title">Import examens (individuel)</div>
        <div class="card-sub" style="margin-bottom:.75rem">Importe les examens dans une promo spécifique.</div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
          <select id="import-promo-name" style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:.85rem">
            ${promoOptions || '<option>Aucune promo</option>'}
            <option value="CPI A2 Informatique">+ CPI A2 Informatique</option>
            <option value="FISA Informatique A4">+ FISA Informatique A4</option>
          </select>
          <select id="import-promo-tag" style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:.85rem">
            <option value="CPIA2">Examens CPI A2</option>
            <option value="FISA4">Examens FISA A4</option>
          </select>
          <button class="btn btn-primary" onclick="importExamens()">Importer</button>
        </div>
        <div id="import-result" style="margin-top:.5rem;font-size:.85rem"></div>
      </div>

      <div class="card">
        <div class="card-title">Import rappels pilote</div>
        <div class="card-sub" style="margin-bottom:.75rem">Importe les 39 rappels de l'échéancier scolarité (CPI A2 + FISA A4).</div>
        <button class="btn btn-primary" onclick="importRappels()">Importer les rappels</button>
        <div id="rappels-result" style="margin-top:.5rem;font-size:.85rem"></div>
      </div>
    </div>

    <div class="grid" style="margin-top:1rem">
      <div class="card">
        <div class="card-title">Promos existantes</div>
        ${promos.length ? `<table class="data-table">
          <tr><th>ID</th><th>Nom</th><th>Couleur</th></tr>
          ${promos.map(p => `<tr>
            <td><strong>${p.id}</strong></td>
            <td>${escHtml(p.name)}</td>
            <td><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${p.color};vertical-align:middle;margin-right:4px"></span>${p.color}</td>
          </tr>`).join('')}
        </table>` : '<div class="card-sub">Aucune promo créée.</div>'}
      </div>
    </div>`
}

export async function seedAll() {
  const resultEl = document.getElementById('seed-result')
  resultEl.innerHTML = '<span style="color:var(--accent)">Initialisation en cours...</span>'
  try {
    const json = await fetch(`${API}/api/admin/seed-promos`, {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: '{}',
    }).then(r => r.json())
    if (json.ok) {
      let html = '<div style="color:var(--green);margin-bottom:.5rem"><strong>Seed terminé !</strong></div>'
      html += '<ul style="list-style:none;padding:0;font-size:.85rem">'
      for (const s of json.data.steps) html += `<li style="padding:2px 0">\u2713 ${escHtml(s)}</li>`
      html += '</ul>'
      if (json.data.promos?.length) {
        html += '<div style="margin-top:.75rem;font-size:.85rem;color:var(--text-secondary)">Promos : '
        html += json.data.promos.map(p => `<strong>${escHtml(p.name)}</strong> (ID ${p.id})`).join(', ')
        html += '</div>'
      }
      resultEl.innerHTML = html
      loadImport() // refresh la liste des promos
    } else {
      resultEl.innerHTML = `<span style="color:var(--red)">${json.error}</span>`
    }
  } catch (err) {
    resultEl.innerHTML = `<span style="color:var(--red)">Erreur : ${err.message}</span>`
  }
}

export async function importRappels() {
  const resultEl = document.getElementById('rappels-result')
  resultEl.innerHTML = 'Import en cours...'
  try {
    const json = await fetch(`${API}/api/admin/import-rappels`, {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: '{}',
    }).then(r => r.json())
    if (json.ok) {
      resultEl.innerHTML = `<span style="color:var(--green)">${json.data.message}</span>`
    } else {
      resultEl.innerHTML = `<span style="color:var(--red)">${json.error}</span>`
    }
  } catch (err) {
    resultEl.innerHTML = `<span style="color:var(--red)">Erreur : ${err.message}</span>`
  }
}

export async function importExamens() {
  const promoName = document.getElementById('import-promo-name').value
  const promoTag = document.getElementById('import-promo-tag').value
  const resultEl = document.getElementById('import-result')
  if (!promoName) { resultEl.innerHTML = '<span style="color:var(--red)">Sélectionnez une promo.</span>'; return }
  resultEl.innerHTML = 'Import en cours...'
  try {
    const json = await fetch(`${API}/api/admin/import-examens`, {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ promoName, promoTag }),
    }).then(r => r.json())
    if (json.ok) {
      resultEl.innerHTML = `<span style="color:var(--green)">${json.data.message}</span>`
      loadImport()
    } else {
      resultEl.innerHTML = `<span style="color:var(--red)">${json.error}</span>`
    }
  } catch (err) {
    resultEl.innerHTML = `<span style="color:var(--red)">Erreur : ${err.message}</span>`
  }
}
