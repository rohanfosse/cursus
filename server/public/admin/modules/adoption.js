import { apiFetch, escHtml, fmtDate, skeleton, emptyState } from '../app.js'

let currentDaysThreshold = 7

// ── Section 1: Metriques cles ──────────────────────────────────────────────

function renderMetricCards(data) {
  const { dau, wau, mau, totalStudents } = data
  const adoptionRate = totalStudents > 0 ? Math.round((wau / totalStudents) * 100) : 0
  const rateColor = wau >= 20 ? 'var(--green, #22c55e)' : wau >= 10 ? 'var(--orange, #f59e0b)' : 'var(--red, #ef4444)'

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:2rem">
      <div class="card" style="padding:1rem;text-align:center">
        <div style="font-size:2rem;font-weight:700;color:var(--accent)">${dau}</div>
        <div style="font-size:.8rem;color:var(--text-secondary)">DAU (24h)</div>
      </div>
      <div class="card" style="padding:1rem;text-align:center">
        <div style="font-size:2rem;font-weight:700;color:${rateColor}">${wau}</div>
        <div style="font-size:.8rem;color:var(--text-secondary)">WAU (7j)</div>
      </div>
      <div class="card" style="padding:1rem;text-align:center">
        <div style="font-size:2rem;font-weight:700;color:var(--text)">${mau}</div>
        <div style="font-size:.8rem;color:var(--text-secondary)">MAU (30j)</div>
      </div>
      <div class="card" style="padding:1rem;text-align:center">
        <div style="font-size:2rem;font-weight:700;color:var(--text-muted)">${totalStudents}</div>
        <div style="font-size:.8rem;color:var(--text-secondary)">Total etudiants</div>
      </div>
    </div>
    <div class="card" style="padding:.75rem 1rem;margin-bottom:2rem;display:flex;align-items:center;gap:.75rem">
      <span style="font-size:.85rem;color:var(--text-secondary)">Taux d'adoption (WAU/Total) :</span>
      <span style="font-weight:700;color:${rateColor};font-size:1.1rem">${adoptionRate}%</span>
      <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
        <div style="width:${Math.min(100, adoptionRate)}%;height:100%;background:${rateColor};border-radius:4px;transition:width .3s"></div>
      </div>
    </div>
  `
}

// ── Section 2: Tendance DAU (14 jours) ─────────────────────────────────────

function renderDauTrend(dauTrend) {
  if (!dauTrend || dauTrend.length === 0) {
    return `<div class="card" style="padding:1rem;margin-bottom:2rem">
      <h3 style="font-size:.95rem;font-weight:600;margin-bottom:.75rem">Tendance DAU (14 jours)</h3>
      ${emptyState('Aucune donnee de visite', '')}
    </div>`
  }

  const maxCount = Math.max(1, ...dauTrend.map(d => d.count))
  const today = new Date().toISOString().slice(0, 10)

  const bars = dauTrend.map(d => {
    const heightPct = Math.max(4, (d.count / maxCount) * 100)
    const isToday = d.day === today
    const bg = isToday ? 'var(--accent)' : 'var(--text-muted)'
    const label = d.day.slice(5) // MM-DD
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0">
        <span style="font-size:.7rem;color:var(--text-secondary);margin-bottom:.25rem">${d.count}</span>
        <div style="width:100%;max-width:32px;height:${heightPct}%;background:${bg};border-radius:3px 3px 0 0;opacity:${isToday ? 1 : 0.6};transition:height .3s" title="${d.day}: ${d.count} utilisateurs"></div>
        <span style="font-size:.65rem;color:var(--text-muted);margin-top:.25rem;transform:rotate(-45deg);white-space:nowrap">${label}</span>
      </div>
    `
  }).join('')

  return `
    <div class="card" style="padding:1rem;margin-bottom:2rem">
      <h3 style="font-size:.95rem;font-weight:600;margin-bottom:.75rem">Tendance DAU (14 jours)</h3>
      <div style="display:flex;align-items:flex-end;height:160px;gap:2px;padding-bottom:1.5rem">
        ${bars}
      </div>
    </div>
  `
}

// ── Section 3: Etudiants inactifs ──────────────────────────────────────────

