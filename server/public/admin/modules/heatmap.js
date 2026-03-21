import { apiFetch } from '../app.js'

export async function loadHeatmap() {
  const json = await apiFetch('/api/admin/heatmap')
  if (!json?.ok) return ''
  const data = json.data
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const grid = {}
  let maxCount = 1
  for (const d of data) {
    const key = `${d.day_of_week}-${d.hour}`
    grid[key] = d.count
    if (d.count > maxCount) maxCount = d.count
  }

  let html = '<div class="heatmap"><div></div>'
  for (let h = 0; h < 24; h++) html += `<div class="heatmap-hour">${h}h</div>`
  for (let d = 0; d < 7; d++) {
    html += `<div class="heatmap-label">${dayNames[d]}</div>`
    for (let h = 0; h < 24; h++) {
      const count = grid[`${d}-${h}`] || 0
      const intensity = count / maxCount
      const color = count === 0 ? 'rgba(255,255,255,.03)' : `rgba(74,144,217,${0.15 + intensity * 0.85})`
      html += `<div class="heatmap-cell" style="background:${color}" data-tip="${dayNames[d]} ${h}h: ${count} msg"></div>`
    }
  }
  html += '</div>'
  return html
}
