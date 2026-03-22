/* ══════════════════════════════════════════════════════════════════════════
   Cursus Landing - app.js
   ══════════════════════════════════════════════════════════════════════════ */

// ── Dark mode (pill toggle, both icons always visible) ───────────────────
const saved = localStorage.getItem('cursus-landing-theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const initial = saved || (prefersDark ? 'dark' : 'light')
document.documentElement.dataset.theme = initial

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem('cursus-landing-theme')) {
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'
  }
})

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  localStorage.setItem('cursus-landing-theme', next)
}

// ── DOMContentLoaded ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons()

  // ── Changelog fetch ──────────────────────────────────────────────────
  fetch('/download')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data?.version) return
      const v = data.version
      const badge = document.getElementById('version-badge')
      if (badge) badge.innerHTML = '<span class="hero-eyebrow-dot"></span>' + v + ' \u00B7 Disponible maintenant'
      ;['cl-version','footer-version','pill-version'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = v
      })
      const pillLabel = document.getElementById('pill-label')
      if (pillLabel && data.published_at) {
        const d = new Date(data.published_at)
        const rel = Math.floor((Date.now() - d) / 86400000)
        pillLabel.textContent = rel === 0 ? 'Publi\u00e9e aujourd\'hui' : rel === 1 ? 'Publi\u00e9e hier' : 'Publi\u00e9e il y a ' + rel + ' jours'
      }
      if (data.published_at) {
        const label = new Date(data.published_at).toLocaleDateString('fr-FR', { month:'long', year:'numeric' })
        const cl = document.getElementById('cl-date')
        if (cl) cl.textContent = label.charAt(0).toUpperCase() + label.slice(1)
      }
    }).catch(() => {})

  // ── OS detection for download cards ──────────────────────────────────
  const ua = navigator.userAgent.toLowerCase()
  const os = ua.includes('win') ? 'win' : ua.includes('mac') ? 'mac' : 'web'
  document.getElementById('dl-' + os)?.classList.add('recommended')

  // ── Scroll animations ────────────────────────────────────────────────
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } })
  }, { threshold: 0.06 })
  document.querySelectorAll('.fade-up').forEach(el => obs.observe(el))

  // ══════════════════════════════════════════════════════════════════════
  // DEMO INTERACTIVE
  // ══════════════════════════════════════════════════════════════════════
  const TABS         = ['chat', 'devoirs', 'docs', 'quiz']
  const TAB_DURATION = 12000
  let currentTab     = 0
  let cycleTimer     = null

  // ── Messages par canal ───────────────────────────────────────────────
  const CHANNELS = {
    'général': [
      { av:'PM', color:'#3b82f6', name:'Pilote Martin', nameColor:'#3b82f6',
        text: 'Le rendu du <strong>Projet Web E4</strong> est pour vendredi soir. Consultez la grille dans <code>#projet-web</code>.',
        reactions: [{ emoji:'\uD83D\uDC4D', count:4, active:false }, { emoji:'\u2705', count:2, active:false }], delay:300 },
      { av:'JD', color:'#6366f1', name:'Jean Dupont', nameColor:'',
        text: 'Les maquettes sont obligatoires pour ce livrable ?',
        reactions: [], delay:1600 },
      { av:'EL', color:'#ec4899', name:'Emma Lefèvre', nameColor:'',
        text: 'On avait la même question - notre groupe commence le code demain.',
        reactions: [{ emoji:'\uD83D\uDE04', count:1, active:false }], delay:3000 },
      { av:'PM', color:'#3b82f6', name:'Pilote Martin', nameColor:'#3b82f6',
        text: 'Maquettes <strong>optionnelles</strong>. Concentrez-vous sur l\'architecture et la qualité du code.',
        reactions: [{ emoji:'\uD83C\uDF89', count:6, active:false }, { emoji:'\uD83D\uDC4D', count:3, active:false }], delay:4600 },
    ],
    'annonces': [
      { av:'PM', color:'#3b82f6', name:'Pilote Martin', nameColor:'#3b82f6',
        text: '\uD83D\uDCE2 <strong>Planning semaine 12 :</strong> pas de cours jeudi. Rattrapé le vendredi 14h\u201317h en salle B203.',
        reactions: [{ emoji:'\uD83D\uDC4D', count:8, active:false }], delay:300 },
      { av:'PM', color:'#3b82f6', name:'Pilote Martin', nameColor:'#3b82f6',
        text: 'Les résultats du TP Algo sont disponibles dans l\'application. Consultez vos notes et les commentaires.',
        reactions: [{ emoji:'\uD83D\uDE05', count:5, active:false }, { emoji:'\u2705', count:2, active:false }], delay:1800 },
    ],
    'projet-web': [
      { av:'EL', color:'#ec4899', name:'Emma Lefèvre', nameColor:'',
        text: 'Architecture mise à jour sur le repo. J\'ai séparé le frontend et le backend en deux dossiers distincts.',
        reactions: [{ emoji:'\uD83D\uDD25', count:3, active:false }], delay:300 },
      { av:'JD', color:'#6366f1', name:'Jean Dupont', nameColor:'',
        text: 'PR ouverte pour la partie auth. Quelqu\'un peut relire avant ce soir ?',
        reactions: [], delay:1500 },
      { av:'PM', color:'#3b82f6', name:'Pilote Martin', nameColor:'#3b82f6',
        text: 'Bon avancement ! Pensez à documenter vos endpoints dans le <code>README</code>.',
        reactions: [{ emoji:'\uD83D\uDC4D', count:2, active:false }], delay:2900 },
    ],
    'algo-tp': [
      { av:'TK', color:'#059669', name:'Thomas Klein', nameColor:'',
        text: 'Quelqu\'un a réussi l\'exercice 3 sur les arbres AVL ? Je bloque sur la rotation double.',
        reactions: [], delay:300 },
      { av:'JD', color:'#6366f1', name:'Jean Dupont', nameColor:'',
        text: 'Oui ! La clé c\'est de vérifier le <code>balanceFactor</code> avant et après chaque insertion.',
        reactions: [{ emoji:'\uD83D\uDE4F', count:2, active:false }], delay:1700 },
    ],
    'prof': [
      { av:'PM', color:'#3b82f6', name:'Pilote Martin', nameColor:'#3b82f6',
        text: 'Bonjour ! Votre rendu est bien reçu. Je le corrige ce week-end.',
        reactions: [], delay:300 },
    ],
    'emma': [
      { av:'EL', color:'#ec4899', name:'Emma Lefèvre', nameColor:'',
        text: 'Tu peux relire ma partie sur la gestion des erreurs ? Je ne suis pas sûre du pattern.',
        reactions: [], delay:300 },
    ],
  }

  let activeChannel = 'général'

  function formatTime() {
    const n = new Date(); return n.getHours() + ':' + String(n.getMinutes()).padStart(2,'0')
  }

  function buildReactions(reactions) {
    if (!reactions || reactions.length === 0) return ''
    return reactions.map((r, i) =>
      '<span class="reaction' + (r.active ? ' active' : '') + '" onclick="toggleReaction(this, ' + i + ')" data-idx="' + i + '">' +
        r.emoji + ' <span class="reaction-count">' + r.count + '</span>' +
      '</span>').join('') + '<span class="reaction-add" onclick="addReaction(this)" title="Ajouter une réaction">\uFF0B</span>'
  }

  function renderChat() {
    const container = document.getElementById('chat-messages')
    const inputEl   = document.getElementById('chat-input-text')
    const typingEl  = document.getElementById('typing-indicator')
    container.innerHTML = ''; inputEl.textContent = ''; typingEl.innerHTML = ''

    const msgs = CHANNELS[activeChannel] || CHANNELS['général']
    msgs.forEach((msg, mi) => {
      const el = document.createElement('div')
      el.className = 'chat-msg'
      el.dataset.msgIdx = mi
      el.innerHTML =
        '<div class="chat-av" style="background:' + msg.color + '">' + msg.av + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="chat-name" style="' + (msg.nameColor ? 'color:'+msg.nameColor : '') + '">' + msg.name + ' <span class="chat-time">' + formatTime() + '</span></div>' +
          '<div class="chat-text">' + msg.text + '</div>' +
          '<div class="msg-reactions">' + buildReactions(msg.reactions) + '</div>' +
        '</div>'
      container.appendChild(el)
      setTimeout(() => el.classList.add('visible'), msg.delay)
    })

    const lastMsg = msgs[msgs.length - 1]
    if (lastMsg) {
      setTimeout(() => {
        typingEl.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>&nbsp;Jean Dupont écrit...'
      }, lastMsg.delay + 800)
      setTimeout(() => { typingEl.innerHTML = '' }, lastMsg.delay + 2000)
    }

    const draft = activeChannel === 'général' ? 'Merci pour la précision !' : 'Je regarde ça maintenant'
    let i = 0
    const typingStart = (lastMsg?.delay ?? 0) + 2200
    setTimeout(() => {
      const iv = setInterval(() => {
        if (i < draft.length) inputEl.textContent = draft.slice(0, ++i)
        else clearInterval(iv)
      }, 55)
    }, typingStart)
  }

  // ── Reactions ────────────────────────────────────────────────────────
  window.toggleReaction = function(el, idx) {
    const msgs = CHANNELS[activeChannel]
    const msgEl = el.closest('.chat-msg')
    if (!msgEl) return
    const mi = parseInt(msgEl.dataset.msgIdx)
    const msg = msgs[mi]
    if (!msg?.reactions?.[idx]) return
    const r = msg.reactions[idx]
    r.active = !r.active
    r.count += r.active ? 1 : -1
    el.classList.toggle('active', r.active)
    el.querySelector('.reaction-count').textContent = r.count
  }

  const EMOJI_CYCLE = ['\uD83D\uDC4D','\u2764\uFE0F','\uD83D\uDE04','\uD83C\uDF89','\uD83D\uDD25','\uD83D\uDE4F']
  let emojiIdx = 0
  window.addReaction = function(el) {
    const reactionsDiv = el.parentElement
    const emoji = EMOJI_CYCLE[emojiIdx % EMOJI_CYCLE.length]
    emojiIdx++
    const span = document.createElement('span')
    span.className = 'reaction active'
    span.innerHTML = emoji + ' <span class="reaction-count">1</span>'
    span.onclick = function() {
      const count = parseInt(span.querySelector('.reaction-count').textContent)
      if (count <= 1) { span.remove(); return }
      span.querySelector('.reaction-count').textContent = count - 1
      span.classList.remove('active')
    }
    reactionsDiv.insertBefore(span, el)
  }

  // ── Channel switching ────────────────────────────────────────────────
  window.switchChannel = function(el, channel) {
    if (!document.getElementById('panel-chat') || document.getElementById('panel-chat').style.display === 'none') return
    document.querySelectorAll('#demo-sidebar .demo-channel').forEach(c => c.classList.remove('active'))
    el.classList.add('active')
    const badge = el.querySelector('.demo-channel-badge')
    if (badge) badge.remove()
    activeChannel = channel
    renderChat()
  }

  // ── Devoirs ──────────────────────────────────────────────────────────
  function renderDevoirs() {
    document.querySelectorAll('.devoir-row').forEach(row => {
      row.classList.remove('visible')
      setTimeout(() => row.classList.add('visible'), parseInt(row.dataset.delay || 0) + 50)
    })
    updateDevoirsCount()
  }

  function updateDevoirsCount() {
    const total = document.querySelectorAll('.devoir-row').length
    const done  = document.querySelectorAll('.devoir-check.done').length
    const todo  = total - done
    const count = document.getElementById('devoirs-count')
    if (count) count.textContent = total + ' travaux \u00B7 ' + todo + ' à rendre'
  }

  window.toggleDevoir = function(checkEl) {
    const row = checkEl.closest('.devoir-row')
    const isDone = checkEl.classList.contains('done')
    checkEl.classList.toggle('done', !isDone)
    row.classList.toggle('strikethrough', !isDone)
    updateDevoirsCount()
  }

  // ── Documents ────────────────────────────────────────────────────────
  function renderDocs() {
    document.querySelectorAll('.doc-row').forEach(row => {
      row.classList.remove('visible')
      setTimeout(() => row.classList.add('visible'), parseInt(row.dataset.delay || 0) + 50)
    })
    if (window.lucide) lucide.createIcons()
  }

  window.downloadDoc = function(btn) {
    btn.classList.add('doc-dl-done')
    const orig = btn.innerHTML
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    setTimeout(() => {
      btn.classList.remove('doc-dl-done')
      btn.innerHTML = orig
      if (window.lucide) lucide.createIcons()
    }, 1800)
  }

  // ── Quiz ─────────────────────────────────────────────────────────────
  function renderQuiz() {
    // Animate the result bars in with slower, staggered timing
    document.querySelectorAll('.quiz-bar').forEach((bar, i) => {
      bar.classList.remove('animated')
      setTimeout(() => bar.classList.add('animated'), 400 + i * 250)
    })
    // Animate quiz options appearing
    document.querySelectorAll('.quiz-option').forEach((opt, i) => {
      opt.style.opacity = '0'
      opt.style.transform = 'translateX(-8px)'
      setTimeout(() => {
        opt.style.transition = 'opacity 0.35s ease, transform 0.35s ease'
        opt.style.opacity = '1'
        opt.style.transform = 'translateX(0)'
      }, 200 + i * 120)
    })
  }

  // ── Tab cycling ──────────────────────────────────────────────────────
  function startProgress() {
    const bar = document.getElementById('demo-progress-bar')
    bar.style.transition = 'none'; bar.style.width = '0%'
    void bar.offsetWidth
    bar.style.transition = 'width ' + TAB_DURATION + 'ms cubic-bezier(0.4, 0, 0.6, 1)'
    bar.style.width = '100%'
  }

  function resetProgress() {
    const bar = document.getElementById('demo-progress-bar')
    bar.style.transition = 'none'; bar.style.width = '0%'
  }

  window.switchTab = function(name) {
    clearTimeout(cycleTimer); resetProgress()
    const idx = TABS.indexOf(name)
    if (idx !== -1) { currentTab = idx; activateTab(name); scheduleCycle() }
  }

  function activateTab(name) {
    document.querySelectorAll('.demo-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name))

    // Crossfade: fade out current, then fade in new
    const panels = ['panel-chat', 'panel-devoirs', 'panel-docs', 'panel-quiz']
    const panelMap = { chat: 'panel-chat', devoirs: 'panel-devoirs', docs: 'panel-docs', quiz: 'panel-quiz' }
    const targetId = panelMap[name]

    panels.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return
      if (id === targetId) {
        // Show with fade in
        el.style.display = 'flex'
        el.style.opacity = '0'
        el.style.transform = 'translateY(6px)'
        requestAnimationFrame(() => {
          el.style.transition = 'opacity 0.4s ease, transform 0.4s ease'
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
        })
      } else {
        // Hide with fade out
        el.style.transition = 'opacity 0.25s ease'
        el.style.opacity = '0'
        setTimeout(() => {
          if (!el.classList.contains('active-panel')) el.style.display = 'none'
        }, 250)
      }
    })

    if (name === 'chat')    setTimeout(renderChat, 100)
    if (name === 'devoirs') setTimeout(renderDevoirs, 100)
    if (name === 'docs')    setTimeout(renderDocs, 100)
    if (name === 'quiz')    setTimeout(renderQuiz, 200)
    startProgress()
  }

  function scheduleCycle() {
    cycleTimer = setTimeout(() => {
      currentTab = (currentTab + 1) % TABS.length
      activateTab(TABS[currentTab]); scheduleCycle()
    }, TAB_DURATION)
  }

  activateTab('chat')
  scheduleCycle()

  // Pause cycle on hover
  const demoEl = document.querySelector('.demo-window')
  if (demoEl) {
    demoEl.addEventListener('mouseenter', () => {
      clearTimeout(cycleTimer)
      const bar = document.getElementById('demo-progress-bar')
      const pct = parseFloat(getComputedStyle(bar).width) / parseFloat(getComputedStyle(bar.parentElement).width) * 100
      bar.style.transition = 'none'; bar.style.width = pct + '%'
    })
    demoEl.addEventListener('mouseleave', () => { scheduleCycle(); startProgress() })
  }
})