function renderInactiveStudents(students) {
  const count = students.length

  let html = `
    <div class="card" style="padding:1rem;margin-bottom:2rem">
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem">
        <h3 style="font-size:.95rem;font-weight:600;margin:0">Etudiants inactifs</h3>
        <span class="tab-badge" style="display:inline-block;background:var(--red,#ef4444);color:#fff;font-size:.75rem;padding:1px 8px;border-radius:10px">${count}</span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:.5rem">
          <label style="font-size:.8rem;color:var(--text-secondary)">Seuil :</label>
          <select id="adoption-days-filter" onchange="changeInactiveDays(this.value)" style="padding:.3rem .5rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:.8rem">
            <option value="3" ${currentDaysThreshold === 3 ? 'selected' : ''}>3 jours</option>
            <option value="7" ${currentDaysThreshold === 7 ? 'selected' : ''}>7 jours</option>
            <option value="14" ${currentDaysThreshold === 14 ? 'selected' : ''}>14 jours</option>
            <option value="30" ${currentDaysThreshold === 30 ? 'selected' : ''}>30 jours</option>
          </select>
        </div>
      </div>
  `

  if (count === 0) {
    html += emptyState('Aucun etudiant inactif pour ce seuil', '')
  } else {
    html += `<div class="table-wrap"><table>
      <thead><tr>
        <th>Nom</th>
        <th>Promo</th>
        <th>Derniere connexion</th>
        <th>Jours absent</th>
      </tr></thead><tbody>`

    for (const s of students) {
      const lastSeen = s.last_seen ? fmtDate(s.last_seen) : 'Jamais'
      const daysAbsent = s.last_seen
        ? Math.floor((Date.now() - new Date(s.last_seen + (s.last_seen.includes('Z') ? '' : 'Z')).getTime()) / 86400000)
        : null
      const rowColor = daysAbsent === null || daysAbsent > 14
        ? 'rgba(239,68,68,.08)'
        : daysAbsent > 7
          ? 'rgba(245,158,11,.08)'
          : ''
      const textColor = daysAbsent === null || daysAbsent > 14
        ? 'var(--red,#ef4444)'
        : daysAbsent > 7
          ? 'var(--orange,#f59e0b)'
          : 'var(--text)'
      const absentLabel = daysAbsent === null ? 'Jamais vu' : `${daysAbsent}j`

      html += `<tr style="background:${rowColor}">
        <td>${escHtml(s.name)}</td>
        <td>${s.promo_name ? escHtml(s.promo_name) : '<span style="color:var(--text-muted)">--</span>'}</td>
        <td style="font-size:.8rem">${lastSeen}</td>
        <td style="font-weight:600;color:${textColor}">${absentLabel}</td>
      </tr>`
    }

    html += `</tbody></table></div>`
  }

  html += `</div>`
  return html
}

// ── Section 4: Derniere connexion (tous les etudiants) ─────────────────────

function renderLastSeenAll(students) {
  let html = `
    <div class="card" style="padding:1rem">
      <h3 style="font-size:.95rem;font-weight:600;margin-bottom:1rem">Derniere connexion (tous les etudiants)</h3>
  `

  if (!students || students.length === 0) {
    html += emptyState('Aucun etudiant enregistre', '')
  } else {
    html += `<div class="table-wrap"><table>
      <thead><tr>
        <th>Statut</th>
        <th>Nom</th>
        <th>Email</th>
        <th>Promo</th>
        <th>Derniere connexion</th>
        <th>Jours absent</th>
      </tr></thead><tbody>`

    for (const s of students) {
      const lastSeen = s.last_seen ? fmtDate(s.last_seen) : 'Jamais'
      const daysAbsent = s.days_absent
      const hasNeverSeen = s.last_seen === null

      // Status dot
      let dotColor, dotTitle
      if (hasNeverSeen) {
        dotColor = 'var(--red, #ef4444)'
        dotTitle = 'Jamais vu'
      } else if (daysAbsent === 0) {
        dotColor = 'var(--green, #22c55e)'
        dotTitle = 'Actif aujourd\'hui'
      } else if (daysAbsent <= 7) {
        dotColor = 'var(--orange, #f59e0b)'
        dotTitle = 'Vu cette semaine'
      } else {
        dotColor = 'var(--text-muted, #6b7280)'
        dotTitle = 'Inactif'
      }

      const absentLabel = hasNeverSeen ? 'Jamais' : `${daysAbsent}j`

      html += `<tr>
        <td style="text-align:center" title="${dotTitle}">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotColor}"></span>
        </td>
        <td>${escHtml(s.name)}</td>
        <td style="font-size:.8rem;color:var(--text-secondary)">${escHtml(s.email || '')}</td>
        <td>${s.promo_name ? escHtml(s.promo_name) : '<span style="color:var(--text-muted)">--</span>'}</td>
        <td style="font-size:.8rem">${lastSeen}</td>
        <td style="font-size:.85rem">${absentLabel}</td>
      </tr>`
    }

    html += `</tbody></table></div>`
  }

  html += `</div>`
  return html
}

// ── Main loader ────────────────────────────────────────────────────────────

export async function loadAdoption() {
  const el = document.getElementById('adoption-content')
  if (!el) return
  el.innerHTML = skeleton(8)

  try {
    const [adoptionRes, inactiveRes, lastSeenRes] = await Promise.all([
      apiFetch('/api/admin/adoption'),
      apiFetch(`/api/admin/inactive?days=${currentDaysThreshold}`),
      apiFetch('/api/admin/last-seen'),
    ])

    if (!adoptionRes?.ok) {
      el.innerHTML = emptyState(adoptionRes?.error || 'Erreur de chargement', '')
      return
    }

    let html = renderMetricCards(adoptionRes.data)
    html += renderDauTrend(adoptionRes.data.dauTrend)
    html += renderInactiveStudents(inactiveRes?.ok ? inactiveRes.data : [])
    html += renderLastSeenAll(lastSeenRes?.ok ? lastSeenRes.data : [])

    el.innerHTML = html
  } catch (e) {
    el.innerHTML = emptyState('Erreur reseau', '')
  }
}

export async function changeInactiveDays(days) {
  currentDaysThreshold = Number(days) || 7
  loadAdoption()
}
