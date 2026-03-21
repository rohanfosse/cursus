import { apiFetch, escHtml, fmtBytes, fmtDuration, barColor } from '../app.js'

export async function refreshServer() {
  const dot = document.getElementById('status-dot')
  const txt = document.getElementById('status-text')
  try {
    const json = await apiFetch('/api/admin/monitor')
    if (!json) return
    if (!json.ok) throw new Error(json.error)
    dot.className = 'dot'; txt.textContent = 'Live \u2014 ' + new Date().toLocaleTimeString('fr-FR')
    renderServer(json.data)
  } catch (e) {
    dot.className = 'dot error'; txt.textContent = 'Erreur: ' + e.message
  }
}

function renderServer(d) {
  const grid = document.getElementById('metrics-grid')
  const memPct = d.memory.percent
  const diskPct = d.disk?.percent ?? 0
  const swapPct = d.swap?.total ? Math.round((d.swap.used / d.swap.total) * 100) : 0

  grid.innerHTML = `
    <div class="card">
      <div class="card-title">CPU</div>
      <div class="card-value">${d.cpu.usage}%</div>
      <div class="card-sub">${d.cpu.cores} cores \u2014 Load: ${d.system.loadAvg.join(' / ')}</div>
      <div class="bar-bg"><div class="bar-fill ${barColor(d.cpu.usage)}" style="width:${d.cpu.usage}%"></div></div>
    </div>
    <div class="card">
      <div class="card-title">M\u00e9moire RAM</div>
      <div class="card-value">${fmtBytes(d.memory.used)} <span style="font-size:.9rem;color:var(--text-muted)">/ ${fmtBytes(d.memory.total)}</span></div>
      <div class="card-sub">${memPct}% utilis\u00e9 \u2014 ${fmtBytes(d.memory.free)} libre</div>
      <div class="bar-bg"><div class="bar-fill ${barColor(memPct)}" style="width:${memPct}%"></div></div>
    </div>
    <div class="card">
      <div class="card-title">Disque</div>
      <div class="card-value">${fmtBytes(d.disk?.used)} <span style="font-size:.9rem;color:var(--text-muted)">/ ${fmtBytes(d.disk?.total)}</span></div>
      <div class="card-sub">${diskPct}% utilis\u00e9 \u2014 ${fmtBytes(d.disk?.free)} libre</div>
      <div class="bar-bg"><div class="bar-fill ${barColor(diskPct)}" style="width:${diskPct}%"></div></div>
    </div>
    <div class="card">
      <div class="card-title">Swap</div>
      <div class="card-value">${d.swap ? fmtBytes(d.swap.used) : 'N/A'} <span style="font-size:.9rem;color:var(--text-muted)">/ ${d.swap ? fmtBytes(d.swap.total) : '\u2014'}</span></div>
      <div class="card-sub">${d.swap ? swapPct + '% utilis\u00e9' : 'Aucun swap configur\u00e9'}</div>
      ${d.swap ? `<div class="bar-bg"><div class="bar-fill ${barColor(swapPct)}" style="width:${swapPct}%"></div></div>` : ''}
    </div>
    <div class="card">
      <div class="card-title">Uptime Syst\u00e8me</div>
      <div class="card-value">${fmtDuration(d.system.uptime)}</div>
      <div class="card-sub">${d.system.hostname} \u2014 Node ${d.system.nodeVersion}</div>
    </div>
    <div class="card">
      <div class="card-title">Base de donn\u00e9es & Logs</div>
      <div class="card-value">${fmtBytes(d.db.size)}</div>
      <div class="card-sub">DB SQLite \u2014 Logs: ${fmtBytes(d.logs.size)}</div>
    </div>
    <div class="card">
      <div class="card-title">Services</div>
      <div class="svc-grid">
        <div class="svc"><div class="dot ${d.services.nginx === 'active' ? 'ok' : 'ko'}"></div>Nginx</div>
        <div class="svc"><div class="dot ${d.services.ssh === 'active' ? 'ok' : 'ko'}"></div>SSH</div>
        <div class="svc"><div class="dot ${d.services.fail2ban === 'active' ? 'ok' : 'ko'}"></div>Fail2ban</div>
        <div class="svc"><div class="dot ${d.services.ufw?.includes('active') ? 'ok' : 'ko'}"></div>UFW</div>
      </div>
      <div class="card-sub" style="margin-top:.75rem">IPs bannies: <strong>${d.security.bannedIPs}</strong></div>
    </div>
    <div class="card">
      <div class="card-title">Certificats SSL</div>
      ${d.security.certs.length ? d.security.certs.map(c => `
        <div class="cert">
          <span class="cert-name">${escHtml(c.name)}</span>
          <span style="color:${c.valid ? 'var(--green)' : 'var(--red)'}">
            ${c.valid ? '\u2713' : '\u2717'} ${escHtml(c.expiry || '\u2014')}
          </span>
        </div>
      `).join('') : '<div class="card-sub">Aucun certificat d\u00e9tect\u00e9</div>'}
    </div>
    <div class="card wide">
      <div class="card-title">Container Docker</div>
      ${d.docker ? `<table class="data-table">
        <tr><th>Nom</th><th>Status</th><th>Image</th><th>Ports</th><th>Uptime</th></tr>
        ${d.docker.map(c => `<tr>
          <td><strong>${escHtml(c.name)}</strong></td>
          <td><span class="badge ${c.status.includes('Up') ? 'online' : 'stopped'}">${escHtml(c.status)}</span></td>
          <td style="color:var(--text-secondary)">${escHtml(c.image)}</td>
          <td style="color:var(--text-secondary)">${escHtml(c.ports)}</td>
          <td>${escHtml(c.uptime || '\u2014')}</td>
        </tr>`).join('')}
      </table>` : d.pm2?.length ? `<table class="data-table">
        <tr><th>Nom</th><th>Status</th><th>CPU</th><th>RAM</th><th>Uptime</th><th>Restarts</th></tr>
        ${d.pm2.map(p => `<tr>
          <td><strong>${escHtml(p.name)}</strong></td>
          <td><span class="badge ${p.status}">${p.status}</span></td>
          <td>${p.cpu ?? 0}%</td><td>${fmtBytes(p.memory)}</td>
          <td>${fmtDuration(p.uptime / 1000)}</td><td>${p.restart}</td>
        </tr>`).join('')}
      </table>` : '<div class="card-sub">Aucun processus d\u00e9tect\u00e9</div>'}
    </div>
    <div class="card wide">
      <div class="card-title">D\u00e9ploiement Git</div>
      <div class="git-info">
        Branche: <code>${escHtml(d.git.branch || '\u2014')}</code> &nbsp;
        Commit: <code>${escHtml(d.git.commit || '\u2014')}</code> &nbsp;
        <span style="color:var(--text-secondary)">${escHtml(d.git.message || '')}</span><br>
        Derni\u00e8re MAJ: <span style="color:var(--text-secondary)">${escHtml(d.git.date || '\u2014')}</span>
      </div>
    </div>`
}
