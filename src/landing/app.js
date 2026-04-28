/* ══════════════════════════════════════════════════════════════════════════
   Cursus Landing - app.js
   Scroll-triggered mini-demos, dark mode, version fetch
   ══════════════════════════════════════════════════════════════════════════ */

// ── Reduced motion preference ─────────────────────────────────────────────
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Dark mode (pill toggle, both icons always visible) ────────────────────
const saved = localStorage.getItem('cursus-landing-theme')
const initial = saved || 'light'
document.documentElement.dataset.theme = initial

// OS dark-mode preference intentionally ignored; user toggles manually

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  localStorage.setItem('cursus-landing-theme', next)
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Smooth scroll bento -> feature section ──────────────────────────
  // Override de la nav vers les ancres pour ajouter un offset (nav fixe)
  // et un highlight visuel sur la section cible (pulse sur la mini-demo)
  // pour que l'utilisateur voie clairement "je suis arrive ici".
  const NAV_OFFSET = 70 // hauteur de la nav fixe + breathing room
  function smoothScrollToSection(href) {
    const id = href.replace(/^#/, '')
    const el = document.getElementById(id)
    if (!el) return false
    const top = el.getBoundingClientRect().top + window.pageYOffset - NAV_OFFSET
    if (prefersReducedMotion) {
      window.scrollTo(0, top)
    } else {
      window.scrollTo({ top, behavior: 'smooth' })
    }
    // Highlight la mini-demo associee : pulse 1.2s. Utilise un attribut
    // data plutot que toucher au scroll-margin (qui ferait shifter le layout).
    const demo = el.querySelector('.mini-demo')
    if (demo && !prefersReducedMotion) {
      demo.classList.remove('demo-arrived')
      void demo.offsetHeight
      demo.classList.add('demo-arrived')
      setTimeout(() => demo.classList.remove('demo-arrived'), 1500)
    }
    return true
  }
  // Hook tous les liens internes (#feat-*, #features, #audience, #faq, #download)
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const href = a.getAttribute('href') || ''
    if (href === '#' || href.length < 2) return
    a.addEventListener('click', (e) => {
      if (smoothScrollToSection(href)) {
        e.preventDefault()
        // Met a jour l'URL sans nouveau scroll-jank
        if (history.pushState) history.pushState(null, '', href)
      }
    })
  })

  // ── Burger menu toggle ──────────────────────────────────────────────
  const burger = document.getElementById('burger-toggle')
  const mobileMenu = document.getElementById('mobile-menu')

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') === 'true'
      burger.setAttribute('aria-expanded', String(!open))
      mobileMenu.setAttribute('aria-hidden', String(open))
    })

    // Close on link click
    mobileMenu.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', () => {
        burger.setAttribute('aria-expanded', 'false')
        mobileMenu.setAttribute('aria-hidden', 'true')
      })
    })

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        burger.setAttribute('aria-expanded', 'false')
        mobileMenu.setAttribute('aria-hidden', 'true')
        burger.focus()
      }
    })
  }

  // ── Keyboard accessibility for interactive demos ──────────────────
  function handleKeyActivation(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.target.click()
    }
  }

  document.querySelectorAll('.sidebar-ch, .devoir-item, .doc-item, .reaction, .live-opt').forEach(el => {
    el.setAttribute('tabindex', '0')
    el.setAttribute('role', 'button')
    el.addEventListener('keydown', handleKeyActivation)
  })

  // ── GitHub stars fetch ────────────────────────────────────────────────
  fetch('https://api.github.com/repos/rohanfosse/cursus')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data?.stargazers_count) return
      const el = document.getElementById('gh-stars')
      if (el) el.textContent = data.stargazers_count + ' stars'
    }).catch(() => {})

  // ── Version fetch (GitHub releases — fallback silencieux sur les valeurs hardcodees) ─
  fetch('https://api.github.com/repos/rohanfosse/cursus/releases/latest')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data?.tag_name) return
      const v = data.tag_name.startsWith('v') ? data.tag_name : 'v' + data.tag_name
      ;['pill-version', 'footer-version'].forEach(id => {
        const el = document.getElementById(id)
        if (el) el.textContent = v
      })
    }).catch(() => {})

  // ── OS detection (kept for analytics, Web is always recommended) ──────

  // ── Scroll reveal (IntersectionObserver) ──────────────────────────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible')
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' })

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el))

  // ── Dashboard counter animation ───────────────────────────────────────
  function animateCounters() {
    document.querySelectorAll('.counter').forEach(el => {
      const section = el.closest('.feature-section')
      if (!section?.classList.contains('visible')) return
      if (el.dataset.animated) return
      el.dataset.animated = '1'

      if (prefersReducedMotion) {
        el.textContent = el.dataset.target
        return
      }

      const target = parseFloat(el.dataset.target)
      const duration = 1000
      const start = performance.now()

      function update(now) {
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        el.textContent = (target * eased).toFixed(1)
        if (progress < 1) requestAnimationFrame(update)
      }
      requestAnimationFrame(update)
    })
  }

  // ── Progress ring animation ───────────────────────────────────────────
  function animateProgressRings() {
    document.querySelectorAll('.widget-progress-ring').forEach(ring => {
      const section = ring.closest('.feature-section')
      if (!section?.classList.contains('visible')) return
      if (ring.dataset.animated) return
      ring.dataset.animated = '1'

      const target = parseInt(ring.dataset.target)
      const arc = ring.querySelector('.progress-arc')
      const label = ring.querySelector('.ring-label')

      if (prefersReducedMotion) {
        arc.setAttribute('stroke-dasharray', `${target} 100`)
        label.textContent = target + '%'
        return
      }

      const duration = 1200
      const start = performance.now()

      function update(now) {
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = Math.round(target * eased)
        arc.setAttribute('stroke-dasharray', `${current} 100`)
        label.textContent = current + '%'
        if (progress < 1) requestAnimationFrame(update)
      }
      requestAnimationFrame(update)
    })
  }

  // ── Docs search : recherche reelle qui filtre la grille ──────────────
  // Rotation automatique de termes types (algo / reseau / .pdf / projet / "")
  // pour donner l'illusion d'une vraie session, avec filtrage applique en
  // temps reel sur les data-doc-tags de chaque .doc-item.
  function getDocItems() {
    return Array.from(document.querySelectorAll('#docs-grid .doc-item'))
  }

  function applyDocFilter(query, category) {
    const items = getDocItems()
    const q = (query || '').trim().toLowerCase()
    const cat = category || 'all'
    let visible = 0
    items.forEach(item => {
      const tags = (item.dataset.docTags || '').toLowerCase()
      const itemCat = item.dataset.docCat || ''
      const matchQuery = !q || tags.includes(q) || (item.querySelector('.doc-name')?.textContent || '').toLowerCase().includes(q)
      const matchCat = cat === 'all' || itemCat === cat
      const show = matchQuery && matchCat
      item.classList.toggle('doc-item--hidden', !show)
      if (show) visible++
    })
    const empty = document.getElementById('docs-empty')
    const count = document.getElementById('docs-count')
    if (empty) empty.hidden = visible !== 0
    if (count) count.textContent = visible + ' fichier' + (visible > 1 ? 's' : '')
  }

  function animateDocsSearch() {
    const section = document.getElementById('demo-docs')?.closest('.feature-section')
    if (!section?.classList.contains('visible')) return
    const searchText = document.getElementById('docs-search-text')
    if (!searchText || searchText.dataset.animated) return
    searchText.dataset.animated = '1'

    // Termes successifs : tape, attend, efface, tape le suivant. Filtrage live.
    const sequence = [
      { type: 'algo',   pause: 2200 },
      { type: 'reseau', pause: 2200 },
      { type: '.pdf',   pause: 2000 },
      { type: 'tp',     pause: 2000 },
      { type: '',       pause: 2400 },
    ]

    if (prefersReducedMotion) {
      searchText.textContent = sequence[0].type
      applyDocFilter(sequence[0].type, getCurrentDocsCategory())
      return
    }

    let seqIdx = 0
    let charIdx = 0
    let mode = 'typing' // 'typing' | 'pausing' | 'erasing'
    let lastTick = 0
    let pauseUntil = 0

    function tick(now) {
      const target = sequence[seqIdx].type
      if (mode === 'typing') {
        if (now - lastTick > 80) {
          lastTick = now
          charIdx++
          searchText.textContent = target.slice(0, charIdx)
          applyDocFilter(target.slice(0, charIdx), getCurrentDocsCategory())
          if (charIdx >= target.length) {
            mode = 'pausing'
            pauseUntil = now + sequence[seqIdx].pause
          }
        }
      } else if (mode === 'pausing') {
        if (now >= pauseUntil) {
          mode = target.length > 0 ? 'erasing' : 'typing'
          if (mode === 'typing') {
            seqIdx = (seqIdx + 1) % sequence.length
            charIdx = 0
          }
        }
      } else if (mode === 'erasing') {
        if (now - lastTick > 40) {
          lastTick = now
          charIdx--
          searchText.textContent = target.slice(0, Math.max(0, charIdx))
          applyDocFilter(target.slice(0, Math.max(0, charIdx)), getCurrentDocsCategory())
          if (charIdx <= 0) {
            mode = 'typing'
            seqIdx = (seqIdx + 1) % sequence.length
            charIdx = 0
          }
        }
      }
      // Pause si l'utilisateur a hover la fenetre (volonte de lire)
      const hovered = document.querySelector('#demo-docs .demo-window:hover, #demo-docs .demo-window:focus-within')
      if (hovered) { lastTick = now; pauseUntil = Math.max(pauseUntil, now + 100) }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  function getCurrentDocsCategory() {
    const active = document.querySelector('.docs-cat.docs-cat--active')
    return active?.dataset.docsCat || 'all'
  }

  // Tabs categories : clic = override la recherche typee
  document.querySelectorAll('.docs-cat').forEach(cat => {
    cat.setAttribute('tabindex', '0')
    cat.setAttribute('role', 'button')
    cat.addEventListener('click', () => {
      document.querySelectorAll('.docs-cat').forEach(c => c.classList.toggle('docs-cat--active', c === cat))
      const query = document.getElementById('docs-search-text')?.textContent || ''
      applyDocFilter(query, cat.dataset.docsCat)
    })
    cat.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cat.click() }
    })
  })

  // ── MutationObserver: trigger animations when .visible is added ───────
  document.querySelectorAll('.feature-section').forEach(section => {
    const mo = new MutationObserver(() => {
      if (section.classList.contains('visible')) {
        animateCounters()
        animateProgressRings()
        animateDocsSearch()
        mo.disconnect()
      }
    })
    mo.observe(section, { attributes: true, attributeFilter: ['class'] })
  })

  // Trigger for sections already visible on load
  document.querySelectorAll('.feature-section.visible').forEach(() => {
    animateCounters()
    animateProgressRings()
    animateDocsSearch()
  })

  // ══════════════════════════════════════════════════════════════════════
  //  INTERACTIVE DEMOS
  // ══════════════════════════════════════════════════════════════════════

  // ── Chat demo: clickable channels ─────────────────────────────────────
  // Reactions : format `type:count`, le type mappe vers un SVG via REACTION_ICONS.
  // Cohérent avec la regle "pas d'emoji" du projet (cf. CONTRIBUTING.md).
  const REACTION_ICONS = {
    up:    '<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7l-3-1V10l4-1 4-7c1.05-.05 2 .9 2 2v3a2 2 0 0 0 1 0Z"/></svg>',
    party: '<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-1.13 1.13c-.61.61-1.43.95-2.29.95-.86 0-1.13.45-1.13 1.13v.51c0 .86-.34 1.69-.95 2.29L14 22"/><path d="m16 8 1 1.5"/><path d="M20 6.27c-.96-.81-2.41-.81-3.37 0L8.27 13.6c-.96.81-.96 2.13 0 2.94l1.95 1.65c.96.81 2.41.81 3.37 0l8.36-7.32c.96-.81.96-2.14 0-2.95Z"/></svg>',
    light: '<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  }

  const chatChannels = {
    'général': [
      { av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '10:42', txt: 'Le livrable du <b>Projet Web E4</b> est à rendre vendredi 17h.' },
      { av: 'EL', bg: '#059669', name: 'Emma L.', nc: '', t: '10:44', txt: 'Merci ! On peut travailler en équipe ?' },
      { av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '10:45', txt: 'Oui, groupes de 2-3. Utilisez le canal <b>#projet-web</b> pour coordonner.', rx: 'up:4|party:2' },
    ],
    'annonces': [
      { av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '09:00', txt: '<b>Semaine 12</b> : pas de cours mercredi. TP reporté à jeudi 14h.' },
      { av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '08:30', txt: 'Résultats du TP Algo disponibles dans vos notes.', rx: 'up:8' },
    ],
    'projet-web': [
      { av: 'JD', bg: '#D97706', name: 'Jean D.', nc: '', t: '14:12', txt: 'J\'ai push l\'archi sur le repo. Quelqu\'un peut review ?' },
      { av: 'EL', bg: '#059669', name: 'Emma L.', nc: '', t: '14:15', txt: 'Je regarde ce soir ! C\'est sur quelle branche ?' },
      { av: 'JD', bg: '#D97706', name: 'Jean D.', nc: '', t: '14:16', txt: '<code>feat/auth-module</code>. Merci.', rx: 'up:1' },
    ],
    'algo-tp': [
      { av: 'SB', bg: '#8B5CF6', name: 'Sara B.', nc: '', t: '16:30', txt: 'Quelqu\'un a compris la rotation AVL ? Je bloque sur le cas double.' },
      { av: 'JD', bg: '#D97706', name: 'Jean D.', nc: '', t: '16:35', txt: 'Regarde le <code>balanceFactor</code>. Si > 1 et fils gauche &lt; 0 → rotation gauche-droite.', rx: 'light:3' },
    ]
  }

  function renderReaction(token) {
    // token = "up:4" -> { type: 'up', count: 4 }
    const [type, countStr] = token.trim().split(':')
    const count = parseInt(countStr, 10) || 0
    const icon = REACTION_ICONS[type] || REACTION_ICONS.up
    return `<span class="reaction" data-type="${type}">${icon}<span class="reaction-count">${count}</span></span>`
  }

  function renderMessages(container, msgs, hasTyping) {
    container.innerHTML = ''
    msgs.forEach((m, i) => {
      const reactions = m.rx ? m.rx.split('|').map(renderReaction).join('') : ''
      const div = document.createElement('div')
      div.className = 'demo-msg'
      div.style.setProperty('--delay', (i * 200) + 'ms')
      div.innerHTML = `<div class="msg-avatar" style="background:${m.bg}">${m.av}</div><div class="msg-body"><span class="msg-author"${m.nc ? ` style="color:${m.nc}"` : ''}>${m.name}</span><span class="msg-time">${m.t}</span><div class="msg-text">${m.txt}</div>${reactions ? `<div class="msg-reactions">${reactions}</div>` : ''}</div>`
      container.appendChild(div)
    })
    if (hasTyping) {
      const t = document.createElement('div')
      t.className = 'demo-typing'
      t.style.setProperty('--delay', (msgs.length * 200 + 200) + 'ms')
      t.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span> Jean écrit...'
      container.appendChild(t)
    }

    // Keyboard a11y for dynamically rendered reactions
    container.querySelectorAll('.reaction').forEach(el => {
      el.setAttribute('tabindex', '0')
      el.setAttribute('role', 'button')
      el.addEventListener('keydown', handleKeyActivation)
    })
  }

  document.querySelectorAll('.demo-sidebar-mini .sidebar-ch').forEach(ch => {
    ch.style.cursor = 'pointer'
    ch.addEventListener('click', () => {
      const sidebar = ch.closest('.demo-sidebar-mini')
      sidebar.querySelectorAll('.sidebar-ch').forEach(c => c.classList.remove('active'))
      ch.classList.add('active')

      const name = ch.textContent.replace(/#/g, '').replace(/\d+$/g, '').trim()
      const msgs = chatChannels[name]
      if (!msgs) return

      const win = ch.closest('.demo-window')
      const title = win.querySelector('.demo-title')
      if (title) title.textContent = '# ' + name

      const container = win.querySelector('.demo-messages')
      const hasTyping = name === 'général' || name === 'projet-web'
      renderMessages(container, msgs, hasTyping)

      // Re-trigger entry animations
      container.querySelectorAll('.demo-msg, .demo-typing').forEach(el => {
        el.style.opacity = '0'
        el.style.animation = 'none'
        void el.offsetHeight // force reflow
        el.style.animation = `msgAppear 350ms var(--ease-smooth) forwards`
        el.style.animationDelay = el.style.getPropertyValue('--delay') || getComputedStyle(el).getPropertyValue('--delay')
      })
    })
  })

  // ── Clickable reactions (toggle compteur, format SVG + count) ─────────
  document.addEventListener('click', (e) => {
    const rx = e.target.closest('.reaction')
    if (!rx) return
    const countEl = rx.querySelector('.reaction-count')
    if (!countEl) return
    let count = parseInt(countEl.textContent, 10) || 0
    if (rx.dataset.toggled) {
      count--
      delete rx.dataset.toggled
      rx.classList.remove('reaction--toggled')
    } else {
      count++
      rx.dataset.toggled = '1'
      rx.classList.add('reaction--toggled')
    }
    countEl.textContent = String(count)
  })

  // ── Devoirs demo: expandable items ──────────────────────────────────────
  const devoirDetails = {
    'Projet Web E4': { type: 'Livrable', date: '15 mars 2026', note: 'A', desc: 'Application web responsive avec authentification et CRUD.' },
    'TP Algo':       { type: 'TP individuel', date: '30 mars 2026', note: 'En attente', desc: 'Implémentation d\'un arbre AVL avec rotations.' },
    'Rapport stage': { type: 'Mémoire', date: '15 juin 2026', note: 'En attente', desc: 'Rapport de stage de fin d\'études (40-60 pages).' },
  }

  document.querySelectorAll('.devoir-item').forEach(item => {
    item.style.cursor = 'pointer'
    item.addEventListener('click', () => {
      const next = item.nextElementSibling
      if (next?.classList.contains('devoir-detail')) { next.remove(); return }
      document.querySelectorAll('.devoir-detail').forEach(d => d.remove())

      const name = item.querySelector('.devoir-name')?.textContent || ''
      const d = devoirDetails[name] || { type: 'Devoir', date: '-', note: '-', desc: '' }

      const el = document.createElement('div')
      el.className = 'devoir-detail'
      el.innerHTML = `<div class="detail-row"><span class="detail-label">Type</span><span>${d.type}</span></div><div class="detail-row"><span class="detail-label">Échéance</span><span>${d.date}</span></div><div class="detail-row"><span class="detail-label">Note</span><span>${d.note}</span></div><div class="detail-desc">${d.desc}</div>`
      item.after(el)
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  LIVE QUIZ - multi-questions interactif
  // ══════════════════════════════════════════════════════════════════════
  const quizQuestions = [
    { q: 'Quelle est la complexité d\'un tri fusion ?', opts: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], correct: 1, stats: [12, 68, 15, 5], count: 28 },
    { q: 'Quel protocole utilise le port 443 ?', opts: ['HTTP', 'FTP', 'HTTPS', 'SSH'], correct: 2, stats: [8, 4, 79, 9], count: 31 },
    { q: 'Que signifie le S dans SOLID ?', opts: ['Scalable', 'Single Responsibility', 'Secure', 'Stateless'], correct: 1, stats: [15, 62, 12, 11], count: 26 },
  ]

  const quizContainer = document.getElementById('live-quiz-demo')
  if (quizContainer) {
    const optsEl = document.getElementById('live-quiz-opts')
    const statsEl = document.getElementById('live-quiz-stats')
    const badgeEl = document.getElementById('live-q-badge')
    const textEl = document.getElementById('live-q-text')
    const countEl = document.getElementById('live-q-count')
    const timerEl = document.getElementById('live-q-timer')
    let qIdx = 0, revealed = false, revealT = null, nextT = null, timerIv = null

    function startTimer(seconds) {
      if (timerIv) clearInterval(timerIv)
      let remaining = seconds
      timerEl.textContent = `0:${String(remaining).padStart(2, '0')}`
      timerEl.classList.remove('live-timer--low', 'live-timer--out')
      if (prefersReducedMotion) return
      timerIv = setInterval(() => {
        remaining--
        if (remaining <= 0) {
          clearInterval(timerIv); timerIv = null
          timerEl.textContent = 'Temps écoulé'
          timerEl.classList.add('live-timer--out')
          // Reveal automatique des bonnes réponses si l'utilisateur n'a pas
          // clique : on simule "le prof a coupé le timer".
          if (!revealed) revealAnswers(quizQuestions[qIdx])
          return
        }
        timerEl.textContent = `0:${String(remaining).padStart(2, '0')}`
        // Passe en rouge pulsant les 5 dernieres secondes pour creer du
        // suspense visuel (effet Spark Quiz reel).
        if (remaining <= 5) timerEl.classList.add('live-timer--low')
      }, 1000)
    }

    function revealAnswers(q) {
      revealed = true
      if (timerIv) { clearInterval(timerIv); timerIv = null }
      optsEl.querySelectorAll('.live-opt').forEach((o, i) => {
        o.style.transitionDelay = `${i * 80}ms`
        o.classList.add(parseInt(o.dataset.idx) === q.correct ? 'revealed-correct' : 'revealed-wrong')
      })
      statsEl.classList.add('revealed')
      nextT = setTimeout(() => { qIdx = (qIdx + 1) % quizQuestions.length; renderQuiz(qIdx) }, 3000)
    }

    function renderQuiz(idx) {
      const q = quizQuestions[idx]
      revealed = false
      clearTimeout(revealT); clearTimeout(nextT)
      badgeEl.textContent = `Question ${idx + 1}/${quizQuestions.length}`
      textEl.textContent = q.q
      countEl.textContent = `${q.count} réponses`
      startTimer(30)
      optsEl.innerHTML = q.opts.map((o, i) =>
        `<div class="live-opt" data-idx="${i}" data-correct="${i === q.correct ? 1 : 0}" tabindex="0" role="button"><span class="live-opt-letter">${'ABCD'[i]}</span><span class="live-opt-text">${o}</span><span class="live-check">&#10003;</span></div>`
      ).join('')
      statsEl.innerHTML = q.opts.map((_, i) =>
        `<div class="live-stat-bar"><div class="live-stat-fill${i === q.correct ? ' live-stat-fill--correct' : ''}" style="--w:${q.stats[i]}%"></div><span class="live-stat-label">${'ABCD'[i]}</span><span class="live-stat-pct">${q.stats[i]}%</span></div>`
      ).join('')
      statsEl.classList.remove('revealed')
      optsEl.querySelectorAll('.live-opt').forEach(opt => {
        opt.addEventListener('click', () => onQuizClick(opt, q))
        opt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.click() } })
      })
    }

    function onQuizClick(opt, q) {
      if (revealed) return
      optsEl.querySelectorAll('.live-opt').forEach(o => o.classList.remove('selected'))
      opt.classList.add('selected')
      revealT = setTimeout(() => revealAnswers(q), 800)
    }

    renderQuiz(0)
  }

  // ══════════════════════════════════════════════════════════════════════
  //  LIVE - rotation 4 modes : Spark (quiz) / Pulse / Code / Board
  //
  //  Auto-rotation toutes les 12s, mise en pause au hover, click manuel
  //  override le minuteur. Synchronise le titre de la fenetre + le tab actif.
  // ══════════════════════════════════════════════════════════════════════
  const LIVE_MODES = ['spark', 'pulse', 'code', 'board']
  const LIVE_TITLES = {
    spark: 'Spark — Quiz',
    pulse: 'Pulse — Sondage',
    code:  'Code — Co-edition',
    board: 'Board — Brainstorm',
  }

  const liveTabs   = document.querySelectorAll('.live-tab')
  const livePanes  = document.querySelectorAll('.live-pane')
  const liveTitle  = document.getElementById('live-mode-title')

  // Pulse : nuage de mots avec apparition sequentielle
  const PULSE_WORDS = [
    { w: 'motivé',     s: 22 }, { w: 'curieux',    s: 18 },
    { w: 'serein',     s: 16 }, { w: 'fatigué',    s: 11 },
    { w: 'inquiet',    s: 9  }, { w: 'enthousiaste', s: 14 },
    { w: 'concentré',  s: 13 }, { w: 'perdu',      s: 6  },
    { w: 'satisfait',  s: 12 }, { w: 'overbooké',  s: 7  },
  ]

  function renderPulseCloud() {
    const cloud = document.getElementById('live-pulse-cloud')
    if (!cloud || cloud.dataset.rendered) return
    cloud.dataset.rendered = '1'
    PULSE_WORDS.forEach((entry, i) => {
      const span = document.createElement('span')
      span.className = 'live-pulse-word'
      // Taille proportionnelle au score, mais bornee pour rester lisible
      const fontSize = 11 + Math.min(entry.s, 25) * 0.6
      span.style.fontSize = fontSize + 'px'
      span.style.setProperty('--delay', (i * 80) + 'ms')
      // Couleur : on cycle entre 3 teintes du palette pour casser la mono
      const tints = ['var(--color-rex)', 'var(--color-chat)', 'var(--color-devoirs)']
      span.style.color = tints[i % tints.length]
      span.style.opacity = String(0.55 + Math.min(entry.s, 25) / 60)
      span.textContent = entry.w
      cloud.appendChild(span)
    })
  }

  if (liveTabs.length) {
    let liveAutoT = null
    let liveIdx = 0
    let livePaused = false

    function setLiveMode(mode) {
      liveIdx = LIVE_MODES.indexOf(mode)
      liveTabs.forEach(t => {
        const active = t.dataset.liveMode === mode
        t.classList.toggle('live-tab--active', active)
        t.setAttribute('aria-selected', String(active))
      })
      livePanes.forEach(p => {
        const active = p.dataset.livePane === mode
        p.classList.toggle('live-pane--active', active)
        p.setAttribute('aria-hidden', String(!active))
      })
      if (liveTitle) liveTitle.textContent = LIVE_TITLES[mode] || 'Live'
      if (mode === 'pulse') renderPulseCloud()
    }

    function scheduleNext() {
      if (liveAutoT) clearTimeout(liveAutoT)
      if (prefersReducedMotion || livePaused) return
      liveAutoT = setTimeout(() => {
        liveIdx = (liveIdx + 1) % LIVE_MODES.length
        setLiveMode(LIVE_MODES[liveIdx])
        scheduleNext()
      }, 12000)
    }

    liveTabs.forEach(t => {
      t.addEventListener('click', () => {
        setLiveMode(t.dataset.liveMode)
        scheduleNext()
      })
      t.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click() }
      })
    })

    // Pause de l'auto-rotation au hover de la fenetre Live (l'utilisateur lit).
    const liveWin = document.querySelector('#demo-live .demo-window')
    if (liveWin) {
      liveWin.addEventListener('mouseenter', () => { livePaused = true; if (liveAutoT) clearTimeout(liveAutoT) })
      liveWin.addEventListener('mouseleave', () => { livePaused = false; scheduleNext() })
    }

    // Demarre la rotation seulement quand le panneau devient visible (eviter
    // que les 3 modes s'enchainent en arriere-plan avant que l'user ne scroll).
    const liveSection = document.getElementById('feat-spark')
    if (liveSection) {
      const liveObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { scheduleNext(); liveObs.disconnect() }
        })
      }, { threshold: 0.4 })
      liveObs.observe(liveSection)
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  RDV (mini-Calendly) — 3 onglets : Types / Disponibilités / Mes RDV
  // ══════════════════════════════════════════════════════════════════════
  const rdvData = {
    types: [
      { name: 'Suivi individuel',    duration: 30, color: '#0EA5E9', desc: 'Point hebdomadaire projet' },
      { name: 'Soutenance',          duration: 60, color: '#8B5CF6', desc: 'Jury + 2 intervenants' },
      { name: 'Rattrapage CCTL',     duration: 45, color: '#F59E0B', desc: 'Session de recuperation' },
    ],
    disponibilites: [
      { day: 'Lun', slots: ['09:00', '10:00', '14:00', '15:30'] },
      { day: 'Mar', slots: ['10:00', '14:00'] },
      { day: 'Jeu', slots: ['09:00', '11:00', '14:00', '15:00', '16:00'] },
      { day: 'Ven', slots: ['10:30', '14:00'] },
    ],
    bookings: [
      { who: 'Emma L.',  when: 'Jeu. 9h00',   type: 'Suivi individuel', teams: true },
      { who: 'Jean D.',  when: 'Jeu. 14h00',  type: 'Suivi individuel', teams: true },
      { who: 'Sara B.',  when: 'Ven. 10h30',  type: 'Soutenance',       teams: false },
    ],
  }

  const rexDemo = document.getElementById('rex-demo')
  if (rexDemo) {
    function renderRdv(tab) {
      const panel = rexDemo.querySelector(`[data-rex-panel="${tab}"]`)
      if (!panel) return
      let h = ''
      if (tab === 'types') {
        h = '<div class="rdv-types">' + rdvData.types.map((t, i) => `
          <div class="rdv-type" style="--ic:${t.color};--d:${i * 100}ms">
            <span class="rdv-type-dot"></span>
            <div class="rdv-type-info">
              <span class="rdv-type-name">${t.name}</span>
              <span class="rdv-type-desc">${t.desc}</span>
            </div>
            <span class="rdv-type-duration">${t.duration} min</span>
          </div>
        `).join('') + '</div>'
      } else if (tab === 'disponibilites') {
        h = '<div class="rdv-week">' + rdvData.disponibilites.map((row, i) => `
          <div class="rdv-day" style="--d:${i * 80}ms">
            <span class="rdv-day-label">${row.day}</span>
            <div class="rdv-day-slots">
              ${row.slots.map(s => `<button type="button" class="rdv-slot" data-rdv-day="${row.day}" data-rdv-time="${s}">${s}</button>`).join('')}
            </div>
          </div>
        `).join('') + '</div>'
        h += '<div class="rdv-toast" id="rdv-toast" hidden></div>'
      } else if (tab === 'bookings') {
        h = '<div class="rdv-bookings">' + rdvData.bookings.map((b, i) => `
          <div class="rdv-booking" style="--d:${i * 100}ms">
            <div class="rdv-booking-when">${b.when}</div>
            <div class="rdv-booking-info">
              <span class="rdv-booking-who">${b.who}</span>
              <span class="rdv-booking-type">${b.type}</span>
            </div>
            ${b.teams ? '<span class="rdv-booking-teams" title="Reunion Teams auto">Teams</span>' : ''}
          </div>
        `).join('') + '</div>'
      }
      panel.innerHTML = h
    }

    function switchTab(tab) {
      rexDemo.querySelectorAll('.rex-tab').forEach(t => {
        const isActive = t.dataset.rexTab === tab
        t.classList.toggle('rex-tab--active', isActive)
        t.setAttribute('aria-selected', String(isActive))
      })
      rexDemo.querySelectorAll('.rex-panel').forEach(p => p.classList.toggle('rex-panel--active', p.dataset.rexPanel === tab))
      renderRdv(tab)
    }

    rexDemo.querySelectorAll('.rex-tab').forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.rexTab))
      t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click() } })
    })

    // Booking d'un creneau : clic sur un .rdv-slot -> creneau marque "reserve"
    // + toast inline qui simule la confirmation avec sync Teams. Geste delegue
    // (les .rdv-slot sont rendus dynamiquement par switchTab/renderRdv).
    rexDemo.addEventListener('click', (e) => {
      const slot = e.target.closest('.rdv-slot')
      if (!slot || slot.classList.contains('rdv-slot--booked')) return
      slot.classList.add('rdv-slot--booked')
      const day = slot.dataset.rdvDay
      const time = slot.dataset.rdvTime

      // Compteur dans le footer : decremente le nombre de creneaux dispo
      const countEl = rexDemo.querySelector('.rex-count-num')
      if (countEl) {
        const n = parseInt(countEl.textContent, 10)
        if (!isNaN(n) && n > 0) countEl.textContent = String(n - 1)
      }

      // Toast inline : confirme + auto-dismiss apres 3.5s
      const toast = rexDemo.querySelector('#rdv-toast')
      if (toast) {
        toast.hidden = false
        toast.innerHTML = `
          <span class="rdv-toast-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <div class="rdv-toast-body">
            <span class="rdv-toast-title">RDV réservé · ${day} ${time}</span>
            <span class="rdv-toast-sub">Lien Teams envoyé par email</span>
          </div>
        `
        toast.classList.remove('rdv-toast--leaving')
        clearTimeout(rexDemo._rdvToastT)
        rexDemo._rdvToastT = setTimeout(() => {
          toast.classList.add('rdv-toast--leaving')
          setTimeout(() => { toast.hidden = true; toast.classList.remove('rdv-toast--leaving') }, 300)
        }, 3500)
      }
    })

    switchTab('types')
  }

  // ══════════════════════════════════════════════════════════════════════
  //  LUMEN - liseuse de cours GitHub avec chapitres navigables
  // ══════════════════════════════════════════════════════════════════════
  const lumenChapters = {
    'tri-rapide': {
      readers: 14,
      links: 2,
      progress: 42,
      content: `
        <h1 class="lm-h1">Tri rapide</h1>
        <p class="lm-p">Le <b>quicksort</b> est un algorithme de tri par partition, tres efficace en moyenne.</p>
        <p class="lm-p">Complexite moyenne : <span class="lm-tex">O(n&middot;log n)</span>, pire cas <span class="lm-tex">O(n²)</span>.</p>
        <h2 class="lm-h2">Implementation</h2>
        <pre class="lm-code"><span class="lm-c-kw">function</span> <span class="lm-c-fn">quicksort</span>(arr) {
  <span class="lm-c-kw">if</span> (arr.length &lt;= <span class="lm-c-num">1</span>) <span class="lm-c-kw">return</span> arr
  <span class="lm-c-kw">const</span> pivot = arr[<span class="lm-c-num">0</span>]
  <span class="lm-c-kw">const</span> left  = arr.<span class="lm-c-fn">filter</span>(x =&gt; x &lt; pivot)
  <span class="lm-c-kw">const</span> right = arr.<span class="lm-c-fn">filter</span>(x =&gt; x &gt; pivot)
  <span class="lm-c-kw">return</span> [...<span class="lm-c-fn">quicksort</span>(left), pivot, ...<span class="lm-c-fn">quicksort</span>(right)]
}</pre>
      `,
    },
    'graphes': {
      readers: 9,
      links: 1,
      progress: 18,
      content: `
        <h1 class="lm-h1">Parcours de graphes</h1>
        <p class="lm-p">Le parcours en largeur (<b>BFS</b>) explore un graphe niveau par niveau depuis un sommet source.</p>
        <div class="lm-mermaid" aria-label="Diagramme BFS">
          <div class="lm-node lm-node--start">A</div>
          <div class="lm-edge">→</div>
          <div class="lm-node">B</div>
          <div class="lm-edge">→</div>
          <div class="lm-node">C</div>
          <div class="lm-edge lm-edge--down">↓</div>
          <div class="lm-node lm-node--end">D</div>
        </div>
        <h2 class="lm-h2">BFS en Python</h2>
        <pre class="lm-code"><span class="lm-c-kw">from</span> collections <span class="lm-c-kw">import</span> deque

<span class="lm-c-kw">def</span> <span class="lm-c-fn">bfs</span>(graph, start):
    visited = {start}
    queue = <span class="lm-c-fn">deque</span>([start])
    <span class="lm-c-kw">while</span> queue:
        node = queue.<span class="lm-c-fn">popleft</span>()
        <span class="lm-c-kw">for</span> voisin <span class="lm-c-kw">in</span> graph[node]:
            <span class="lm-c-kw">if</span> voisin <span class="lm-c-kw">not in</span> visited:
                visited.<span class="lm-c-fn">add</span>(voisin)
                queue.<span class="lm-c-fn">append</span>(voisin)</pre>
      `,
    },
    'dynamique': {
      readers: 6,
      links: 3,
      progress: 73,
      content: `
        <h1 class="lm-h1">Programmation dynamique</h1>
        <p class="lm-p">La suite de Fibonacci illustre la memoization pour eviter les recalculs.</p>
        <p class="lm-p">Relation : <span class="lm-tex">F(n) = F(n-1) + F(n-2)</span></p>
        <h2 class="lm-h2">Memoization Python</h2>
        <pre class="lm-code"><span class="lm-c-kw">from</span> functools <span class="lm-c-kw">import</span> lru_cache

@<span class="lm-c-fn">lru_cache</span>(maxsize=<span class="lm-c-kw">None</span>)
<span class="lm-c-kw">def</span> <span class="lm-c-fn">fib</span>(n):
    <span class="lm-c-kw">if</span> n &lt; <span class="lm-c-num">2</span>:
        <span class="lm-c-kw">return</span> n
    <span class="lm-c-kw">return</span> <span class="lm-c-fn">fib</span>(n - <span class="lm-c-num">1</span>) + <span class="lm-c-fn">fib</span>(n - <span class="lm-c-num">2</span>)

<span class="lm-c-fn">print</span>(<span class="lm-c-fn">fib</span>(<span class="lm-c-num">50</span>))  <span class="lm-c-cmt"># 12586269025 — quasi-instantane</span></pre>
      `,
    },
  }

  const lumenMain = document.getElementById('lumen-main')
  const lumenReaders = document.getElementById('lumen-readers')
  const lumenLinks = document.getElementById('lumen-links')
  const lumenProgressFill = document.getElementById('lumen-progress-fill')
  const lumenProgressLabel = document.getElementById('lumen-progress-label')

  function renderLumenChapter(key) {
    const chap = lumenChapters[key]
    if (!chap || !lumenMain) return
    lumenMain.innerHTML = chap.content
    if (lumenReaders) lumenReaders.lastChild.textContent = ` lu par ${chap.readers} étudiants`
    if (lumenLinks)   lumenLinks.lastChild.textContent   = ` ${chap.links} devoir${chap.links > 1 ? 's' : ''} lié${chap.links > 1 ? 's' : ''}`

    // Barre de progression : anime du chapitre precedent vers la nouvelle valeur.
    // On utilise --p (pourcentage) pour piloter la largeur via CSS, ce qui
    // permet la transition CSS native (smoother que JS).
    if (lumenProgressFill) lumenProgressFill.style.setProperty('--p', chap.progress + '%')
    if (lumenProgressLabel) lumenProgressLabel.textContent = chap.progress + '% lu'

    // Animation: fade-in du contenu
    if (!prefersReducedMotion) {
      lumenMain.style.animation = 'none'
      void lumenMain.offsetHeight
      lumenMain.style.animation = 'msgAppear 350ms var(--ease-smooth) forwards'
    }
  }

  document.querySelectorAll('.demo-lumen-chap').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.demo-lumen-chap').forEach(b => {
        const isActive = b === btn
        b.classList.toggle('demo-lumen-chap--active', isActive)
        b.setAttribute('aria-selected', String(isActive))
      })
      renderLumenChapter(btn.dataset.lumenChap)
    })
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click() } })
  })

  if (lumenMain) renderLumenChapter('tri-rapide')

  // ── Docs demo: clickable files with preview ─────────────────────────────
  document.querySelectorAll('.doc-item').forEach(item => {
    item.style.cursor = 'pointer'
    item.addEventListener('click', () => {
      const body = item.closest('.demo-docs-body')
      const old = body.querySelector('.doc-preview')
      if (old) old.remove()

      const name = item.querySelector('span')?.textContent || 'Document'
      const icon = item.querySelector('.doc-icon')?.textContent || ''
      const color = getComputedStyle(item).getPropertyValue('--doc-color').trim() || '#6366F1'
      const previews = {
        PDF: 'Aperçu PDF · 12 pages',
        DOC: 'Document Word · 3 pages',
        XLS: 'Tableur · 45 lignes',
        URL: 'Lien externe',
      }

      const el = document.createElement('div')
      el.className = 'doc-preview'
      el.innerHTML = `<div class="preview-header" style="border-left:3px solid ${color}"><span class="preview-name">${name}</span><span class="preview-close" aria-label="Fermer">&times;</span></div><div class="preview-body"><div class="preview-placeholder">${previews[icon] || 'Fichier'}</div></div>`
      body.appendChild(el)
      el.querySelector('.preview-close').addEventListener('click', e => { e.stopPropagation(); el.remove() })
    })
  })
})
