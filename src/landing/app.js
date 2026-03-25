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
      ;['cl-version','footer-version','pill-version'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = v
      })
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
  // FEATURE FILTERS
  // ══════════════════════════════════════════════════════════════════════
  window.filterFeats = function(filter) {
    document.querySelectorAll('.feat-filter').forEach(f =>
      f.classList.toggle('active', f.dataset.filter === filter)
    )
    document.querySelectorAll('.feat-card[data-audience]').forEach(card => {
      const audience = card.dataset.audience
      const show = filter === 'all' || audience === 'both' || audience === filter
      card.classList.toggle('hidden', !show)
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEMO INTERACTIVE
  // ══════════════════════════════════════════════════════════════════════
  const TABS         = ['chat', 'dashboard', 'quiz', 'frise']
  const TAB_DURATION = 10000
  let currentTab     = 0
  let cycleTimer     = null

  // ── Messages par canal ───────────────────────────────────────────────
  const CHANNELS = {
    'général': [
      { av:'PM', color:'#3b82f6', name:'Prof. Martin', nameColor:'#3b82f6',
        text: 'Le rendu du <strong>Projet Web E4</strong> est pour vendredi soir. Consultez la grille dans <code>#projet-web</code>.',
        reactions: [{ emoji:'\uD83D\uDC4D', count:4, active:false }, { emoji:'\u2705', count:2, active:false }], delay:300 },
      { av:'JD', color:'#6366f1', name:'Jean Dupont', nameColor:'',
        text: 'Les maquettes sont obligatoires pour ce livrable ?',
        reactions: [], delay:1600 },
      { av:'EL', color:'#ec4899', name:'Emma Lefèvre', nameColor:'',
        text: 'On avait la même question - notre groupe commence le code demain.',
        reactions: [{ emoji:'\uD83D\uDE04', count:1, active:false }], delay:3000 },
      { av:'PM', color:'#3b82f6', name:'Prof. Martin', nameColor:'#3b82f6',
        text: 'Maquettes <strong>optionnelles</strong>. Concentrez-vous sur l\'architecture et la qualité du code.',
        reactions: [{ emoji:'\uD83C\uDF89', count:6, active:false }, { emoji:'\uD83D\uDC4D', count:3, active:false }], delay:4600 },
    ],
    'annonces': [
      { av:'PM', color:'#3b82f6', name:'Prof. Martin', nameColor:'#3b82f6',
        text: '\uD83D\uDCE2 <strong>Planning semaine 12 :</strong> pas de cours jeudi. Rattrapé le vendredi 14h\u201317h en salle B203.',
        reactions: [{ emoji:'\uD83D\uDC4D', count:8, active:false }], delay:300 },
      { av:'PM', color:'#3b82f6', name:'Prof. Martin', nameColor:'#3b82f6',
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
      { av:'PM', color:'#3b82f6', name:'Prof. Martin', nameColor:'#3b82f6',
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
      { av:'PM', color:'#3b82f6', name:'Prof. Martin', nameColor:'#3b82f6',
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
        else {
          clearInterval(iv)
          // Slash command demo after draft
          if (activeChannel === 'général') {
            setTimeout(() => {
              inputEl.textContent = ''
              const slash = '/dev'
              let si = 0
              const siv = setInterval(() => {
                if (si < slash.length) inputEl.textContent = slash.slice(0, ++si)
                else {
                  clearInterval(siv)
                  const popup = document.getElementById('slash-popup')
                  if (popup) { popup.classList.add('visible'); setTimeout(() => popup.classList.remove('visible'), 2500) }
                }
              }, 80)
            }, 1200)
          }
        }
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

  // ── Dashboard ────────────────────────────────────────────────────────
  function renderDashboard() {
    document.querySelectorAll('.demo-dash-widget').forEach(w => {
      w.classList.remove('visible')
      setTimeout(() => w.classList.add('visible'), parseInt(w.dataset.delay || 0) + 50)
    })
  }

  // ── Quiz ─────────────────────────────────────────────────────────────
  let quizAnswered = false
  function renderQuiz() {
    quizAnswered = false
    // Reset bars
    document.querySelectorAll('.quiz-bar').forEach(bar => bar.classList.remove('animated'))
    // Reset options
    document.querySelectorAll('.quiz-option').forEach((opt, i) => {
      opt.classList.remove('quiz-option--selected', 'quiz-option--disabled')
      opt.style.opacity = '0'
      opt.style.transform = 'translateX(-8px)'
      opt.style.cursor = 'pointer'
      opt.onclick = function() { answerQuiz(this) }
      setTimeout(() => {
        opt.style.transition = 'opacity 0.35s ease, transform 0.35s ease'
        opt.style.opacity = '1'
        opt.style.transform = 'translateX(0)'
      }, 200 + i * 120)
    })
    // Auto-answer after 5s if visitor doesn't click (for cycling)
    setTimeout(() => {
      if (!quizAnswered) {
        const correct = document.querySelector('.quiz-option--correct')
        if (correct) answerQuiz(correct)
      }
    }, 5000)
  }

  function answerQuiz(optEl) {
    if (quizAnswered) return
    quizAnswered = true
    optEl.classList.add('quiz-option--selected')
    document.querySelectorAll('.quiz-option').forEach(o => {
      o.classList.add('quiz-option--disabled')
      o.style.cursor = 'default'
      o.onclick = null
    })
    // Show results after selection
    setTimeout(() => {
      document.querySelectorAll('.quiz-bar').forEach((bar, i) => {
        setTimeout(() => bar.classList.add('animated'), i * 200)
      })
    }, 300)
  }

  // ── Frise ───────────────────────────────────────────────────────────
  function renderFrise() {
    document.querySelectorAll('.frise-bar').forEach(bar => {
      bar.classList.remove('visible')
      setTimeout(() => bar.classList.add('visible'), parseInt(bar.dataset.delay || 0) + 50)
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

    // Show/hide sidebar (only visible on chat)
    const sidebar = document.getElementById('demo-sidebar')
    if (sidebar) sidebar.style.display = name === 'chat' ? '' : 'none'

    // Crossfade: fade out current, then fade in new
    const panels = ['panel-chat', 'panel-dashboard', 'panel-quiz', 'panel-frise']
    const panelMap = { chat: 'panel-chat', dashboard: 'panel-dashboard', quiz: 'panel-quiz', frise: 'panel-frise' }
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

    if (name === 'chat')      setTimeout(renderChat, 100)
    if (name === 'dashboard') setTimeout(renderDashboard, 100)
    if (name === 'quiz')      setTimeout(renderQuiz, 200)
    if (name === 'frise')     setTimeout(renderFrise, 100)
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
