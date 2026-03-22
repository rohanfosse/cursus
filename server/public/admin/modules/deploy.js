import { apiFetch, escHtml } from '../app.js'

export async function loadDeploy() {
  const el = document.getElementById('deploy-content')
  el.innerHTML = 'Chargement...'

  // Check environment
  const infoJson = await apiFetch('/api/admin/deploy-info')
  const isDocker = infoJson?.data?.isDocker
  const hasGit = infoJson?.data?.hasGit

  if (isDocker && !hasGit) {
    el.innerHTML = `
      <div class="deploy-docker-msg">
        <strong>Mode Docker d\u00e9tect\u00e9</strong><br><br>
        L'application tourne dans un container Docker. Les op\u00e9rations de d\u00e9ploiement
        (git pull, rebuild, nginx) doivent \u00eatre ex\u00e9cut\u00e9es depuis la <strong>machine h\u00f4te</strong>.<br><br>
        Commandes typiques depuis l'h\u00f4te :
        <pre style="margin-top:.75rem;font-size:.75rem;background:var(--bg);padding:.75rem;border-radius:var(--radius-sm);color:var(--text-secondary);overflow-x:auto">cd /opt/cursus
git pull origin main
docker compose build --no-cache
docker compose up -d --force-recreate
docker image prune -f</pre>
      </div>`
    return
  }

  const json = await apiFetch('/api/admin/git-status')
  if (!json?.ok) { el.innerHTML = '<div class="alert alert-danger">Erreur : ' + escHtml(json?.error || 'impossible de contacter le serveur') + '</div>'; return }
  const g = json.data

  const hasUpdates = g.behind > 0

  el.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="card-title">Statut Git</div>
        <div class="git-info" style="margin-bottom:1rem">
          Branche : <code>${escHtml(g.branch || '\u2014')}</code><br>
          Commit : <code>${escHtml(g.commit || '\u2014')}</code><br>
          Message : <span style="color:var(--text-secondary)">${escHtml(g.message || '')}</span><br>
          Date : <span style="color:var(--text-secondary)">${escHtml(g.date || '\u2014')}</span>
        </div>

        ${hasUpdates ? `<div class="alert alert-info" style="margin-bottom:1rem">
          <strong>${g.behind} commit(s)</strong> en avance sur le serveur. Un <code>git pull</code> est disponible.
        </div>` : '<div class="alert" style="background:rgba(46,204,113,.1);border:1px solid rgba(46,204,113,.2);color:var(--green);margin-bottom:1rem">Le serveur est \u00e0 jour.</div>'}

        ${g.dirty ? `<div class="alert alert-warn" style="margin-bottom:1rem">
          <strong>Fichiers modifi\u00e9s localement</strong> : le pull pourrait \u00e9chouer.
          <pre style="margin-top:.5rem;font-size:.7rem;max-height:100px;overflow:auto;color:var(--text-secondary)">${escHtml(g.statusText)}</pre>
        </div>` : ''}

        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="gitPull()" ${!hasUpdates ? 'disabled style="opacity:.5"' : ''}>
            Git Pull
          </button>
          <button class="btn" style="background:var(--text-muted);color:#fff" onclick="loadDeploy()">
            Rafra\u00eechir
          </button>
        </div>

        <div id="git-pull-output" style="margin-top:1rem;display:none"></div>
      </div>

      <div class="card">
        <div class="card-title">Docker - Rebuild & Restart</div>
        <div class="card-sub" style="margin-bottom:1rem">Rebuilder l'image Docker et relancer le container apr\u00e8s un pull.</div>

        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="dockerRebuild()">
            Rebuild & Restart
          </button>
        </div>

        <div id="docker-output" style="margin-top:1rem;display:none"></div>
      </div>

      <div class="card">
        <div class="card-title">Nginx - Configuration</div>
        <div class="card-sub" style="margin-bottom:1rem">Appliquer le fichier <code>nginx.conf</code> du repo et recharger Nginx.</div>
        <button class="btn btn-primary" onclick="nginxApply()">Appliquer & Recharger Nginx</button>
        <div id="nginx-output" style="margin-top:1rem;display:none"></div>
      </div>
    </div>

    <div class="card wide" style="margin-top:1rem">
      <div class="card-title">Container Docker</div>
      <div id="deploy-docker-list">Chargement...</div>
    </div>`

  // Charger le statut Docker depuis le monitor
  try {
    const mJson = await apiFetch('/api/admin/monitor')
    const dockerEl = document.getElementById('deploy-docker-list')
    if (mJson?.ok && mJson.data.docker?.length) {
      dockerEl.innerHTML = `<table class="data-table">
        <tr><th>Nom</th><th>Status</th><th>Image</th><th>Ports</th></tr>
        ${mJson.data.docker.map(c => `<tr>
          <td><strong>${escHtml(c.name)}</strong></td>
          <td><span class="badge ${c.status.includes('Up') ? 'online' : 'stopped'}">${escHtml(c.status)}</span></td>
          <td style="color:var(--text-secondary)">${escHtml(c.image)}</td>
          <td style="color:var(--text-secondary)">${escHtml(c.ports)}</td>
        </tr>`).join('')}
      </table>`
    } else {
      dockerEl.innerHTML = '<div class="card-sub">Aucun container Docker d\u00e9tect\u00e9</div>'
    }
  } catch {}
}

export async function gitPull() {
  const out = document.getElementById('git-pull-output')
  out.style.display = 'block'
  out.innerHTML = '<div class="alert alert-info">Pull en cours...</div>'

  const json = await apiFetch('/api/admin/git-pull', { method: 'POST' })
  if (json?.ok) {
    out.innerHTML = `<div class="alert" style="background:rgba(46,204,113,.1);border:1px solid rgba(46,204,113,.2);color:var(--green)">
      <strong>Pull r\u00e9ussi</strong>
      <pre style="margin-top:.5rem;font-size:.7rem;color:var(--text-secondary);white-space:pre-wrap">${escHtml(json.data.output)}</pre>
    </div>`
    setTimeout(loadDeploy, 1000)
  } else {
    out.innerHTML = `<div class="alert alert-danger">
      <strong>Erreur</strong>
      <pre style="margin-top:.5rem;font-size:.7rem;white-space:pre-wrap">${escHtml(json?.error || 'Erreur inconnue')}</pre>
    </div>`
  }
}

export async function dockerRebuild() {
  if (!confirm('Rebuilder l\'image Docker et relancer le container ?')) return
  const out = document.getElementById('docker-output')
  out.style.display = 'block'
  out.innerHTML = '<div class="alert alert-info">Rebuild en cours... (peut prendre 1-2 min)</div>'

  const json = await apiFetch('/api/admin/docker-rebuild', {
    method: 'POST',
  })
  if (json?.ok) {
    out.innerHTML = `<div class="alert" style="background:rgba(46,204,113,.1);border:1px solid rgba(46,204,113,.2);color:var(--green)">
      <strong>Rebuild termin\u00e9</strong>
      <pre style="margin-top:.5rem;font-size:.7rem;color:var(--text-secondary);white-space:pre-wrap;max-height:150px;overflow:auto">${escHtml(json.data?.output || 'OK')}</pre>
    </div>`
    setTimeout(loadDeploy, 3000)
  } else {
    out.innerHTML = `<div class="alert alert-danger">
      <strong>Erreur</strong>
      <pre style="margin-top:.5rem;font-size:.7rem;white-space:pre-wrap">${escHtml(json?.error || 'Erreur inconnue')}</pre>
    </div>`
  }
}

export async function nginxApply() {
  if (!confirm('Appliquer nginx.conf et recharger Nginx ?')) return
  const out = document.getElementById('nginx-output')
  out.style.display = 'block'
  out.innerHTML = '<div class="alert alert-info">Application en cours...</div>'

  const json = await apiFetch('/api/admin/nginx-apply', { method: 'POST' })
  if (json?.ok) {
    out.innerHTML = `<div class="alert" style="background:rgba(46,204,113,.1);border:1px solid rgba(46,204,113,.2);color:var(--green)">
      <strong>Nginx recharg\u00e9</strong>
      <pre style="margin-top:.5rem;font-size:.7rem;color:var(--text-secondary);white-space:pre-wrap">${json.data.steps.join('\n')}</pre>
    </div>`
  } else {
    out.innerHTML = `<div class="alert alert-danger">
      <strong>Erreur</strong>
      <pre style="margin-top:.5rem;font-size:.7rem;white-space:pre-wrap">${escHtml(json?.error || 'Erreur inconnue')}</pre>
    </div>`
  }
}
