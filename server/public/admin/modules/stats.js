import { apiFetch, escHtml, fmtDate } from '../app.js'
import { loadHeatmap } from './heatmap.js'

export async function loadStats() {
  const el = document.getElementById('stats-content')
  el.innerHTML = 'Chargement...'

  const [statsJson, visitsJson] = await Promise.all([
    apiFetch('/api/admin/stats'),
    apiFetch('/api/admin/visits'),
  ])
  if (!statsJson?.ok) { el.innerHTML = 'Erreur de chargement'; return }
  const d = statsJson.data
  const v = visitsJson?.ok ? visitsJson.data : null

  // Messages chart
  const maxMsg = Math.max(...d.messagesPerDay.map(x => x.count), 1)
  const msgBars = d.messagesPerDay.map(x =>
    `<div class="chart-bar" style="height:${Math.max((x.count / maxMsg) * 100, 2)}%" data-tip="${x.day}: ${x.count} msg"></div>`
  ).join('')

  // Grade distribution
  const maxGrade = Math.max(...d.gradeDistribution.map(x => x.count), 1)
  const gradeBars = d.gradeDistribution.map(x =>
    `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem">
      <span style="font-size:.7rem;width:70px;color:var(--text-secondary)">${escHtml(x.range)}</span>
      <div style="flex:1;height:14px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${(x.count / maxGrade) * 100}%;background:var(--accent);border-radius:3px"></div>
      </div>
      <span style="font-size:.7rem;width:30px;text-align:right">${x.count}</span>
    </div>`
  ).join('')

  // Visits chart
  let visitsSection = ''
  if (v) {
    const maxVisit = Math.max(...(v.visitsPerDay || []).map(x => x.count), 1)
    const visitBars = (v.visitsPerDay || []).map(x =>
      `<div class="chart-bar visit-bar" style="height:${Math.max((x.count / maxVisit) * 100, 2)}%" data-tip="${x.day}: ${x.count} visites (${x.unique_users} uniques)"></div>`
    ).join('')

    // Logins chart
    const maxLogin = Math.max(...(v.loginsPerDay || []).map(x => x.successful + x.failed), 1)
    const loginBars = (v.loginsPerDay || []).map(x => {
      const total = x.successful + x.failed
      const successPct = total > 0 ? (x.successful / total) * 100 : 100
      return `<div class="chart-bar-stack" style="height:${Math.max((total / maxLogin) * 100, 2)}%" data-tip="${x.day}: ${x.successful} OK / ${x.failed} \u00e9checs">
        <div class="bar-success" style="height:${successPct}%"></div>
        <div class="bar-fail" style="height:${100 - successPct}%"></div>
      </div>`
    }).join('')

    // Activity per hour
    const hours = Array.from({ length: 24 }, (_, i) => {
      const found = (v.visitsPerHour || []).find(h => h.hour === i)
      return found ? found.count : 0
    })
    const maxHour = Math.max(...hours, 1)
    const hourBars = hours.map((count, i) =>
      `<div class="chart-bar hour-bar" style="height:${Math.max((count / maxHour) * 100, 2)}%" data-tip="${i}h: ${count} visites"></div>`
    ).join('')

    visitsSection = `
    <div class="section-title">Visites & Connexions</div>
    <div class="counter-grid">
      <div class="counter accent"><div class="counter-value">${v.dau}</div><div class="counter-label">Actifs aujourd'hui</div></div>
      <div class="counter accent"><div class="counter-value">${v.wau}</div><div class="counter-label">Actifs 7 jours</div></div>
      <div class="counter accent"><div class="counter-value">${v.mau}</div><div class="counter-label">Actifs 30 jours</div></div>
      <div class="counter"><div class="counter-value" style="color:var(--green)">${v.loginStats.successful}</div><div class="counter-label">Connexions OK (30j)</div></div>
      <div class="counter"><div class="counter-value" style="color:var(--red)">${v.loginStats.failed}</div><div class="counter-label">\u00c9checs (30j)</div></div>
    </div>

    <div class="grid">
      <div class="card wide">
        <div class="card-title">Visites par jour (30j)</div>
        <div class="chart-container">${visitBars || '<span style="color:var(--text-muted)">Aucune donn\u00e9e</span>'}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Connexions par jour (30j)</div>
        <div class="chart-container chart-stacked">${loginBars || '<span style="color:var(--text-muted)">Aucune donn\u00e9e</span>'}</div>
        <div class="chart-legend">
          <span><span class="legend-dot" style="background:var(--green)"></span>R\u00e9ussies</span>
          <span><span class="legend-dot" style="background:var(--red)"></span>\u00c9chou\u00e9es</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Activit\u00e9 par heure (7j)</div>
        <div class="chart-container chart-hours">${hourBars}</div>
        <div style="display:flex;justify-content:space-between;font-size:.6rem;color:var(--text-muted);margin-top:.25rem">
          <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
        </div>
      </div>
    </div>

    ${v.topPages?.length ? `
    <div class="grid">
      <div class="card">
        <div class="card-title">Pages les plus visit\u00e9es (30j)</div>
        <table class="data-table">
          <tr><th>Route</th><th>Visites</th></tr>
          ${v.topPages.map(p => `<tr><td><code>${escHtml(p.path)}</code></td><td><strong>${p.count}</strong></td></tr>`).join('')}
        </table>
      </div>
    </div>` : ''}

    <hr class="section-divider">`
  }

  el.innerHTML = `
    ${visitsSection}

    <div class="section-title">Vue d'ensemble</div>
    <div class="counter-grid">
      <div class="counter"><div class="counter-value">${d.counts.students}</div><div class="counter-label">\u00c9tudiants</div></div>
      <div class="counter"><div class="counter-value">${d.counts.teachers}</div><div class="counter-label">Enseignants</div></div>
      <div class="counter"><div class="counter-value">${d.counts.promotions}</div><div class="counter-label">Promotions</div></div>
      <div class="counter"><div class="counter-value">${d.counts.channels}</div><div class="counter-label">Canaux</div></div>
      <div class="counter"><div class="counter-value">${d.counts.messages}</div><div class="counter-label">Messages</div></div>
      <div class="counter"><div class="counter-value">${d.counts.travaux}</div><div class="counter-label">Travaux</div></div>
      <div class="counter"><div class="counter-value">${d.counts.depots}</div><div class="counter-label">D\u00e9p\u00f4ts</div></div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Activit\u00e9 24h</div>
        <div class="card-value">${d.activity24h.messages_24h}</div>
        <div class="card-sub">messages envoy\u00e9s \u2014 ${d.activity24h.depots_24h} d\u00e9p\u00f4ts soumis</div>
      </div>
      <div class="card">
        <div class="card-title">Moyenne g\u00e9n\u00e9rale</div>
        <div class="card-value">${d.avgGrade ?? '\u2014'}<span style="font-size:.9rem;color:var(--text-muted)"> /20</span></div>
        <div class="card-sub">${d.ungradedCount} d\u00e9p\u00f4ts non not\u00e9s \u2014 ${d.lateCount} en retard</div>
      </div>
    </div>

    <div class="grid">
      <div class="card wide">
        <div class="card-title">Messages par jour (30j)</div>
        <div class="chart-container">${msgBars || '<span style="color:var(--text-muted)">Aucune donn\u00e9e</span>'}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Distribution des notes</div>
        ${gradeBars || '<div class="card-sub">Aucune note</div>'}
      </div>
      <div class="card">
        <div class="card-title">Top 10 canaux</div>
        ${d.topChannels.length ? `<table class="data-table">
          <tr><th>Canal</th><th>Promo</th><th>Messages</th></tr>
          ${d.topChannels.map(c => `<tr><td>${escHtml(c.name)}</td><td style="color:var(--text-secondary)">${escHtml(c.promo_name)}</td><td><strong>${c.message_count}</strong></td></tr>`).join('')}
        </table>` : '<div class="card-sub">Aucun canal</div>'}
      </div>
    </div>

    <div class="card wide" style="margin-top:1rem">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        R\u00e9sum\u00e9 par promotion
        <button class="btn btn-sm btn-primary" onclick="exportStats()">Exporter CSV</button>
      </div>
      <table class="data-table">
        <tr><th>Promotion</th><th>\u00c9tudiants</th><th>Canaux</th><th>Travaux</th><th>Moyenne</th><th>Archiver</th></tr>
        ${d.promosSummary.map(p => `<tr>
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:.5rem"></span>${escHtml(p.name)}
            ${p.archived ? ' <span class="badge archived">archiv\u00e9e</span>' : ''}</td>
          <td>${p.student_count}</td><td>${p.channel_count}</td><td>${p.travaux_count}</td>
          <td>${p.avg_grade ? (Math.round(p.avg_grade * 100) / 100) + '/20' : '\u2014'}</td>
          <td><label class="toggle"><input type="checkbox" ${p.archived ? 'checked' : ''} onchange="toggleArchivePromo(${p.id}, this.checked)"><span class="toggle-slider"></span></label></td>
        </tr>`).join('')}
      </table>
    </div>`

  // Charger la heatmap en parallèle
  const heatmapHtml = await loadHeatmap()
  if (heatmapHtml) {
    el.innerHTML += `<div class="card wide" style="margin-top:1rem">
      <div class="card-title">Heatmap d'activit\u00e9 (90 jours)</div>
      ${heatmapHtml}
    </div>`
  }
}
