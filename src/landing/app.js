/* ══════════════════════════════════════════════════════════════════════════
   Cursus Landing - app.js
   Scroll-triggered mini-demos, dark mode, version fetch.

   v2.263 : algorithmes pour rendre les demos plus credibles
   - Live poll progressif : votes biases + easing vers la distribution finale
   - Bento counters : drift aleatoire avec animation easing cubic
   - RDV slots : generateur heuristique (jour-de-semaine, densite)
   - Docs fuzzy search : Levenshtein normalise pour tolerer 1-2 typos
   - Sparkline random walk : seed deterministe par jour (changement quotidien)
   - Pulse word cloud : layout force-directed leger
   - Markov bigrams : generation de phrases pour le chat
   ══════════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════════
//  ALGORITHMES — utilitaires reutilisables pour les demos
// ══════════════════════════════════════════════════════════════════════════

// PRNG seede (Mulberry32) — produit des sequences pseudo-aleatoires
// reproductibles pour une seed donnee. Utilise pour les sparklines et
// les RDV slots qui doivent rester stables au sein d'une session.
function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s |= 0
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Easing cubic out — pour les animations de compteurs. */
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }

/** Easing in-out cubic — pour les transitions de barres. */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Distance de Levenshtein normalisee (resultat dans [0, 1]).
 * Utilisee pour la recherche fuzzy des docs : un score < 0.35 = match.
 */
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = []
  for (let i = 0; i <= b.length; i++) m[i] = [i]
  for (let j = 0; j <= a.length; j++) m[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1)
    }
  }
  return m[b.length][a.length]
}
function fuzzyScore(query, target) {
  const q = (query || '').toLowerCase().trim()
  const t = (target || '').toLowerCase()
  if (!q) return 0
  if (t.includes(q)) return 0 // exact substring = score min
  return levenshtein(q, t) / Math.max(q.length, t.length)
}

/**
 * Random walk seedee : retourne N points entre 10-90 qui ressemblent a
 * une serie temporelle plausible (variations bornees, tendance preservee).
 * Seed = jour-de-l'annee -> chaque jour = nouvelle serie, mais stable
 * au sein de la session.
 */
function seededRandomWalk(seed, n, min = 10, max = 90) {
  const rng = mulberry32(seed)
  let v = (min + max) / 2
  const out = []
  for (let i = 0; i < n; i++) {
    const delta = (rng() - 0.5) * 22
    v = Math.max(min, Math.min(max, v + delta))
    out.push(Math.round(v))
  }
  return out
}

/** Construit un path SVG pour un sparkline a partir d'un tableau de valeurs. */
function buildSparklinePath(values, width = 100, height = 24) {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = width / Math.max(1, values.length - 1)
  return values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)
  }).join(' ')
}

/**
 * Vote biaise : pour chaque option, retourne 1/0 selon la probabilite
 * de cette option. La somme des proba doit faire 1. Utilise pour le
 * live poll : un vote, on tire l'option en fonction de la distribution
 * finale "biased toward correct".
 */
function pickBiased(weights) {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return weights.length - 1
}

/**
 * Construit une chaine de Markov d'ordre 2 (bigrammes) sur un corpus.
 * `walk` retourne une phrase de longueur ~ targetLen mots. Plus le corpus
 * est grand, plus les phrases sonnent "naturelles".
 */
function buildMarkov(corpus) {
  const chain = new Map()
  for (const sentence of corpus) {
    const words = sentence.split(/\s+/)
    for (let i = 0; i < words.length - 1; i++) {
      const key = words[i].toLowerCase()
      if (!chain.has(key)) chain.set(key, [])
      chain.get(key).push(words[i + 1])
    }
  }
  return chain
}
function markovWalk(chain, seed, targetLen = 8) {
  const start = seed || [...chain.keys()][Math.floor(Math.random() * chain.size)]
  const out = [start]
  let cur = start.toLowerCase()
  for (let i = 0; i < targetLen; i++) {
    const choices = chain.get(cur)
    if (!choices || !choices.length) break
    const next = choices[Math.floor(Math.random() * choices.length)]
    out.push(next)
    cur = next.toLowerCase().replace(/[.,!?]$/, '')
  }
  // Cleanup ponctuation : on coupe au prochain "." dans le tail
  const text = out.join(' ').replace(/\s+([.,!?])/g, '$1')
  return text.charAt(0).toUpperCase() + text.slice(1)
}



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

  // ── Bento counters : drift aleatoire avec animation easing ──────────
  // Chaque pill du bento (3 en ligne / 28 reponses / 13 RDV / 42 fichiers)
  // varie legerement au cours du temps pour donner l'effet "ca vit".
  // Toutes les variations restent dans une bande raisonnable (+/-2 pour
  // les counts, +/-3 pour 42, etc.) pour ne pas paraitre erratique.
  if (!prefersReducedMotion) {
    const COUNTERS = [
      { selector: '.bento-card[data-color="chat"] .bento-live-pill',     base: 3,  range: 1, suffix: '',    interval: 8000 },
      { selector: '.bento-card[data-color="docs"] .bento-stat-pill',     base: 42, range: 3, suffix: '',    interval: 12000 },
      { selector: '.bento-card[data-color="rex"] .bento-stat-pill',      base: 13, range: 1, suffix: '',    interval: 11000 },
      // Live "28 reponses" tick toujours up, jusqu'a +5 puis reset
      { selector: '.bento-card[data-color="live"] .bento-live-meta span:first-child', base: 28, range: 5, suffix: ' réponses', interval: 4500, monotonic: true },
    ]
    function animateCounter(el, fromVal, toVal, suffix, durationMs = 600) {
      const start = performance.now()
      function tick(now) {
        const t = Math.min(1, (now - start) / durationMs)
        const v = Math.round(fromVal + (toVal - fromVal) * easeOutCubic(t))
        // Conserve l'eventuel <span class="bento-live-dot"> ou prefixe
        const existingChildren = Array.from(el.childNodes).filter(n => n.nodeType === 1)
        const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === 3)
        if (textNodes.length) {
          textNodes[textNodes.length - 1].nodeValue = v + suffix
        } else {
          // Pas de text node : on ajoute juste apres les child elements
          el.appendChild(document.createTextNode(v + suffix))
        }
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
    for (const cfg of COUNTERS) {
      const el = document.querySelector(cfg.selector)
      if (!el) continue
      let current = cfg.base
      const initialText = el.textContent.trim()
      // Detect le suffixe initial pour le preserver (ex: "28 réponses")
      const initialMatch = initialText.match(/^(\d+)(.*)$/)
      const detectedSuffix = initialMatch ? initialMatch[2] : (cfg.suffix || '')
      setInterval(() => {
        let next
        if (cfg.monotonic) {
          next = current + Math.floor(Math.random() * cfg.range) + 1
          if (next > cfg.base + cfg.range * 4) next = cfg.base // soft reset
        } else {
          // Drift autour de la base : -range..+range mais on revient au centre
          const delta = Math.round((Math.random() - 0.5) * cfg.range * 2)
          next = Math.max(1, cfg.base + delta)
        }
        animateCounter(el, current, next, detectedSuffix)
        current = next
      }, cfg.interval + Math.random() * 2000) // jitter pour pas synchroniser
    }
  }

  // ── Bento sparkline (devoirs) : random walk seedee par jour ─────────
  // Mini-courbe SVG sur la card Devoirs montrant "activite 7j" — donne
  // l'illusion d'un mini-dashboard. La seed est jour-de-l'annee :
  // change quotidiennement mais stable dans la session.
  function injectSparkline() {
    const card = document.querySelector('.bento-card[data-color="devoirs"] .bento-demo')
    if (!card) return
    if (card.querySelector('.bento-sparkline')) return
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
    const values = seededRandomWalk(dayOfYear, 14, 20, 80)
    const path = buildSparklinePath(values, 100, 18)
    const svg = document.createElement('div')
    svg.className = 'bento-sparkline'
    svg.innerHTML = `
      <svg viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">
        <path d="${path}" fill="none" stroke="var(--card-accent, var(--color-devoirs))" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${path} L 100 18 L 0 18 Z" fill="var(--card-accent, var(--color-devoirs))" opacity="0.10" />
      </svg>
      <span class="bento-sparkline-label">activité 14j</span>
    `
    card.appendChild(svg)
  }
  injectSparkline()

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

  // Filtre fuzzy : tolere 1-2 typos via Levenshtein normalise.
  // Match exact substring -> score 0 (priorite max), sinon
  // Levenshtein < 0.35 = match flou. Permet "algri" -> "algo",
  // "reso" -> "reseaux", etc.
  function applyDocFilter(query, category) {
    const items = getDocItems()
    const q = (query || '').trim().toLowerCase()
    const cat = category || 'all'
    let visible = 0
    items.forEach(item => {
      const tags = (item.dataset.docTags || '').toLowerCase()
      const name = (item.querySelector('.doc-name')?.textContent || '').toLowerCase()
      const itemCat = item.dataset.docCat || ''
      let matchQuery = true
      if (q) {
        // 1) Exact substring sur tags ou nom
        if (tags.includes(q) || name.includes(q)) {
          matchQuery = true
        } else {
          // 2) Fuzzy : on teste contre chaque mot des tags + nom
          const words = (tags + ' ' + name).split(/[\s.\-_/]+/).filter(Boolean)
          matchQuery = words.some(w => fuzzyScore(q, w) < 0.35)
        }
      }
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
    // Rythme volontairement pose pour qu'on voie chaque match : la grille filtre
    // doc-par-doc et l'utilisateur a le temps de lire les noms.
    const sequence = [
      { type: 'algo',   pause: 4000 },
      { type: 'reseau', pause: 4000 },
      { type: '.pdf',   pause: 3500 },
      { type: 'tp',     pause: 3500 },
      { type: '',       pause: 3000 },
    ]
    const TYPE_MS  = 180   // ms par caractere quand on tape
    const ERASE_MS = 110   // ms par caractere quand on efface

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
        if (now - lastTick > TYPE_MS) {
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
        if (now - lastTick > ERASE_MS) {
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
      if (hovered) { lastTick = now; pauseUntil = Math.max(pauseUntil, now + 200) }
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

  // Presence : map des initiales vers un statut online/away/offline
  // affiche en pastille sur l'avatar (animation CSS).
  const CHAT_PRESENCE = { MR: 'online', EL: 'online', JD: 'away', SB: 'online' }

  // ── Channels meta : description + nombre de membres affiches dans le header
  const CHAT_CHANNELS_META = {
    'général':    { desc: 'Canal principal de la promo L3 Info 25-26',  members: 24 },
    'annonces':   { desc: 'Lecture seule · annonces officielles',         members: 24 },
    'projet-web': { desc: 'Coordination Projet Web E4 · 8 équipes',       members: 18 },
    'algo-tp':    { desc: 'Entraide TPs algo · pas de spoilers SVP',      members: 22 },
  }

  // Chaque message peut porter :
  //   - mentions: parse @nom et #channel via la grammaire de msg-text
  //   - att: piece jointe (file | code | link)
  //   - thread: { count, avatars: [initials], lastAt }
  //   - readBy: nb de lectures (badge "lu par X")
  //   - pinned: epinglage visuel avec icone
  const chatChannels = {
    'général': [
      {
        av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '10:42',
        pinned: true,
        txt: '<span class="msg-mention msg-mention--all">@promo</span> Le livrable du <b>Projet Web E4</b> est à rendre <b>vendredi 17h</b>.',
        att: { kind: 'file', icon: 'PDF', color: '#dc2626', name: 'Sujet Projet Web E4.pdf', meta: '2.4 Mo · 12 pages' },
        readBy: 22,
      },
      {
        av: 'EL', bg: '#059669', name: 'Emma L.', nc: '', t: '10:44',
        txt: 'Merci ! <span class="msg-mention" style="--mc:#6366F1">@Prof.Martin</span> on peut travailler en équipe ?',
      },
      {
        av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '10:45',
        txt: 'Oui, groupes de 2-3. Utilisez <button type="button" class="msg-channel" data-go-channel="projet-web">#projet-web</button> pour coordonner.',
        rx: 'up:4|party:2',
        thread: { count: 3, avatars: ['EL', 'JD', 'SB'], lastAt: 'il y a 5 min' },
      },
    ],
    'annonces': [
      {
        av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '09:00',
        pinned: true,
        txt: '<b>Semaine 12</b> · pas de cours mercredi. TP reporté à <b>jeudi 14h</b>, salle B204.',
      },
      {
        av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '08:30',
        txt: 'Résultats du <b>TP Algo</b> disponibles dans vos notes. Moyenne <b>14,2/20</b>.',
        att: { kind: 'link', icon: 'XLS', color: '#059669', name: 'Notes Algo S1.xlsx', meta: 'Ouvert par 18 / 24 étudiants' },
        rx: 'up:8',
      },
    ],
    'projet-web': [
      {
        av: 'JD', bg: '#D97706', name: 'Jean D.', nc: '', t: '14:12',
        txt: 'J\'ai push l\'archi sur le repo. Quelqu\'un peut review ?',
        att: { kind: 'link', icon: 'GIT', color: '#7c3aed', name: 'cesi/projet-web · feat/auth-module', meta: '+312 / -84 sur 7 fichiers · TypeScript' },
      },
      {
        av: 'EL', bg: '#059669', name: 'Emma L.', nc: '', t: '14:15',
        txt: 'Je regarde ce soir ! C\'est sur quelle branche ?',
      },
      {
        av: 'JD', bg: '#D97706', name: 'Jean D.', nc: '', t: '14:16',
        txt: '<code>feat/auth-module</code>. Le middleware JWT vérifie le token côté server :',
        att: { kind: 'code', lang: 'TypeScript', name: 'middleware/auth.ts',
          code: [
            [['kw', 'export'], ['', ' '], ['kw', 'function'], ['', ' '], ['fn', 'requireAuth'], ['', '(req, res, next) {']],
            [['', '  '], ['kw', 'const'], ['', ' token = req.headers.authorization']],
            [['', '    ?.'], ['fn', 'replace'], ['', '('], ['str', "'Bearer '"], ['', ', '], ['str', "''"], ['', ')']],
            [['', '  '], ['kw', 'if'], ['', ' (!token) '], ['kw', 'return'], ['', ' res.'], ['fn', 'status'], ['', '('], ['num', '401'], ['', ')']],
            [['', '  next()']],
            [['', '}']],
          ],
        },
        rx: 'up:1',
      },
    ],
    'algo-tp': [
      {
        av: 'SB', bg: '#8B5CF6', name: 'Sara B.', nc: '', t: '16:30',
        txt: 'Quelqu\'un a compris la rotation AVL ? Je bloque sur le cas double.',
      },
      {
        av: 'JD', bg: '#D97706', name: 'Jean D.', nc: '', t: '16:35',
        txt: 'Regarde le <code>balanceFactor</code>. Si <b>&gt; 1</b> et fils gauche <b>&lt; 0</b> → rotation gauche-droite. Le chapitre du cours explique ça avec un schéma :',
        att: { kind: 'link', icon: 'CRS', color: '#D97706', name: 'Cours · Algo L1 · Arbres équilibrés', meta: '12 min de lecture · 2 devoirs liés' },
        rx: 'light:3',
        thread: { count: 2, avatars: ['SB', 'EL'], lastAt: 'il y a 2 min' },
      },
    ]
  }

  function renderReaction(token) {
    // token = "up:4" -> { type: 'up', count: 4 }
    const [type, countStr] = token.trim().split(':')
    const count = parseInt(countStr, 10) || 0
    const icon = REACTION_ICONS[type] || REACTION_ICONS.up
    return `<span class="reaction" data-type="${type}">${icon}<span class="reaction-count">${count}</span></span>`
  }

  // ── Render attachements : 3 formes possibles (file / link / code) ─────
  function renderAttachment(att) {
    if (!att) return ''
    if (att.kind === 'code') {
      const tokenSpan = (t) => t[0] === '' ? t[1] : `<span class="lm-c-${t[0]}">${t[1]}</span>`
      const lines = att.code.map((toks, i) =>
        `<div class="msg-code-line"><span class="msg-code-num">${i + 1}</span><span class="msg-code-content">${toks.map(tokenSpan).join('')}</span></div>`
      ).join('')
      return `
        <div class="msg-att msg-att--code">
          <div class="msg-att-code-head">
            <span class="msg-att-code-lang">${att.lang}</span>
            <span class="msg-att-code-name">${att.name}</span>
            <span class="msg-att-code-action" aria-hidden="true">Copier</span>
          </div>
          <pre class="msg-att-code-body">${lines}</pre>
        </div>`
    }
    // file ou link : carte horizontale icone + nom + meta + action
    return `
      <div class="msg-att msg-att--${att.kind}">
        <div class="msg-att-icon" style="background:${att.color}">${att.icon}</div>
        <div class="msg-att-info">
          <span class="msg-att-name">${att.name}</span>
          <span class="msg-att-meta">${att.meta}</span>
        </div>
        <span class="msg-att-action">${att.kind === 'link' ? 'Ouvrir' : 'Aperçu'}</span>
      </div>`
  }

  function renderThread(thread) {
    if (!thread) return ''
    const avatars = thread.avatars.map(a => `<span class="msg-thread-av" style="background:${CHAT_AVATAR_COLORS[a] || '#6366F1'}">${a}</span>`).join('')
    return `
      <button type="button" class="msg-thread">
        <span class="msg-thread-avatars">${avatars}</span>
        <span class="msg-thread-text">${thread.count} réponse${thread.count > 1 ? 's' : ''}</span>
        <span class="msg-thread-time">${thread.lastAt}</span>
        <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>`
  }

  // Couleur d'avatar par initiales (cohere avec le reste de la demo).
  const CHAT_AVATAR_COLORS = { MR: '#6366F1', EL: '#059669', JD: '#D97706', SB: '#8B5CF6', TM: '#EC4899', LF: '#06B6D4' }

  function renderMessages(container, msgs, hasTyping, typingName) {
    container.innerHTML = ''
    msgs.forEach((m, i) => {
      const reactions = m.rx ? `<div class="msg-reactions">${m.rx.split('|').map(renderReaction).join('')}<button type="button" class="msg-react-add" aria-label="Ajouter une reaction"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button></div>` : ''
      const att = renderAttachment(m.att)
      const thread = renderThread(m.thread)
      const readBy = m.readBy ? `<div class="msg-readby"><svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/><polyline points="20 12 13 19"/></svg>Lu par ${m.readBy} étudiants</div>` : ''
      const pinned = m.pinned ? '<span class="msg-pin" title="Épinglé"><svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>Épinglé</span>' : ''

      const div = document.createElement('div')
      div.className = 'demo-msg' + (m.pinned ? ' demo-msg--pinned' : '')
      div.style.setProperty('--delay', (i * 200) + 'ms')
      const presence = CHAT_PRESENCE[m.av] || 'online'
      div.innerHTML = `
        <div class="msg-avatar" data-presence="${presence}" style="background:${m.bg}">${m.av}</div>
        <div class="msg-body">
          ${pinned}
          <div class="msg-head">
            <span class="msg-author"${m.nc ? ` style="color:${m.nc}"` : ''}>${m.name}</span>
            <span class="msg-time">${m.t}</span>
          </div>
          <div class="msg-text">${m.txt}</div>
          ${att}
          ${reactions}
          ${thread}
          ${readBy}
        </div>
        <div class="msg-actions" aria-hidden="true">
          <button type="button" class="msg-action" aria-label="Répondre"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></button>
          <button type="button" class="msg-action" aria-label="Réagir"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></button>
          <button type="button" class="msg-action" aria-label="Plus"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg></button>
        </div>`
      container.appendChild(div)
    })
    if (hasTyping) {
      const t = document.createElement('div')
      t.className = 'demo-typing'
      t.style.setProperty('--delay', (msgs.length * 200 + 200) + 'ms')
      t.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span> ${typingName || 'Jean'} écrit...`
      container.appendChild(t)
    }

    // Keyboard a11y for dynamically rendered reactions
    container.querySelectorAll('.reaction').forEach(el => {
      el.setAttribute('tabindex', '0')
      el.setAttribute('role', 'button')
      el.addEventListener('keydown', handleKeyActivation)
    })
  }

  // ── Grammaire CFG : generation de messages projet/info coherents ─────
  // Utilise window.CursusGrammar (charge via grammar.js avant app.js).
  // 6 intentions phrastiques (ANNOUNCE/QUESTION/STATUS/HELP/ACK/REPLY)
  // avec ~30 templates et un vocabulaire de ~150 lemmes (artefacts,
  // topics techniques, verbes, erreurs, jours, outils).
  //
  // Plus credible que Markov : pas de phrases bancales puisque la
  // structure est fixe. Plus diversifie qu'un pool : combinatoire
  // explose avec les substitutions.
  function generateGrammarMessage(intent) {
    if (!window.CursusGrammar) return null
    return window.CursusGrammar.generateMessage(intent ? { intent: intent } : {})
  }
  // Alias retro-compat : si un appel ailleurs cherchait Markov, il
  // tombe sur la grammaire (meilleure qualite). Le buildMarkov/markovWalk
  // restent dispo dans les helpers pour qui voudrait l'utiliser.
  function generateMarkovMessage() {
    return generateGrammarMessage()
  }

  // ── Conversations directes (DM) : 3 fils realistes ──────────────────
  const chatDMs = {
    'Prof. Martin': {
      presence: 'online', lastSeen: 'Connecté · répond en moyenne en 5 min',
      bg: '#6366F1', av: 'MR',
      msgs: [
        { av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '09:12', txt: 'Salut Emma, où tu en es sur le module d\'auth ?' },
        { av: 'EL', bg: '#059669', name: 'Toi', nc: '#059669', t: '09:14', txt: 'Le JWT est en place, je termine le refresh token ce soir.' },
        { av: 'MR', bg: '#6366F1', name: 'Prof. Martin', nc: '#6366F1', t: '09:15', txt: 'Top. Push sur <code>feat/auth-module</code> quand tu peux, je review demain matin.', rx: 'up:1' },
        { av: 'EL', bg: '#059669', name: 'Toi', nc: '#059669', t: '09:16', txt: 'Ça marche, merci !' },
      ],
    },
    'Emma L.': {
      presence: 'online', lastSeen: 'Connectée · sur la promo L3 Info',
      bg: '#059669', av: 'EL',
      msgs: [
        { av: 'EL', bg: '#059669', name: 'Emma L.', nc: '#059669', t: '14:02', txt: 'Tu as commencé le TP Algo ?' },
        { av: 'JD', bg: '#D97706', name: 'Toi', nc: '#D97706', t: '14:05', txt: 'Oui, je bloque sur la rotation double. Tu veux qu\'on regarde ensemble ?' },
        { av: 'EL', bg: '#059669', name: 'Emma L.', nc: '#059669', t: '14:06', txt: 'Carrément. On se voit à 16h en bibli ?' },
        { av: 'JD', bg: '#D97706', name: 'Toi', nc: '#D97706', t: '14:07', txt: 'Deal.', rx: 'up:1' },
      ],
    },
    'Jean D.': {
      presence: 'away', lastSeen: 'Absent · vu il y a 12 min',
      bg: '#D97706', av: 'JD',
      msgs: [
        { av: 'JD', bg: '#D97706', name: 'Jean D.', nc: '#D97706', t: '11:40', txt: 'Tu sais où trouver le sujet du projet ?' },
        { av: 'SB', bg: '#8B5CF6', name: 'Toi', nc: '#8B5CF6', t: '11:42', txt: 'Dans <button type="button" class="msg-channel" data-go-channel="annonces">#annonces</button>, c\'est l\'épinglé avec le PDF.' },
        { av: 'JD', bg: '#D97706', name: 'Jean D.', nc: '#D97706', t: '11:43', txt: 'Trouvé, merci.' },
      ],
    },
  }

  // Tracking de la conversation active (channel ou DM) pour que le send
  // handler sache où poster + d'où venir la fausse reponse bot.
  let activeConv = { type: 'channel', name: 'général' }

  // ── Render initial du canal "général" + handlers de switch ──────────
  function renderChannel(name) {
    const baseMsgs = chatChannels[name]
    if (!baseMsgs) return

    const win = document.querySelector('#demo-chat .demo-window')
    if (!win) return

    // Header en mode "channel" : hash + nom + nb membres + stack avatars.
    const header = win.querySelector('.chat-header')
    if (header) {
      header.dataset.mode = 'channel'
      const meta = CHAT_CHANNELS_META[name] || { desc: '', members: 0 }
      const headerChan = win.querySelector('#chat-header-channel')
      const headerDesc = win.querySelector('#chat-header-desc')
      if (headerChan) headerChan.textContent = name
      if (headerDesc) headerDesc.textContent = `${meta.desc} · ${meta.members} membres`
    }
    // Placeholder input mis a jour avec le canal courant + tracking conv active
    const realInput = document.getElementById('chat-input-real')
    if (realInput) realInput.placeholder = `Écrire dans #${name}…`
    activeConv = { type: 'channel', name }

    // 35% de chance d'ajouter un message genere a la fin (effet
    // "conversation qui continue") different a chaque switch.
    let msgs = baseMsgs
    if (Math.random() < 0.35) {
      const generated = generateMarkovMessage()
      if (generated) {
        const author = baseMsgs[Math.floor(Math.random() * baseMsgs.length)]
        const t = new Date()
        const time = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0')
        msgs = [...baseMsgs, {
          av: author.av, bg: author.bg, name: author.name, nc: author.nc,
          t: time, txt: generated,
        }]
      }
    }

    const container = win.querySelector('#demo-messages-container')
    const TYPING_BY_CHAN = { 'général': 'Jean', 'projet-web': 'Sara', 'algo-tp': 'Emma' }
    const typingName = TYPING_BY_CHAN[name]
    renderMessages(container, msgs, !!typingName, typingName)
    triggerMessagesAnim(container)
  }

  function renderDM(name) {
    const dm = chatDMs[name]
    if (!dm) return
    const win = document.querySelector('#demo-chat .demo-window')
    if (!win) return

    // Header en mode "dm" : avatar + nom + status, hide le members stack.
    const header = win.querySelector('.chat-header')
    if (header) {
      header.dataset.mode = 'dm'
      const headerChan = win.querySelector('#chat-header-channel')
      const headerDesc = win.querySelector('#chat-header-desc')
      const headerName = win.querySelector('.chat-header-name')
      if (headerName) {
        // Remplace le hash + name par avatar + name.
        headerName.innerHTML = `<span class="chat-header-avatar" data-presence="${dm.presence}" style="background:${dm.bg}">${dm.av}</span><span id="chat-header-channel">${name}</span>`
      }
      if (headerDesc) headerDesc.textContent = dm.lastSeen
    }
    // Placeholder input mis a jour pour le DM + tracking conv active
    const realInput = document.getElementById('chat-input-real')
    if (realInput) realInput.placeholder = `Écrire à ${name}…`
    activeConv = { type: 'dm', name }

    const container = win.querySelector('#demo-messages-container')
    renderMessages(container, dm.msgs, false)
    triggerMessagesAnim(container)
  }

  function triggerMessagesAnim(container) {
    container.querySelectorAll('.demo-msg, .demo-typing').forEach(el => {
      el.style.opacity = '0'
      el.style.animation = 'none'
      void el.offsetHeight
      el.style.animation = `msgAppear 350ms var(--ease-smooth) forwards`
      el.style.animationDelay = el.style.getPropertyValue('--delay') || getComputedStyle(el).getPropertyValue('--delay')
    })
  }

  // Render initial : remplit le canal "général" sans clic.
  renderChannel('général')

  // Switch de canal
  document.querySelectorAll('#demo-chat .sidebar-ch').forEach(ch => {
    ch.style.cursor = 'pointer'
    ch.addEventListener('click', () => {
      document.querySelectorAll('#demo-chat .sidebar-ch').forEach(c => c.classList.remove('active'))
      document.querySelectorAll('#demo-chat .sidebar-dm').forEach(d => d.classList.remove('sidebar-dm--active'))
      ch.classList.add('active')
      const name = ch.dataset.channel || ch.querySelector('.ch-name')?.textContent.trim() || ''
      renderChannel(name)
    })
  })

  // Liens #channel cliquables dans les messages : delegation sur le container.
  // Utilise par "Utilisez #projet-web pour coordonner" etc.
  const chatMessagesContainer = document.getElementById('demo-messages-container')
  if (chatMessagesContainer) {
    chatMessagesContainer.addEventListener('click', (e) => {
      const link = e.target.closest('[data-go-channel]')
      if (!link) return
      const target = link.dataset.goChannel
      const sidebarCh = document.querySelector(`#demo-chat .sidebar-ch[data-channel="${target}"]`)
      if (sidebarCh) sidebarCh.click()
    })
  }

  // Switch vers une conversation directe (DM)
  document.querySelectorAll('#demo-chat .sidebar-dm').forEach(dm => {
    dm.style.cursor = 'pointer'
    dm.addEventListener('click', () => {
      document.querySelectorAll('#demo-chat .sidebar-ch').forEach(c => c.classList.remove('active'))
      document.querySelectorAll('#demo-chat .sidebar-dm').forEach(d => d.classList.remove('sidebar-dm--active'))
      dm.classList.add('sidebar-dm--active')
      const name = dm.querySelector('.sidebar-dm-name')?.textContent.trim() || ''
      renderDM(name)
    })
    dm.setAttribute('tabindex', '0')
    dm.setAttribute('role', 'button')
    dm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dm.click() }
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  Chat input : envoi du visiteur + reponse contextuelle intelligente
  //
  //  Pipeline cote envoi :
  //    1. detectIntent(text) -> { kind: 'mention' | 'question' | 'ack' |
  //                               'help' | 'status' | 'greet' | 'default',
  //                               target?: string }
  //    2. pickRespondent(intent) -> personne qui repond (priorite mention)
  //    3. craftReplyText(intent, respondent) -> texte (grammar + heuristics)
  //
  //  Pour les @mentions : autocomplete dans l'input (#mention-suggest), et
  //  rendu inline avec .msg-mention dans la bulle visiteur.
  // ══════════════════════════════════════════════════════════════════════
  const chatInputSend = document.getElementById('chat-input-send')
  const chatInputReal = document.getElementById('chat-input-real')
  const mentionSuggest = document.getElementById('mention-suggest')

  // Personnes mentionnables (cf. sidebar du chat). aliases sert au matching
  // quand l'utilisateur tape "@emma" -> trouve "Emma L.".
  const KNOWN_PEOPLE = [
    { name: 'Emma L.',      av: 'EL', bg: '#059669', firstName: 'Emma',   aliases: ['emma', 'emmal', 'emma.l'] },
    { name: 'Jean D.',      av: 'JD', bg: '#D97706', firstName: 'Jean',   aliases: ['jean', 'jeand', 'jean.d'] },
    { name: 'Sara B.',      av: 'SB', bg: '#8B5CF6', firstName: 'Sara',   aliases: ['sara', 'sarab', 'sara.b'] },
    { name: 'Prof. Martin', av: 'MR', bg: '#6366F1', firstName: 'Martin', aliases: ['martin', 'profmartin', 'prof.martin', 'prof'] },
  ]

  // Pool de personnes "active" par canal. Permet de varier les reponses.
  const ACTIVE_BY_CHANNEL = {
    'général':    ['Emma L.', 'Sara B.', 'Jean D.'],
    'projet-web': ['Emma L.', 'Sara B.', 'Jean D.'],
    'algo-tp':    ['Jean D.', 'Sara B.', 'Emma L.'],
    'annonces':   [],
  }

  function nowHHMM() {
    const t = new Date()
    return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0')
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  function pickRandom(arr) {
    return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null
  }

  // ── Detection d'intention par patterns regex (8 categories) ───────────
  function detectIntent(text) {
    const t = text.toLowerCase().trim()
    // Mention (priorite la plus haute)
    const m = text.match(/@([\wàâéèêëïîôùûÿñç.-]+)/i)
    if (m) {
      const target = m[1].toLowerCase().replace(/\./g, '')
      if (target === 'promo' || target === 'tous' || target === 'everyone') return { kind: 'mention-all' }
      return { kind: 'mention', target: m[1] }
    }
    // Salutation
    if (/^\s*(salut|bonjour|coucou|hello|yo|hey|bonsoir)\b/.test(t)) return { kind: 'greet' }
    // Remerciement / accuse de reception
    if (/\b(merci|thanks|cimer|reçu|bien noté|noté|nickel|parfait)\b/.test(t)) return { kind: 'ack' }
    // Bug / aide demandee
    if (/\b(bug|erreur|crash|plante|cassed?|cassé|marche\s*pas|fonctionne\s*pas|comprends?\s*pas|j'arrive\s*pas|aide|help)\b/.test(t)) {
      return { kind: 'help' }
    }
    // Question
    if (t.endsWith('?') || /^(qui|quand|comment|pourquoi|où|ou|quoi|est-ce|c'est|peux-tu|peut-on)\b/.test(t)) {
      return { kind: 'question' }
    }
    // Status update / livraison
    if (/\b(fini|terminé|push|commit|deployé|déployé|en\s*cours|bloqué|à\s*review|prêt|merge|merged?)\b/.test(t)) {
      return { kind: 'status' }
    }
    return { kind: 'default' }
  }

  // ── Stylise les @mentions dans le texte du visiteur ──────────────────
  function renderTextWithMentions(text) {
    let out = escapeHtml(text)
    out = out.replace(/@([\wàâéèêëïîôùûÿñç.-]+)/gi, (full, name) => {
      const lname = name.toLowerCase().replace(/\./g, '')
      if (lname === 'promo' || lname === 'tous' || lname === 'everyone') {
        return `<span class="msg-mention msg-mention--all">@${escapeHtml(name)}</span>`
      }
      const found = KNOWN_PEOPLE.find(p => p.aliases.includes(lname))
      const color = found ? found.bg : '#6366F1'
      return `<span class="msg-mention" style="--mc:${color}">@${escapeHtml(name)}</span>`
    })
    return out
  }

  // ── Choix du repondant : prio mention > pool channel > DM ────────────
  function pickRespondent(intent) {
    if (intent.kind === 'mention') {
      const target = intent.target.toLowerCase().replace(/\./g, '')
      const found = KNOWN_PEOPLE.find(p => p.aliases.includes(target))
      if (found) return found
    }
    if (intent.kind === 'mention-all') {
      // @promo : on prend la 1re personne active du canal pour repondre
      const channelPeople = ACTIVE_BY_CHANNEL[activeConv.name] || []
      const first = channelPeople[0]
      if (first) return KNOWN_PEOPLE.find(p => p.name === first)
    }
    if (activeConv.type === 'dm') {
      const dm = chatDMs[activeConv.name]
      if (dm) return { name: activeConv.name, av: dm.av, bg: dm.bg, firstName: activeConv.name.split(/\s+/)[0] }
      return null
    }
    const channelPeople = ACTIVE_BY_CHANNEL[activeConv.name] || []
    const name = pickRandom(channelPeople)
    return name ? KNOWN_PEOPLE.find(p => p.name === name) : null
  }

  // ── Genere le texte de reponse selon l'intention + grammar CFG ───────
  function craftReplyText(intent, respondent) {
    const G = window.CursusGrammar
    switch (intent.kind) {
      case 'mention':
      case 'mention-all':
        // Reply intent avec adresse "@Toi"
        if (G) return G.generateMessage({ intent: 'REPLY', extraVocab: { NAME: ['Toi'] } })
        return 'OK je regarde ça.'
      case 'question':
        // 60% reponse "STATUS" plausible (genre techspeak), 40% question retour
        if (G && Math.random() < 0.6) return G.generateMessage({ intent: 'STATUS' })
        return pickRandom([
          'Bonne question, je creuse.',
          'Tu peux preciser ?',
          'On en parle au prochain TD ?',
          'Aucune idée, mais je regarde.',
          'C\'est dans le cours, chapitre 3 de mémoire.',
        ])
      case 'ack':
        return pickRandom(['De rien !', 'Avec plaisir 🙏', 'Pas de souci.', 'Tranquille.', 'Quand tu veux.'])
      case 'help':
        return pickRandom([
          'Tu as essayé de redémarrer ?',
          'Pousse ton code, on regarde ensemble.',
          'Quelle erreur exactement ?',
          'Vérifie ta version de Node, c\'est souvent ça.',
          'Le cours sur le sujet est dans la liseuse, ça peut aider.',
          'Tu as fait un git pull avant ? Parfois c\'est juste ça.',
          'Donne le stacktrace complet, je regarde.',
        ])
      case 'status':
        if (G && Math.random() < 0.5) return G.generateMessage({ intent: 'ACK' })
        return pickRandom(['Bien noté.', 'Top, ça avance !', 'On garde le rythme alors.', 'Nickel.', 'Bien joué.'])
      case 'greet':
        return pickRandom(['Salut !', 'Hey ! Quoi de neuf ?', 'Yo !', 'Bonjour ! Tu as bien dormi ?', 'Coucou.'])
      default:
        // Fallback sur la grammar CFG (REPLY adresse a Toi)
        if (G) return G.generateMessage({ intent: 'REPLY', extraVocab: { NAME: ['Toi'] } })
        return 'OK noté.'
    }
  }

  // ── DOM helpers : append message visiteur / typing / bot reply ──────
  function appendVisitorMessage(text) {
    const container = document.getElementById('demo-messages-container')
    if (!container) return
    const div = document.createElement('div')
    div.className = 'demo-msg demo-msg--mine'
    div.innerHTML = `
      <div class="msg-avatar" data-presence="online" style="background:#6366F1">Toi</div>
      <div class="msg-body">
        <div class="msg-head">
          <span class="msg-author" style="color:#6366F1">Toi</span>
          <span class="msg-time">${nowHHMM()}</span>
        </div>
        <div class="msg-text">${renderTextWithMentions(text)}</div>
      </div>`
    container.appendChild(div)
    div.style.animation = 'msgAppear 320ms var(--ease-smooth) forwards'
    container.scrollTop = container.scrollHeight
  }

  function appendBotTyping(name) {
    const container = document.getElementById('demo-messages-container')
    if (!container) return null
    const t = document.createElement('div')
    t.className = 'demo-typing demo-typing--reply'
    const firstName = (name || '').split(/\s+/)[0] || 'Quelqu\'un'
    t.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span> ${firstName} écrit...`
    container.appendChild(t)
    container.scrollTop = container.scrollHeight
    return t
  }

  function appendBotReply(respondent, txt) {
    const container = document.getElementById('demo-messages-container')
    if (!container) return
    const div = document.createElement('div')
    div.className = 'demo-msg'
    div.innerHTML = `
      <div class="msg-avatar" data-presence="online" style="background:${respondent.bg}">${respondent.av}</div>
      <div class="msg-body">
        <div class="msg-head">
          <span class="msg-author" style="color:${respondent.bg}">${respondent.name}</span>
          <span class="msg-time">${nowHHMM()}</span>
        </div>
        <div class="msg-text">${renderTextWithMentions(txt)}</div>
      </div>`
    container.appendChild(div)
    div.style.animation = 'msgAppear 320ms var(--ease-smooth) forwards'
    container.scrollTop = container.scrollHeight
  }

  // ── Pipeline d'envoi : detect intent -> pick respondent -> craft reply
  function sendVisitorMessage() {
    if (!chatInputReal) return
    const text = chatInputReal.value.trim()
    if (!text) {
      chatInputSend?.classList.add('demo-input-send--sent')
      setTimeout(() => chatInputSend?.classList.remove('demo-input-send--sent'), 800)
      return
    }
    appendVisitorMessage(text)
    chatInputReal.value = ''
    closeMentionDropdown()
    chatInputSend?.classList.add('demo-input-send--sent')
    setTimeout(() => chatInputSend?.classList.remove('demo-input-send--sent'), 800)

    // Pas de reponse dans #annonces (prof-only)
    if (activeConv.type === 'channel' && !ACTIVE_BY_CHANNEL[activeConv.name]?.length) return

    const intent = detectIntent(text)
    const respondent = pickRespondent(intent)
    if (!respondent) return

    // Reponse principale apres 1-1.5s + typing
    setTimeout(() => {
      const typing = appendBotTyping(respondent.name)
      setTimeout(() => {
        if (typing) typing.remove()
        const replyText = craftReplyText(intent, respondent)
        appendBotReply(respondent, replyText)
        // Bonus : si @promo, une 2eme personne enchaine 4-6s plus tard
        if (intent.kind === 'mention-all') {
          const channelPeople = ACTIVE_BY_CHANNEL[activeConv.name] || []
          const second = channelPeople[1]
          if (second) {
            const r2 = KNOWN_PEOPLE.find(p => p.name === second)
            if (r2) {
              setTimeout(() => {
                const t2 = appendBotTyping(r2.name)
                setTimeout(() => {
                  if (t2) t2.remove()
                  appendBotReply(r2, craftReplyText(intent, r2))
                }, 1300 + Math.random() * 600)
              }, 3500 + Math.random() * 2000)
            }
          }
        }
      }, 1300 + Math.random() * 700)
    }, 1100)
  }

  // ── Mention autocomplete : apparait quand le visiteur tape "@" ────────
  function getMentionContext(input) {
    // Renvoie la query courante (apres le dernier @ tape) ou null
    const v = input.value
    const cursor = input.selectionStart || v.length
    const left = v.slice(0, cursor)
    const m = left.match(/(?:^|\s)@([\wàâéèêëïîôùûÿñç.-]*)$/i)
    return m ? { query: m[1], start: cursor - m[1].length - 1 } : null
  }

  function renderMentionDropdown(query) {
    if (!mentionSuggest) return
    const q = query.toLowerCase()
    const candidates = []
    // @promo en tete si le visiteur tape rien ou "p"
    if (!q || 'promo'.startsWith(q) || 'tous'.startsWith(q)) {
      candidates.push({ kind: 'all', label: '@promo', sub: 'toute la promo', av: '@', bg: '#EF4444' })
    }
    KNOWN_PEOPLE.forEach(p => {
      if (!q || p.name.toLowerCase().includes(q) || p.aliases.some(a => a.startsWith(q))) {
        candidates.push({ kind: 'person', label: p.name, sub: p.firstName, av: p.av, bg: p.bg, value: p.firstName })
      }
    })
    if (!candidates.length) {
      mentionSuggest.hidden = true
      return
    }
    mentionSuggest.innerHTML = candidates.slice(0, 5).map((c, i) => `
      <button type="button" class="mention-item${i === 0 ? ' mention-item--active' : ''}"
              data-mention="${escapeHtml(c.kind === 'all' ? 'promo' : (c.value || c.label))}"
              role="option" aria-selected="${i === 0}">
        <span class="mention-avatar" style="background:${c.bg}">${escapeHtml(c.av)}</span>
        <span class="mention-name">${escapeHtml(c.label)}</span>
        <span class="mention-sub">${escapeHtml(c.sub)}</span>
      </button>
    `).join('')
    mentionSuggest.hidden = false
  }

  function closeMentionDropdown() {
    if (mentionSuggest) mentionSuggest.hidden = true
  }

  function applyMention(value) {
    if (!chatInputReal) return
    const v = chatInputReal.value
    const cursor = chatInputReal.selectionStart || v.length
    const left = v.slice(0, cursor)
    const right = v.slice(cursor)
    const replaced = left.replace(/@([\wàâéèêëïîôùûÿñç.-]*)$/, '@' + value + ' ')
    chatInputReal.value = replaced + right
    const newPos = replaced.length
    chatInputReal.setSelectionRange(newPos, newPos)
    chatInputReal.focus()
    closeMentionDropdown()
  }

  if (chatInputReal) {
    chatInputReal.addEventListener('input', () => {
      const ctx = getMentionContext(chatInputReal)
      if (ctx) renderMentionDropdown(ctx.query)
      else closeMentionDropdown()
    })
    chatInputReal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeMentionDropdown(); return }
      // Si dropdown ouvert : Tab/Enter prend le 1er candidat
      if (mentionSuggest && !mentionSuggest.hidden && (e.key === 'Tab' || e.key === 'Enter')) {
        const active = mentionSuggest.querySelector('.mention-item--active')
        if (active) {
          e.preventDefault()
          applyMention(active.dataset.mention)
          return
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendVisitorMessage()
      }
    })
    chatInputReal.addEventListener('blur', () => {
      // Petit delai pour laisser le clic sur dropdown se propager
      setTimeout(closeMentionDropdown, 150)
    })
  }
  if (mentionSuggest) {
    mentionSuggest.addEventListener('mousedown', (e) => {
      // mousedown plutot que click pour eviter blur de l'input avant selection
      const item = e.target.closest('.mention-item')
      if (!item) return
      e.preventDefault()
      applyMention(item.dataset.mention)
    })
  }
  if (chatInputSend) chatInputSend.addEventListener('click', sendVisitorMessage)

  // ══════════════════════════════════════════════════════════════════════
  //  PETITES ANIMATIONS au clic sur les boutons + et emoji de la zone
  //  d'ecriture. SVG particles qui partent du bouton, fade-out leger.
  // ══════════════════════════════════════════════════════════════════════
  const EMOJI_PARTICLES = [
    '<svg viewBox="0 0 24 24" fill="#EF4444"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="#F59E0B"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="#FBBF24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  ]

  const PLUS_PARTICLES = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="#EC4899" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  ]

  function spawnParticleBurst(button, particles, opts = {}) {
    if (prefersReducedMotion) return
    const burst = document.createElement('span')
    burst.className = 'btn-burst'
    if (opts.radial) burst.classList.add('btn-burst--radial')
    particles.forEach((svg, i) => {
      const p = document.createElement('span')
      p.className = 'btn-burst-p'
      // Direction : float-up avec petit angle latéral (default) ou radial (4 dirs)
      if (opts.radial) {
        const angle = (i / particles.length) * 2 * Math.PI - Math.PI / 2
        p.style.setProperty('--tx', `${Math.cos(angle) * 26}px`)
        p.style.setProperty('--ty', `${Math.sin(angle) * 26}px`)
        p.style.setProperty('--rot', `${Math.cos(angle) * 16}deg`)
      } else {
        p.style.setProperty('--tx', `${(i - (particles.length - 1) / 2) * 12}px`)
        p.style.setProperty('--ty', `-32px`)
        p.style.setProperty('--rot', `${(i - 1.5) * 12}deg`)
      }
      p.style.setProperty('--d', `${i * 50}ms`)
      p.innerHTML = svg
      burst.appendChild(p)
    })
    button.appendChild(burst)
    setTimeout(() => burst.remove(), 1100)
  }

  const chatInputPlus = document.getElementById('chat-input-plus')
  const chatInputEmoji = document.getElementById('chat-input-emoji')

  if (chatInputPlus) {
    chatInputPlus.addEventListener('click', () => {
      chatInputPlus.classList.add('btn-wiggle')
      spawnParticleBurst(chatInputPlus, PLUS_PARTICLES, { radial: true })
      setTimeout(() => chatInputPlus.classList.remove('btn-wiggle'), 500)
    })
  }
  if (chatInputEmoji) {
    chatInputEmoji.addEventListener('click', () => {
      chatInputEmoji.classList.add('btn-bounce')
      spawnParticleBurst(chatInputEmoji, EMOJI_PARTICLES)
      setTimeout(() => chatInputEmoji.classList.remove('btn-bounce'), 500)
    })
  }

  // ── Feedback visuel sur les boutons "muets" de la demo : scale + flash
  // de couleur d'accent. Pas de toast textuel : le visiteur sent juste que
  // le bouton repond, sans qu'on lui dise explicitement "demo only".
  // Le hover prepare deja l'idee, le clic confirme avec un flash vif.
  function attachIdleFeedback(selector) {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (prefersReducedMotion) return
        btn.classList.remove('btn-pulse-feedback')
        void btn.offsetHeight
        btn.classList.add('btn-pulse-feedback')
        setTimeout(() => btn.classList.remove('btn-pulse-feedback'), 600)
      })
    })
  }

  // ── Applique aux boutons "muets" de la demo landing (juste un retour
  // visuel pour signifier que le clic est enregistre, sans pretendre faire
  // l'action reelle).
  attachIdleFeedback('#demo-chat .chat-header-search')
  attachIdleFeedback('#demo-devoirs .devoirs-cta')
  attachIdleFeedback('#demo-chat .msg-react-add')
  attachIdleFeedback('#demo-chat .msg-action')
  attachIdleFeedback('#demo-chat .msg-att-action')
  attachIdleFeedback('#demo-docs .preview-pdf-btn')

  // ══════════════════════════════════════════════════════════════════════
  //  EASTER EGGS - 4 mini-surprises subtiles, sans casser l'experience
  //
  //  1) Konami code (↑↑↓↓←→←→BA) -> pluie de confettis colores
  //  2) Triple-click sur le logo Cursus -> spin 360deg + "ping" sonore
  //  3) Click 7x rapides sur la pill de version -> clin d'oeil Montpellier
  //  4) Click sur "3400+ tests" -> compteur s'envole vers l'infini
  //
  //  Toutes les eggs respectent prefers-reduced-motion (skip animations).
  // ══════════════════════════════════════════════════════════════════════

  // ── 1) Konami : 30 confettis qui tombent du haut de l'ecran ──────────
  const KONAMI = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a']
  let konamiIdx = 0
  document.addEventListener('keydown', (e) => {
    // Ignore si l'utilisateur tape dans un input/textarea (ex: live-pulse-input).
    // Sinon les touches "b" ou "a" peuvent incrementer konamiIdx alors que l'user
    // ne tente pas le code.
    if (e.target?.matches?.('input, textarea, [contenteditable]')) return
    const key = e.key.toLowerCase()
    if (key === KONAMI[konamiIdx]) {
      konamiIdx++
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0
        triggerKonamiConfetti()
      }
    } else {
      konamiIdx = key === KONAMI[0] ? 1 : 0
    }
  })

  function triggerKonamiConfetti() {
    if (prefersReducedMotion) return
    const colors = ['#6366F1', '#059669', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#8B5CF6']
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('span')
      p.className = 'konami-confetti'
      p.style.left = `${Math.random() * 100}%`
      p.style.background = colors[i % colors.length]
      p.style.setProperty('--d', `${Math.random() * 700}ms`)
      p.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`)
      p.style.setProperty('--tx', `${(Math.random() - 0.5) * 160}px`)
      document.body.appendChild(p)
      setTimeout(() => p.remove(), 3500)
    }
    // Mini-toast discret en bas centre
    const toast = document.createElement('div')
    toast.className = 'konami-toast'
    toast.textContent = 'Mode dev unlocked !'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2400)
  }

  // ── 2) Triple-click sur le logo : spin 360° ────────────────────────
  const navLogo = document.querySelector('.nav-logo')
  let logoClicks = []
  navLogo?.addEventListener('click', (e) => {
    const now = Date.now()
    logoClicks = logoClicks.filter(t => now - t < 800).concat(now)
    if (logoClicks.length >= 3) {
      e.preventDefault()
      logoClicks = []
      if (prefersReducedMotion) return
      navLogo.classList.add('logo-spin')
      setTimeout(() => navLogo.classList.remove('logo-spin'), 700)
    }
  })

  // ── 3) Click 7× rapides sur la pill version : "Made in Montpellier" ──
  const versionPill = document.getElementById('pill-version')
  if (versionPill) versionPill.style.cursor = 'pointer'
  let pillClicks = 0
  let pillResetT = null
  versionPill?.addEventListener('click', () => {
    pillClicks++
    clearTimeout(pillResetT)
    pillResetT = setTimeout(() => { pillClicks = 0 }, 1500)
    if (pillClicks >= 7) {
      pillClicks = 0
      const original = versionPill.innerHTML
      versionPill.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="#EF4444" style="vertical-align:-1px;margin-right:4px"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>Montpellier'
      versionPill.classList.add('pill-easter')
      setTimeout(() => {
        versionPill.innerHTML = original
        versionPill.classList.remove('pill-easter')
      }, 2800)
    }
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

  // ══════════════════════════════════════════════════════════════════════
  //  DEVOIRS DEMO - detail riche par statut (rendu / pending / brouillon)
  //
  //  Chaque statut a un mock dedie qui ressemble au vrai dashboard :
  //  - Rendu : grille de notation (rubrique 4 criteres + barres + commentaire)
  //  - Pending : countdown deadline + outline du sujet + boutons d'action
  //  - Brouillon : structure du memoire (chapitres avec progression)
  // ══════════════════════════════════════════════════════════════════════
  const devoirDetails = {
    'Projet Web E4': {
      status: 'done',
      type: 'Livrable · Équipe B',
      team: ['EL', 'JD', 'SB'],
      date: 'Rendu le 14 mars · noté le 18 mars',
      grade: 'A', score: '17 / 20',
      rubric: [
        { label: 'Architecture',  score: 16 },
        { label: 'Qualité du code', score: 18 },
        { label: 'UX / accessibilité', score: 17 },
        { label: 'Documentation', score: 15 },
      ],
      comment: '"Architecture solide, séparation claire des couches. Penser à factoriser les middlewares d\'auth." · Prof. Martin',
    },
    'TP Algo': {
      status: 'pending',
      type: 'TP individuel · Algorithmique',
      date: 'Échéance vendredi 17h',
      countdown: { days: 2, hours: 4 },
      outline: [
        { n: 1, label: 'Implémentation arbre AVL',     done: true  },
        { n: 2, label: 'Rotations gauche / droite',    done: true  },
        { n: 3, label: 'Cas double (LR / RL)',         done: false },
        { n: 4, label: 'Tests unitaires',              done: false },
      ],
      progress: 60,
    },
    'Rapport stage': {
      status: 'draft',
      type: 'Mémoire · 40 à 60 pages',
      date: 'Soutenance 15 juin · Tuteur: Prof. Martin',
      structure: [
        { label: 'Introduction',                progress: 25 },
        { label: "Cadre de l'entreprise",        progress: 80 },
        { label: 'Mission réalisée',             progress: 35 },
        { label: 'Bilan technique',              progress: 0  },
        { label: 'Conclusion & perspectives',    progress: 0  },
      ],
      total: 12,
    },
  }

  function renderDevoirDetail(d) {
    if (d.status === 'done') {
      const team = d.team.map(t => `<span class="dev-avatar dev-avatar--${t.toLowerCase()}">${t}</span>`).join('')
      const rows = d.rubric.map(r => `
        <div class="dev-rubric-row">
          <span class="dev-rubric-label">${r.label}</span>
          <div class="dev-rubric-bar"><div class="dev-rubric-fill" style="--w:${r.score * 5}%"></div></div>
          <span class="dev-rubric-score">${r.score}<span class="dev-rubric-max">/20</span></span>
        </div>`).join('')
      return `
        <div class="dev-detail-head">
          <div class="dev-detail-meta">
            <span class="dev-detail-type">${d.type}</span>
            <span class="dev-detail-date">${d.date}</span>
          </div>
          <div class="dev-detail-team" aria-label="Équipe">${team}</div>
          <div class="dev-grade dev-grade--a">
            <span class="dev-grade-letter">${d.grade}</span>
            <span class="dev-grade-score">${d.score}</span>
          </div>
        </div>
        <div class="dev-rubric">${rows}</div>
        <div class="dev-comment">${d.comment}</div>
      `
    }
    if (d.status === 'pending') {
      const items = d.outline.map(o => `
        <div class="dev-outline-row ${o.done ? 'dev-outline-row--done' : ''}">
          <span class="dev-outline-check" aria-hidden="true">${o.done ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : o.n}</span>
          <span class="dev-outline-label">${o.label}</span>
        </div>`).join('')
      return `
        <div class="dev-detail-head">
          <div class="dev-detail-meta">
            <span class="dev-detail-type">${d.type}</span>
            <span class="dev-detail-date">${d.date}</span>
          </div>
          <div class="dev-countdown">
            <span class="dev-countdown-num">${d.countdown.days}<span class="dev-countdown-unit">j</span></span>
            <span class="dev-countdown-sep">·</span>
            <span class="dev-countdown-num">${d.countdown.hours}<span class="dev-countdown-unit">h</span></span>
          </div>
        </div>
        <div class="dev-progress-row">
          <span class="dev-progress-label">Avancement</span>
          <div class="dev-progress-track"><div class="dev-progress-fill" style="--w:${d.progress}%"></div></div>
          <span class="dev-progress-pct">${d.progress}%</span>
        </div>
        <div class="dev-outline">${items}</div>
      `
    }
    if (d.status === 'draft') {
      const rows = d.structure.map(s => `
        <div class="dev-struct-row">
          <span class="dev-struct-dot" data-state="${s.progress >= 75 ? 'high' : s.progress > 0 ? 'mid' : 'low'}"></span>
          <span class="dev-struct-label">${s.label}</span>
          <span class="dev-struct-bar"><span class="dev-struct-fill" style="--w:${s.progress}%"></span></span>
          <span class="dev-struct-pct">${s.progress}%</span>
        </div>`).join('')
      return `
        <div class="dev-detail-head">
          <div class="dev-detail-meta">
            <span class="dev-detail-type">${d.type}</span>
            <span class="dev-detail-date">${d.date}</span>
          </div>
          <span class="dev-pages-pill"><span class="dev-pages-num">${d.total}</span> pages écrites</span>
        </div>
        <div class="dev-struct">${rows}</div>
      `
    }
    return ''
  }

  document.querySelectorAll('.devoir-item').forEach(item => {
    item.style.cursor = 'pointer'
    item.addEventListener('click', () => {
      const next = item.nextElementSibling
      if (next?.classList.contains('devoir-detail')) { next.remove(); item.classList.remove('devoir-item--open'); return }
      document.querySelectorAll('.devoir-detail').forEach(d => d.remove())
      document.querySelectorAll('.devoir-item--open').forEach(i => i.classList.remove('devoir-item--open'))

      // Match par prefixe : le HTML peut afficher "TP Algo · arbre AVL" alors
      // que la cle data est "TP Algo". On cherche d'abord exact, puis par
      // prefixe pour rester robuste a un sous-titre additionnel.
      const name = item.querySelector('.devoir-name')?.textContent.trim() || ''
      const d = devoirDetails[name] || devoirDetails[Object.keys(devoirDetails).find(k => name.startsWith(k)) || '']
      if (!d) return

      const el = document.createElement('div')
      el.className = `devoir-detail devoir-detail--${d.status}`
      el.innerHTML = renderDevoirDetail(d)
      item.classList.add('devoir-item--open')
      item.after(el)
    })
  })

  // ── Tabs filter sur la liste de devoirs ──────────────────────────────
  // Filtre par statut (all / done / pending / draft) avec animation de
  // sortie/entree (max-height + opacity). Met a jour aussi le compteur
  // de la tab active et l'empty state.
  const devoirsList = document.getElementById('devoirs-list')
  if (devoirsList) {
    function applyDevoirFilter(filter) {
      const items = devoirsList.querySelectorAll('.devoir-item')
      let visible = 0
      items.forEach(item => {
        const status = item.dataset.devoirStatus || ''
        const show = filter === 'all' || status === filter
        item.classList.toggle('devoir-item--hidden', !show)
        if (show) visible++
        // Ferme tout detail ouvert sur un item filtre out
        if (!show) {
          const detail = item.nextElementSibling
          if (detail?.classList.contains('devoir-detail')) detail.remove()
          item.classList.remove('devoir-item--open')
        }
      })
      const empty = document.getElementById('devoirs-empty')
      if (empty) empty.hidden = visible !== 0
    }

    document.querySelectorAll('.devoirs-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.devoirs-tab').forEach(t => {
          const isActive = t === tab
          t.classList.toggle('devoirs-tab--active', isActive)
          t.setAttribute('aria-selected', String(isActive))
        })
        applyDevoirFilter(tab.dataset.devoirsFilter || 'all')
      })
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tab.click() }
      })
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  //  AUDIENCE - toggle prof / etudiant avec preview interactive
  //
  //  2 panneaux exclusifs (.audience-pane--active sur un seul a la fois).
  //  Toggle anime via fade + slide (CSS). Sur switch, on retrigger les
  //  animations d'apparition des items du panneau (rows + cards).
  // ══════════════════════════════════════════════════════════════════════
  const audienceToggleBtns = document.querySelectorAll('.audience-toggle-btn')
  const audiencePanes      = document.querySelectorAll('.audience-pane')
  if (audienceToggleBtns.length && audiencePanes.length) {
    function setAudience(role) {
      audienceToggleBtns.forEach(b => {
        const active = b.dataset.audience === role
        b.classList.toggle('audience-toggle-btn--active', active)
        b.setAttribute('aria-selected', String(active))
      })
      audiencePanes.forEach(p => {
        const active = p.dataset.audiencePane === role
        p.classList.toggle('audience-pane--active', active)
        // Retrigger les animations d'apparition des rows / cards.
        if (active && !prefersReducedMotion) {
          p.querySelectorAll('.audience-tl-row, .audience-mini-card').forEach(el => {
            el.style.animation = 'none'
            void el.offsetHeight
            el.style.animation = ''
          })
        }
      })
    }
    audienceToggleBtns.forEach(btn => {
      btn.addEventListener('click', () => setAudience(btn.dataset.audience))
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click() }
      })
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  //  LIVE QUIZ - multi-questions interactif
  // ══════════════════════════════════════════════════════════════════════
  // Questions volontairement simples / accessibles : meme un visiteur non-tech
  // doit comprendre l'enjeu en lisant la question. Statistiques realistes
  // (la majorite trouve, mais 10-30% se trompent), bonne reponse decalee dans
  // l'ordre pour que ce ne soit pas toujours la 2eme.
  const quizQuestions = [
    { q: 'Combien de bits y a-t-il dans un octet ?',
      opts: ['4', '6', '8', '16'],
      correct: 2, stats: [4, 6, 78, 12], count: 28 },
    { q: 'Que signifie l\'acronyme URL ?',
      opts: ['User Resource Link', 'Uniform Resource Locator', 'Universal Routing Layer', 'Unified Reference Logic'],
      correct: 1, stats: [11, 71, 9, 9], count: 31 },
    { q: 'Quel langage permet de mettre en forme une page web ?',
      opts: ['HTML', 'CSS', 'JavaScript', 'Python'],
      correct: 1, stats: [18, 64, 14, 4], count: 26 },
  ]

  const quizContainer = document.getElementById('live-quiz-demo')
  if (quizContainer) {
    const optsEl = document.getElementById('live-quiz-opts')
    const badgeEl = document.getElementById('live-q-badge')
    const textEl = document.getElementById('live-q-text')
    const countEl = document.getElementById('live-q-count')
    const timerEl = document.getElementById('live-q-timer')
    let qIdx = 0, revealed = false, revealT = null, nextT = null, timerIv = null
    let pollIv = null
    let liveVotes = [0, 0, 0, 0]
    let liveCount = 0

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

    /**
     * Live poll progressive : au lieu d'afficher des stats finales statiques,
     * on simule l'arrivee progressive des votes pendant la fenetre de 30s.
     *
     * Algo : la distribution finale `q.stats` (ex: [12, 68, 15, 5]) est
     * convertie en weights pour `pickBiased`. A chaque tick (~400ms), on
     * tire 1-2 votes au pif selon ces weights et on met a jour les barres
     * + le compteur de reponses. Resultat : le visiteur voit "30 reponses"
     * monter en temps reel, avec la bonne reponse qui se detache au fur
     * et a mesure (effet "majority forms over time").
     */
    // Helper : trouve l'option DOM pour un index donne
    const optAt = (i) => optsEl.querySelector(`.live-opt[data-idx="${i}"]`)
    const ICON_CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    const ICON_X     = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

    /**
     * Live poll : 2 phases distinctes, façon Mentimeter / Kahoot.
     *
     * PHASE VOTE (avant reveal) :
     *   - Aucun pourcentage visible. L'utilisateur voit uniquement le compteur
     *     "X réponses" qui monte, et un petit ping visuel sur l'option qui
     *     vient de recevoir un vote (effet "quelqu'un vient de cliquer").
     *   - Les options sont cliquables, hover normal. La bonne reponse n'est
     *     pas encore connue.
     *
     * PHASE RESULTS (au reveal) :
     *   - Snap aux pourcentages finaux. Bars qui grandissent de 0% a leur
     *     valeur finale, percentage tape en gros a droite, icone check sur
     *     la bonne reponse. Confetti sur l'option correcte.
     *   - L'option active classe `revealed-*` (correct / wrong / wrong+selected)
     *     pour le styling.
     */
    function startLivePoll(q) {
      if (pollIv) clearInterval(pollIv)
      liveVotes = [0, 0, 0, 0]
      liveCount = 0
      const targetTotal = q.count
      const tickMs = 400
      const totalTicks = Math.floor(30_000 / tickMs)
      const votesPerTick = targetTotal / totalTicks
      let ticks = 0

      // Reset visuel : pas de fills, pas de pourcentages pendant la phase vote
      optsEl.querySelectorAll('.live-opt').forEach(o => {
        o.querySelector('.live-opt-bar-fill')?.style.setProperty('--w', '0%')
        const pct = o.querySelector('.live-opt-pct')
        if (pct) pct.textContent = ''
      })
      optsEl.classList.remove('live-options--reveal')
      optsEl.classList.add('live-options--voting')

      const pollFn = () => {
        ticks++
        const n = Math.max(1, Math.round(votesPerTick * (0.6 + Math.random() * 0.8)))
        let lastIdx = -1
        for (let i = 0; i < n && liveCount < targetTotal; i++) {
          const idx = pickBiased(q.stats)
          liveVotes[idx]++
          liveCount++
          lastIdx = idx
        }
        // Compteur visible (le seul indicateur de progression pendant le vote)
        countEl.textContent = `${liveCount} réponse${liveCount > 1 ? 's' : ''}`
        // "Ping" visuel sur l'option qui vient d'etre votee : court flash
        // qui suggere "quelqu'un dans la salle vient de cliquer ici".
        if (lastIdx >= 0 && !prefersReducedMotion) {
          const opt = optAt(lastIdx)
          if (opt) {
            opt.classList.remove('live-opt--just-voted')
            void opt.offsetHeight
            opt.classList.add('live-opt--just-voted')
            setTimeout(() => opt.classList.remove('live-opt--just-voted'), 380)
          }
        }

        if (ticks >= totalTicks || liveCount >= targetTotal) {
          clearInterval(pollIv); pollIv = null
        }
      }
      pollFn()
      pollIv = setInterval(pollFn, tickMs)
    }

    function revealAnswers(q) {
      revealed = true
      if (timerIv) { clearInterval(timerIv); timerIv = null }
      if (pollIv) { clearInterval(pollIv); pollIv = null }

      // Bascule en mode "results" : on autorise les pourcentages a apparaitre
      optsEl.classList.remove('live-options--voting')
      optsEl.classList.add('live-options--reveal')

      // Snap aux pourcentages finaux + ajoute revealed-* class.
      // Stagger 100ms entre chaque option pour un effet "barres qui grimpent
      // une apres l'autre" facon resultat de quiz.
      optsEl.querySelectorAll('.live-opt').forEach((o, i) => {
        const pct = q.stats[i]
        const isCorrect = parseInt(o.dataset.idx) === q.correct
        // Decalage pour la sequence d'apparition des bars + pct
        setTimeout(() => {
          o.querySelector('.live-opt-bar-fill')?.style.setProperty('--w', pct + '%')
          const lab = o.querySelector('.live-opt-pct')
          if (lab) lab.textContent = pct + '%'
        }, i * 110)
        o.style.transitionDelay = `${i * 80}ms`
        o.classList.add(isCorrect ? 'revealed-correct' : 'revealed-wrong')
        const icon = o.querySelector('.live-opt-icon')
        if (icon) icon.innerHTML = isCorrect ? ICON_CHECK : (o.classList.contains('selected') ? ICON_X : '')
      })
      countEl.textContent = `${q.count} réponses · résultats`
      // Confetti sur la bonne reponse, declenche apres le stagger
      const correctOpt = optAt(q.correct)
      if (correctOpt && !prefersReducedMotion) {
        setTimeout(() => spawnParticleBurst(correctOpt, EMOJI_PARTICLES.slice(0, 3)), q.opts.length * 110 + 100)
      }
      // Phase results plus longue (5s au lieu de 3.2s) : laisse le temps de
      // voir tous les pourcentages et la bonne reponse avant la suivante.
      nextT = setTimeout(() => { qIdx = (qIdx + 1) % quizQuestions.length; renderQuiz(qIdx) }, 5000)
    }

    function renderQuiz(idx) {
      const q = quizQuestions[idx]
      revealed = false
      clearTimeout(revealT); clearTimeout(nextT)
      if (pollIv) { clearInterval(pollIv); pollIv = null }
      badgeEl.textContent = `Question ${idx + 1}/${quizQuestions.length}`
      textEl.textContent = q.q
      countEl.textContent = `0 réponse`
      startTimer(30)
      // Structure : 2 lignes (header + bar). La bar est SOUS le texte
      // donc le texte ne bouge plus en fonction du pourcentage.
      // Chaque option a sa propre couleur (--opt-c) selon son index pour
      // donner un repere visuel distinct (cyan / violet / amber / pink).
      optsEl.innerHTML = q.opts.map((o, i) =>
        `<div class="live-opt" data-idx="${i}" data-correct="${i === q.correct ? 1 : 0}" data-opt="${'abcd'[i]}" tabindex="0" role="button">
          <div class="live-opt-row">
            <span class="live-opt-letter">${'ABCD'[i]}</span>
            <span class="live-opt-text">${o}</span>
            <span class="live-opt-pct"></span>
            <span class="live-opt-icon"></span>
          </div>
          <span class="live-opt-bar"><span class="live-opt-bar-fill" style="--w:0%"></span></span>
        </div>`
      ).join('')
      if (prefersReducedMotion) {
        // En reduced-motion on saute directement aux resultats : pas
        // d'animation de phase de vote.
        optsEl.classList.remove('live-options--voting')
        optsEl.classList.add('live-options--reveal')
        optsEl.querySelectorAll('.live-opt').forEach((o, i) => {
          o.querySelector('.live-opt-bar-fill')?.style.setProperty('--w', q.stats[i] + '%')
          const lab = o.querySelector('.live-opt-pct')
          if (lab) lab.textContent = q.stats[i] + '%'
          const isCorrect = parseInt(o.dataset.idx) === q.correct
          o.classList.add(isCorrect ? 'revealed-correct' : 'revealed-wrong')
        })
        countEl.textContent = `${q.count} réponses · résultats`
      } else {
        startLivePoll(q)
      }
      optsEl.querySelectorAll('.live-opt').forEach(opt => {
        opt.addEventListener('click', () => onQuizClick(opt, q))
        opt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.click() } })
      })
    }

    function onQuizClick(opt, q) {
      if (revealed) return
      optsEl.querySelectorAll('.live-opt').forEach(o => o.classList.remove('selected'))
      opt.classList.add('selected')
      // Petite anim de reussite si l'utilisateur clique la bonne reponse :
      // pulse spring + 3 confetti SVG. Doux, pas tape-a-l'oeil.
      const isCorrect = parseInt(opt.dataset.idx) === q.correct
      if (isCorrect && !prefersReducedMotion) {
        opt.classList.remove('live-opt--success')
        void opt.offsetHeight
        opt.classList.add('live-opt--success')
        spawnParticleBurst(opt, EMOJI_PARTICLES.slice(0, 3))
      }
      revealT = setTimeout(() => revealAnswers(q), 900)
    }

    renderQuiz(0)
  }

  // ══════════════════════════════════════════════════════════════════════
  //  LIVE > CODE - 4 fichiers cliquables avec formats differents
  //
  //  Token classes :
  //   - kw   : keywords (def, if, while, return, true, false, null)
  //   - fn   : noms de fonctions / cles JSON
  //   - num  : nombres
  //   - str  : strings et chaines JSON
  //   - cmt  : commentaires Python ou texte Markdown
  //   - h1   : heading H1 Markdown
  //   - h2   : heading H2 Markdown
  //   - mc   : code inline Markdown
  //   - bul  : puces de liste Markdown
  //   - punc : ponctuation JSON ({ } [ ] : ,)
  //
  //  Token format : ['type', 'text'] ou ['', 'text'] pour neutre.
  // ══════════════════════════════════════════════════════════════════════
  const LIVE_CODE_FILES = {
    'binary_search.py': {
      lang: 'Python',
      // editors[] : positions des co-editeurs en train de bosser sur le fichier.
      // Chaque caret blink avec un --d different (delay en ms) pour donner
      // l'impression de plusieurs personnes qui tapent en parallele sans avoir
      // l'air synchronises. Le 1er editeur est le "primary" (highlight + pill).
      editors: [
        { line: 5, name: 'EL', color: '#059669', delay: 0 },
        { line: 9, name: 'MR', color: '#6366F1', delay: 320 },
      ],
      lines: [
        [['kw', 'def'], ['', ' '], ['fn', 'binary_search'], ['', '(arr, target):']],
        [['', '    lo, hi = '], ['num', '0'], ['', ', '], ['fn', 'len'], ['', '(arr) - '], ['num', '1']],
        [['kw', '    while'], ['', ' lo <= hi:']],
        [['', '        mid = (lo + hi) // '], ['num', '2']],
        [['kw', '        if'], ['', ' arr[mid] == target:']],
        [['kw', '            return'], ['', ' mid']],
        [['kw', '        if'], ['', ' arr[mid] < target:']],
        [['', '            lo = mid + '], ['num', '1']],
        [['kw', '        else'], ['', ':']],
        [['', '            hi = mid - '], ['num', '1']],
        [['kw', '    return'], ['', ' -'], ['num', '1']],
      ],
    },
    'tests.py': {
      lang: 'Python',
      editors: [
        { line: 4, name: 'JD', color: '#D97706', delay: 0 },
        { line: 7, name: 'EL', color: '#059669', delay: 280 },
      ],
      lines: [
        [['kw', 'from'], ['', ' binary_search '], ['kw', 'import'], ['', ' binary_search']],
        [],
        [['kw', 'def'], ['', ' '], ['fn', 'test_found'], ['', '():']],
        [['', '    arr = ['], ['num', '1'], ['', ', '], ['num', '3'], ['', ', '], ['num', '5'], ['', ', '], ['num', '7'], ['', ', '], ['num', '9'], ['', ']']],
        [['kw', '    assert'], ['', ' '], ['fn', 'binary_search'], ['', '(arr, '], ['num', '5'], ['', ') == '], ['num', '2']],
        [],
        [['kw', 'def'], ['', ' '], ['fn', 'test_missing'], ['', '():']],
        [['kw', '    assert'], ['', ' '], ['fn', 'binary_search'], ['', '(['], ['num', '1'], ['', ', '], ['num', '2'], ['', ', '], ['num', '3'], ['', '], '], ['num', '4'], ['', ') == -'], ['num', '1']],
        [],
        [['cmt', '# pytest tests.py -v']],
      ],
    },
    'data.json': {
      lang: 'JSON',
      editors: [
        { line: 3, name: 'MR', color: '#6366F1', delay: 0 },
        { line: 5, name: 'JD', color: '#D97706', delay: 200 },
      ],
      lines: [
        [['punc', '{']],
        [['', '  '], ['fn', '"algo"'], ['punc', ':'], ['', ' '], ['str', '"binary_search"'], ['punc', ',']],
        [['', '  '], ['fn', '"complexity"'], ['punc', ':'], ['', ' '], ['str', '"O(log n)"'], ['punc', ',']],
        [['', '  '], ['fn', '"test_cases"'], ['punc', ':'], ['', ' '], ['num', '12'], ['punc', ',']],
        [['', '  '], ['fn', '"passing"'], ['punc', ':'], ['', ' '], ['kw', 'true'], ['punc', ',']],
        [['', '  '], ['fn', '"authors"'], ['punc', ':'], ['', ' '], ['punc', '['], ['str', '"EL"'], ['punc', ','], ['', ' '], ['str', '"JD"'], ['punc', ']']],
        [['punc', '}']],
      ],
    },
    'README.md': {
      lang: 'Markdown',
      editors: [
        { line: 6, name: 'EL', color: '#059669', delay: 0 },
      ],
      lines: [
        [['h1', '# Recherche dichotomique']],
        [],
        [['', "Implementation d'une recherche binaire en Python."]],
        [],
        [['h2', '## Complexite']],
        [],
        [['bul', '-'], ['', ' Temps : '], ['mc', '`O(log n)`']],
        [['bul', '-'], ['', ' Memoire : '], ['mc', '`O(1)`']],
        [],
        [['h2', '## Usage']],
        [],
        [['mc', '    binary_search([1, 3, 5], 3)  # 1']],
      ],
    },
  }

  function renderLiveCode(fileName) {
    const pre = document.getElementById('live-code-pre')
    const file = LIVE_CODE_FILES[fileName]
    if (!pre || !file) return
    const tokenSpan = (t) => t[0] === '' ? t[1] : `<span class="lm-c-${t[0]}">${t[1]}</span>`

    // Map line index -> editors[] (plusieurs personnes peuvent etre sur la meme ligne).
    // Le PREMIER editeur de la liste devient "primary" (bg highlight + pill nominale).
    const editorsByLine = {}
    const editors = file.editors || []
    for (const ed of editors) {
      if (!editorsByLine[ed.line]) editorsByLine[ed.line] = []
      editorsByLine[ed.line].push(ed)
    }
    const primaryLine = editors[0]?.line

    const lines = file.lines.map((toks, i) => {
      const eds = editorsByLine[i] || []
      const isPrimary = i === primaryLine
      const hiCls = isPrimary ? ' live-code-line--hi' : ''
      const lineStyle = eds.length ? ` style="--c:${eds[0].color}"` : ''
      // Carets : un par editeur sur cette ligne, chacun blink avec son delay
      const carets = eds.map(ed =>
        `<span class="live-code-caret" style="--c:${ed.color};--d:${ed.delay}ms" aria-hidden="true"></span><span class="live-code-pill" style="--c:${ed.color}">${ed.name}</span>`
      ).join('')
      const content = toks.length ? toks.map(tokenSpan).join('') : '​'
      return `<span class="live-code-line${hiCls}"${lineStyle}><span class="live-code-num">${i + 1}</span>${content}${carets}</span>`
    }).join('')
    pre.innerHTML = lines
  }

  // Tabs cliquables : switch de fichier + maj de l'aria-selected
  const liveCodeTabs = document.querySelectorAll('#live-code-tabs .live-code-tab')
  liveCodeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      liveCodeTabs.forEach(t => {
        const active = t === tab
        t.classList.toggle('live-code-tab--active', active)
        t.setAttribute('aria-selected', String(active))
      })
      renderLiveCode(tab.dataset.liveCodeFile)
    })
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tab.click() }
    })
  })
  // Render initial
  if (liveCodeTabs.length) renderLiveCode('binary_search.py')

  // ══════════════════════════════════════════════════════════════════════
  //  LIVE - rotation 4 modes : Spark (quiz) / Pulse / Code / Board
  //
  //  Auto-rotation toutes les 12s, mise en pause au hover, click manuel
  //  override le minuteur. Synchronise le titre de la fenetre + le tab actif.
  // ══════════════════════════════════════════════════════════════════════
  const LIVE_MODES = ['spark', 'pulse', 'code', 'board']
  const LIVE_TITLES = {
    spark: 'Quiz',
    pulse: 'Sondage',
    code:  'Code · Co-édition',
    board: 'Board · Brainstorm',
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

  /**
   * Layout force-directed simple pour le nuage de mots Pulse :
   *   - Force d'attraction vers le centre (faible)
   *   - Force de repulsion entre paires de mots si overlap (boites)
   *   - 80 iterations -> stable
   *
   * Resultat : les mots se distribuent sans se chevaucher, les plus gros
   * (haut score) restent au centre. Plus pro qu'un wrap CSS.
   */
  function layoutWordCloud(words, containerW, containerH) {
    // Position initiale aleatoire dans la zone, taille proportionnelle au score
    const pos = words.map(w => ({
      ...w,
      x: containerW / 2 + (Math.random() - 0.5) * 40,
      y: containerH / 2 + (Math.random() - 0.5) * 30,
      fontSize: 11 + Math.min(w.s, 25) * 0.6,
      width:  (w.w.length * 7 + 12) * (1 + Math.min(w.s, 25) / 60),
      height: (11 + Math.min(w.s, 25) * 0.6) + 8,
    }))
    const ITERS = 80
    const REPEL = 0.6
    const ATTRACT = 0.012
    for (let it = 0; it < ITERS; it++) {
      // Repulsion entre paires si overlap des boites
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const a = pos[i], b = pos[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const overlapX = (a.width + b.width) / 2 - Math.abs(dx)
          const overlapY = (a.height + b.height) / 2 - Math.abs(dy)
          if (overlapX > 0 && overlapY > 0) {
            const fx = (dx >= 0 ? 1 : -1) * overlapX * REPEL
            const fy = (dy >= 0 ? 1 : -1) * overlapY * REPEL
            a.x -= fx / 2; a.y -= fy / 2
            b.x += fx / 2; b.y += fy / 2
          }
        }
      }
      // Attraction vers le centre (faible)
      for (const p of pos) {
        p.x += (containerW / 2 - p.x) * ATTRACT
        p.y += (containerH / 2 - p.y) * ATTRACT
      }
    }
    // Clamp pour rester dans le container
    for (const p of pos) {
      p.x = Math.max(p.width / 2, Math.min(containerW - p.width / 2, p.x))
      p.y = Math.max(p.height / 2, Math.min(containerH - p.height / 2, p.y))
    }
    return pos
  }

  // ── Pulse cloud : etat mutable pour permettre l'ajout par l'utilisateur
  const pulseState = { words: [...PULSE_WORDS], count: 22 }

  function renderPulseCloud(opts = {}) {
    const cloud = document.getElementById('live-pulse-cloud')
    if (!cloud) return
    // opts.force = re-render meme si deja rendered (utilise apres ajout d'un mot)
    if (cloud.dataset.rendered && !opts.force) return
    cloud.dataset.rendered = '1'
    const W = cloud.clientWidth || 320
    const H = 80
    const positioned = layoutWordCloud(pulseState.words, W, H)
    const tints = ['var(--color-rex)', 'var(--color-chat)', 'var(--color-devoirs)']
    cloud.style.position = 'relative'
    cloud.style.height = H + 'px'
    cloud.innerHTML = ''
    positioned.forEach((entry, i) => {
      const span = document.createElement('span')
      span.className = 'live-pulse-word'
      if (entry.fresh === 'new')   span.classList.add('live-pulse-word--fresh')
      if (entry.fresh === 'boost') span.classList.add('live-pulse-word--boost')
      span.style.position = 'absolute'
      span.style.left = (entry.x - entry.width / 2) + 'px'
      span.style.top  = (entry.y - entry.height / 2) + 'px'
      span.style.fontSize = entry.fontSize + 'px'
      span.style.setProperty('--delay', (i * 80) + 'ms')
      span.style.color = tints[i % tints.length]
      span.style.opacity = String(0.55 + Math.min(entry.s, 25) / 60)
      span.textContent = entry.w
      cloud.appendChild(span)
    })
  }

  // Ajout d'un mot par l'utilisateur : si deja present, +1 sur le score
  // (le mot grossit), sinon ajout en tete avec animation "fresh".
  function addPulseWord(raw) {
    const word = (raw || '').trim().toLowerCase().slice(0, 20)
    if (!word) return { ok: false }
    const existing = pulseState.words.find(w => w.w.toLowerCase() === word)
    let kind
    if (existing) {
      existing.s = Math.min(30, existing.s + 4)
      existing.fresh = 'boost'
      kind = 'boost'
    } else {
      pulseState.words.unshift({ w: word, s: 8, fresh: 'new' })
      // Plafonne a 14 pour ne pas exploser le layout
      if (pulseState.words.length > 14) pulseState.words.pop()
      kind = 'new'
    }
    pulseState.count++
    const cloud = document.getElementById('live-pulse-cloud')
    if (cloud) cloud.dataset.rendered = ''  // force re-layout
    renderPulseCloud({ force: true })
    renderPulseTop()
    // Reset fresh apres animation
    setTimeout(() => pulseState.words.forEach(w => { delete w.fresh }), 800)
    // Met a jour le compteur
    const countEl = document.getElementById('live-pulse-count')
    if (countEl) countEl.textContent = `${pulseState.count} réponses anonymes`
    return { ok: true, kind }
  }

  // Top 3 mots les plus votes : barres horizontales avec bar de poids.
  // Donne un repere clair de "ce que la classe ressent majoritairement".
  function renderPulseTop() {
    const top = document.getElementById('live-pulse-top')
    if (!top) return
    const sorted = [...pulseState.words].sort((a, b) => b.s - a.s).slice(0, 3)
    if (!sorted.length) { top.innerHTML = ''; return }
    const max = sorted[0].s || 1
    top.innerHTML = '<div class="live-pulse-top-label">Top ressentis</div>' +
      sorted.map((w, i) => `
        <div class="live-pulse-top-row" style="--d:${i * 60}ms">
          <span class="live-pulse-top-rank">${i + 1}</span>
          <span class="live-pulse-top-word">${w.w}</span>
          <span class="live-pulse-top-bar"><span class="live-pulse-top-fill" style="--w:${Math.round((w.s / max) * 100)}%"></span></span>
          <span class="live-pulse-top-score">${w.s}</span>
        </div>
      `).join('')
  }

  // Form submit : valide + ajoute + reset l'input
  // Si le mot existe deja, classe --boost (tint differente) au lieu de --sent
  // pour signaler "ton mot existait, on l'a pondere".
  const pulseForm = document.getElementById('live-pulse-form')
  if (pulseForm) {
    pulseForm.addEventListener('submit', (e) => {
      e.preventDefault()
      const input = document.getElementById('live-pulse-input')
      if (!input) return
      const result = addPulseWord(input.value)
      if (result.ok) {
        input.value = ''
        const cls = result.kind === 'boost' ? 'live-pulse-input--boost' : 'live-pulse-input--sent'
        input.classList.add(cls)
        setTimeout(() => input.classList.remove(cls), 700)
      }
    })
  }

  // ── Board (Live > Brainstorm) : stickies cliquables, +1 vote au click ──
  // Toggle "voted" : pastille devient rouge live + count +1, reclic -1.
  // Animation "stickie-vote" cubique spring sur l'element.
  document.querySelectorAll('.live-stickie').forEach(stickie => {
    stickie.setAttribute('tabindex', '0')
    stickie.setAttribute('role', 'button')
    stickie.setAttribute('aria-label', 'Voter pour ce post-it')
    const countEl = stickie.querySelector('.live-stickie-votes')
    function toggleVote() {
      if (!countEl) return
      const text = countEl.textContent.trim()
      const n = parseInt(text, 10) || 0
      const voted = stickie.classList.toggle('live-stickie--voted')
      countEl.lastChild.nodeValue = String(voted ? n + 1 : Math.max(0, n - 1))
      stickie.classList.remove('live-stickie--just-voted')
      void stickie.offsetHeight
      stickie.classList.add('live-stickie--just-voted')
      setTimeout(() => stickie.classList.remove('live-stickie--just-voted'), 650)
    }
    stickie.addEventListener('click', toggleVote)
    stickie.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleVote() }
    })
  })

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
      if (mode === 'pulse') { renderPulseCloud(); renderPulseTop() }
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
  // Generateur heuristique de creneaux : produit une grille semaine
  // plausible (pas avant 9h/apres 18h, pas mercredi PM, densite plus
  // forte le matin, samedi/dimanche skipped). Seede sur le jour-de-
  // l'annee pour rester stable dans la session mais changer quotidiennement.
  function generateRdvWeek() {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
    const rng = mulberry32(dayOfYear)
    const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
    const HOURS = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
    // Tirage du type : 70% suivi, 18% soutenance, 12% rattrapage.
    // Renvoie l'index dans rdvData.types (set apres ce const).
    function pickType() {
      const r = rng()
      if (r < 0.70) return 0
      if (r < 0.88) return 1
      return 2
    }
    return DAYS.map(day => {
      // Densite par jour : plus libre lundi/jeudi (debut+milieu de semaine)
      const baseDensity = day === 'Lun' ? 0.65 : day === 'Jeu' ? 0.75 : day === 'Mer' ? 0.30 : 0.5
      const slots = []
      for (const hour of HOURS) {
        // Mer apres-midi exclu (cours)
        if (day === 'Mer' && parseInt(hour, 10) >= 13) continue
        // Le matin a plus de slots libres
        const isMorning = parseInt(hour, 10) < 12
        const density = baseDensity * (isMorning ? 1.2 : 0.8)
        if (rng() < density) slots.push({ time: hour, typeIdx: pickType() })
      }
      return { day, slots }
    }).filter(d => d.slots.length > 0)
  }

  const rdvData = {
    types: [
      { name: 'Suivi individuel',    duration: 30, color: '#0EA5E9', desc: 'Point hebdomadaire projet',     suggestedTopic: 'Avancement projet · questions ouvertes' },
      { name: 'Soutenance',          duration: 60, color: '#8B5CF6', desc: 'Jury + 2 intervenants',         suggestedTopic: 'Soutenance · présentation 20 min + Q/R' },
      { name: 'Rattrapage CCTL',     duration: 45, color: '#F59E0B', desc: 'Session de récupération',       suggestedTopic: 'Rattrapage · reprise des points bloquants' },
    ],
    disponibilites: generateRdvWeek(),
    bookings: [
      { who: 'Emma L.',    initials: 'EL', avatarColor: '#059669', when: 'Jeu. 9h00',   type: 'Suivi individuel', typeColor: '#0EA5E9', duration: 30, teams: true,  topic: 'Avancement Projet Web E4 · review architecture' },
      { who: 'Jean D.',    initials: 'JD', avatarColor: '#D97706', when: 'Jeu. 14h00',  type: 'Suivi individuel', typeColor: '#0EA5E9', duration: 30, teams: true,  topic: 'Question sur les rotations AVL (TP Algo)' },
      { who: 'Sara B.',    initials: 'SB', avatarColor: '#8B5CF6', when: 'Ven. 10h30',  type: 'Soutenance',       typeColor: '#8B5CF6', duration: 60, teams: false, topic: 'Soutenance mémoire de stage · salle B204' },
      { who: 'Thomas M.',  initials: 'TM', avatarColor: '#EC4899', when: 'Ven. 14h00',  type: 'Rattrapage CCTL',  typeColor: '#F59E0B', duration: 45, teams: true,  topic: 'Rattrapage CCTL Algo · chapitre arbres équilibrés' },
      { who: 'Lina F.',    initials: 'LF', avatarColor: '#06B6D4', when: 'Lun. 11h00',  type: 'Suivi individuel', typeColor: '#0EA5E9', duration: 30, teams: true,  topic: 'Choix sujet de stage · feedback CV' },
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
          <div class="rdv-type" style="--ic:${t.color};--d:${i * 100}ms" data-rdv-type-idx="${i}" tabindex="0" role="button" aria-label="Voir le détail du type ${t.name}">
            <span class="rdv-type-dot"></span>
            <div class="rdv-type-info">
              <span class="rdv-type-name">${t.name}</span>
              <span class="rdv-type-desc">${t.desc}</span>
            </div>
            <span class="rdv-type-duration">${t.duration} min</span>
            <span class="rdv-type-chev" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </span>
          </div>
        `).join('') + '</div>'
        h += '<div class="rdv-type-detail" id="rdv-type-detail" hidden></div>'
      } else if (tab === 'disponibilites') {
        h = '<div class="rdv-week">' + rdvData.disponibilites.map((row, i) => {
          const slotsHtml = row.slots.map(s => {
            const t = rdvData.types[s.typeIdx] || rdvData.types[0]
            return `<button type="button" class="rdv-slot" data-rdv-day="${row.day}" data-rdv-time="${s.time}" data-rdv-type-idx="${s.typeIdx}" style="--tc:${t.color}"><span class="rdv-slot-dot" aria-hidden="true"></span><span class="rdv-slot-time">${s.time}</span><span class="rdv-slot-tip" role="tooltip">${t.duration} min · ${t.name}</span></button>`
          }).join('')
          return `
          <div class="rdv-day" style="--d:${i * 80}ms">
            <span class="rdv-day-label">${row.day}</span>
            <div class="rdv-day-slots">${slotsHtml}</div>
          </div>`
        }).join('') + '</div>'
        h += '<div class="rdv-popover" id="rdv-popover" hidden></div>'
        h += '<div class="rdv-toast" id="rdv-toast" hidden></div>'
      } else if (tab === 'bookings') {
        h = '<div class="rdv-bookings">' + rdvData.bookings.map((b, i) => `
          <div class="rdv-booking" style="--d:${i * 100}ms;--tc:${b.typeColor}" data-rdv-booking-idx="${i}" tabindex="0" role="button" aria-label="Voir le RDV avec ${b.who}">
            <span class="rdv-booking-avatar" style="background:${b.avatarColor}">${b.initials}</span>
            <div class="rdv-booking-info">
              <span class="rdv-booking-who">${b.who}</span>
              <span class="rdv-booking-type"><span class="rdv-booking-type-dot"></span>${b.type}</span>
            </div>
            <div class="rdv-booking-when">${b.when}</div>
            ${b.teams ? `<span class="rdv-booking-teams" title="Reunion Teams auto"><svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>Teams</span>` : '<span class="rdv-booking-place">Salle B204</span>'}
          </div>
        `).join('') + '</div>'
        h += '<div class="rdv-booking-detail" id="rdv-booking-detail" hidden></div>'
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

    // ── Click sur un type : ouvre une carte de detail (description longue,
    // preview de la grille de slots + bouton "Voir les disponibilites") ──
    rexDemo.addEventListener('click', (e) => {
      const typeEl = e.target.closest('.rdv-type')
      if (!typeEl) return
      const idx = parseInt(typeEl.dataset.rdvTypeIdx, 10)
      const t = rdvData.types[idx]
      if (!t) return
      const detail = rexDemo.querySelector('#rdv-type-detail')
      if (!detail) return

      // Toggle si reclic sur le meme type
      if (detail.dataset.openIdx === String(idx) && !detail.hidden) {
        detail.hidden = true; detail.dataset.openIdx = ''
        rexDemo.querySelectorAll('.rdv-type--active').forEach(el => el.classList.remove('rdv-type--active'))
        return
      }
      rexDemo.querySelectorAll('.rdv-type--active').forEach(el => el.classList.remove('rdv-type--active'))
      typeEl.classList.add('rdv-type--active')
      detail.dataset.openIdx = String(idx)
      detail.hidden = false

      // Compte le nombre de creneaux de ce type dans la semaine generee.
      const weekSlots = rdvData.disponibilites.flatMap(r => r.slots).filter(s => s.typeIdx === idx).length
      // 3 details longs additionnels par type, hardcoded pour la demo.
      const LONG = [
        // Suivi individuel
        { long: 'Point en visio ou en presentiel pour debloquer un projet, valider une orientation ou faire le bilan de la semaine. La duree courte permet d\'enchainer plusieurs etudiants.', who: 'Etudiant seul', notif: 'Rappel J-1 + lien Teams cree automatiquement' },
        // Soutenance
        { long: 'Presentation de 20 min suivie de 25-30 min de questions du jury. Pense a inviter tes 2 intervenants en mettant leurs adresses dans le booking, ils recevront automatiquement le lien.', who: 'Etudiant + jury (3 pers.)', notif: 'Salle reservee + invitation jury par email' },
        // Rattrapage CCTL
        { long: 'Session de recuperation pour un etudiant qui a manque ou rate l\'evaluation initiale. Le creneau bloque automatiquement la salle de rattrapage et notifie le responsable de promo.', who: 'Etudiant + responsable promo', notif: 'Notif au responsable + email recap' },
      ]
      const long = LONG[idx] || { long: t.desc, who: '·', notif: '·' }

      detail.innerHTML = `
        <div class="rdv-type-card" style="--tc:${t.color}">
          <div class="rdv-type-card-head">
            <span class="rdv-type-card-dot"></span>
            <div class="rdv-type-card-titles">
              <span class="rdv-type-card-name">${t.name}</span>
              <span class="rdv-type-card-meta">${t.duration} min · ${weekSlots} créneau${weekSlots > 1 ? 'x' : ''} cette semaine</span>
            </div>
            <button type="button" class="rdv-type-card-close" aria-label="Fermer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <p class="rdv-type-card-long">${long.long}</p>
          <div class="rdv-type-card-rows">
            <div class="rdv-type-card-row">
              <span class="rdv-type-card-row-lbl">Pour qui</span>
              <span class="rdv-type-card-row-val">${long.who}</span>
            </div>
            <div class="rdv-type-card-row">
              <span class="rdv-type-card-row-lbl">Sujet par défaut</span>
              <span class="rdv-type-card-row-val">${t.suggestedTopic}</span>
            </div>
            <div class="rdv-type-card-row">
              <span class="rdv-type-card-row-lbl">Notifs</span>
              <span class="rdv-type-card-row-val">${long.notif}</span>
            </div>
          </div>
          <button type="button" class="rdv-type-card-cta" data-rdv-go-dispo>Voir les créneaux disponibles
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        </div>
      `
      detail.querySelector('.rdv-type-card-close')?.addEventListener('click', (ev) => {
        ev.stopPropagation()
        detail.hidden = true; detail.dataset.openIdx = ''
        typeEl.classList.remove('rdv-type--active')
      })
      detail.querySelector('[data-rdv-go-dispo]')?.addEventListener('click', (ev) => {
        ev.stopPropagation()
        switchTab('disponibilites')
      })
    })

    rexDemo.addEventListener('keydown', (e) => {
      const typeEl = e.target.closest?.('.rdv-type')
      if (typeEl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); typeEl.click() }
    })

    // Booking d'un creneau : clic sur un .rdv-slot ouvre un popover
    // de confirmation (type, duree, sujet pre-rempli) au-dessus du slot.
    // Click "Reserver" -> marque le slot booked + toast (sync Teams + ICS).
    // Click ailleurs ou Escape -> ferme le popover sans reserver.
    function closeRdvPopover() {
      const pop = rexDemo.querySelector('#rdv-popover')
      if (!pop || pop.hidden) return
      pop.classList.add('rdv-popover--leaving')
      const slotEl = rexDemo.querySelector('.rdv-slot--pending')
      if (slotEl) slotEl.classList.remove('rdv-slot--pending')
      setTimeout(() => { pop.hidden = true; pop.classList.remove('rdv-popover--leaving'); pop.innerHTML = '' }, 180)
    }

    function showRdvToast(day, time, type) {
      const toast = rexDemo.querySelector('#rdv-toast')
      if (!toast) return
      toast.hidden = false
      toast.innerHTML = `
        <span class="rdv-toast-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <div class="rdv-toast-body">
          <span class="rdv-toast-title">RDV réservé · ${day} ${time}</span>
          <span class="rdv-toast-sub">${type.name} · lien Teams + .ics envoyés</span>
        </div>
      `
      toast.classList.remove('rdv-toast--leaving')
      clearTimeout(rexDemo._rdvToastT)
      rexDemo._rdvToastT = setTimeout(() => {
        toast.classList.add('rdv-toast--leaving')
        setTimeout(() => { toast.hidden = true; toast.classList.remove('rdv-toast--leaving') }, 300)
      }, 3500)
    }

    rexDemo.addEventListener('click', (e) => {
      // Cliquer ailleurs (hors slot et hors popover) ferme le popover
      const slot = e.target.closest('.rdv-slot')
      const inPopover = e.target.closest('#rdv-popover')
      if (!slot && !inPopover) { closeRdvPopover(); return }
      if (!slot) return
      if (slot.classList.contains('rdv-slot--booked')) return

      const day = slot.dataset.rdvDay
      const time = slot.dataset.rdvTime
      const typeIdx = parseInt(slot.dataset.rdvTypeIdx, 10) || 0
      const type = rdvData.types[typeIdx] || rdvData.types[0]
      const pop = rexDemo.querySelector('#rdv-popover')
      if (!pop) return

      // Reclic sur le meme slot deja en pending : ferme
      if (slot.classList.contains('rdv-slot--pending')) { closeRdvPopover(); return }
      rexDemo.querySelectorAll('.rdv-slot--pending').forEach(s => s.classList.remove('rdv-slot--pending'))
      slot.classList.add('rdv-slot--pending')

      // Position : popover absolu, on l'ancre sur le panneau
      pop.hidden = false
      pop.style.setProperty('--tc', type.color)
      pop.innerHTML = `
        <div class="rdv-popover-head">
          <span class="rdv-popover-dot" aria-hidden="true"></span>
          <div class="rdv-popover-titles">
            <span class="rdv-popover-when">${day}. · ${time}</span>
            <span class="rdv-popover-type">${type.name} · ${type.duration} min</span>
          </div>
          <button type="button" class="rdv-popover-close" aria-label="Fermer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <label class="rdv-popover-field">
          <span class="rdv-popover-label">Sujet</span>
          <input type="text" class="rdv-popover-input" value="${type.suggestedTopic.replace(/"/g, '&quot;')}" maxlength="80" />
        </label>
        <div class="rdv-popover-meta">
          <span class="rdv-popover-tag"><svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>Teams auto</span>
          <span class="rdv-popover-tag"><svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>.ics calendrier</span>
          <span class="rdv-popover-tag"><svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Rappel J-1</span>
        </div>
        <button type="button" class="rdv-popover-cta">Réserver le créneau</button>
      `
      // Focus l'input pour signifier qu'il est editable
      setTimeout(() => pop.querySelector('.rdv-popover-input')?.select(), 0)

      pop.querySelector('.rdv-popover-close')?.addEventListener('click', (ev) => { ev.stopPropagation(); closeRdvPopover() })
      pop.querySelector('.rdv-popover-cta')?.addEventListener('click', (ev) => {
        ev.stopPropagation()
        slot.classList.remove('rdv-slot--pending')
        slot.classList.add('rdv-slot--booked')
        // Decremente le compteur de creneaux dispo
        const countEl = rexDemo.querySelector('.rex-count-num')
        if (countEl) {
          const n = parseInt(countEl.textContent, 10)
          if (!isNaN(n) && n > 0) countEl.textContent = String(n - 1)
        }
        // Persistance du booking dans la liste "Mes RDV" : si l'utilisateur
        // switche sur l'onglet bookings ensuite, il verra son nouveau RDV
        // tout en haut. Topic = la valeur courante de l'input du popover.
        const topic = pop.querySelector('.rdv-popover-input')?.value?.trim() || type.suggestedTopic
        rdvData.bookings.unshift({
          who: 'Toi', initials: 'TU', avatarColor: type.color,
          when: `${day}. ${time}`,
          type: type.name, typeColor: type.color, duration: type.duration,
          teams: true, topic,
        })
        closeRdvPopover()
        showRdvToast(day, time, type)
      })
    })

    // Escape ferme le popover
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeRdvPopover()
    })

    // ── Clic sur un booking : carte de detail (avatar + topic + lien meeting)
    rexDemo.addEventListener('click', (e) => {
      const booking = e.target.closest('.rdv-booking')
      if (!booking) return
      const idx = parseInt(booking.dataset.rdvBookingIdx, 10)
      const b = rdvData.bookings[idx]
      if (!b) return
      const detail = rexDemo.querySelector('#rdv-booking-detail')
      if (!detail) return

      // Toggle : reclic ferme
      if (detail.dataset.openIdx === String(idx) && !detail.hidden) {
        detail.hidden = true
        detail.dataset.openIdx = ''
        rexDemo.querySelectorAll('.rdv-booking--active').forEach(el => el.classList.remove('rdv-booking--active'))
        return
      }
      rexDemo.querySelectorAll('.rdv-booking--active').forEach(el => el.classList.remove('rdv-booking--active'))
      booking.classList.add('rdv-booking--active')
      detail.dataset.openIdx = String(idx)
      detail.hidden = false
      detail.innerHTML = `
        <div class="rdv-card" style="--tc:${b.typeColor}">
          <div class="rdv-card-head">
            <span class="rdv-card-avatar" style="background:${b.avatarColor}">${b.initials}</span>
            <div class="rdv-card-titles">
              <span class="rdv-card-who">${b.who}</span>
              <span class="rdv-card-when">${b.when} · ${b.type}</span>
            </div>
            <button type="button" class="rdv-card-close" aria-label="Fermer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="rdv-card-topic">${b.topic}</div>
          <div class="rdv-card-row">
            ${b.teams
              ? `<a class="rdv-card-link rdv-card-link--teams"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>Rejoindre Teams</a>`
              : `<span class="rdv-card-link rdv-card-link--place"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Salle B204</span>`}
            <span class="rdv-card-ics" title="Ajouter au calendrier">.ics</span>
          </div>
        </div>
      `
      detail.querySelector('.rdv-card-close')?.addEventListener('click', (ev) => {
        ev.stopPropagation()
        detail.hidden = true
        detail.dataset.openIdx = ''
        booking.classList.remove('rdv-booking--active')
      })
    })

    rexDemo.addEventListener('keydown', (e) => {
      const booking = e.target.closest?.('.rdv-booking')
      if (booking && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); booking.click() }
    })

    switchTab('types')
  }

  // ══════════════════════════════════════════════════════════════════════
  //  LUMEN - liseuse de cours GitHub : 3 repos selectionnables
  //
  //  Chaque repo a son propre titre (affiche dans la titlebar), ses
  //  chapitres et leur etat (done / reading / started). Le selecteur de
  //  repo en haut de la sidebar ouvre un menu deroulant avec les 3 repos.
  // ══════════════════════════════════════════════════════════════════════
  const lumenRepos = {
    'algorithmique-l1': {
      label: 'algorithmique-l1', title: 'Algorithmique', defaultChap: 'tri-rapide',
      chapters: {
        'tri-rapide': {
          n: 1, label: 'Tri rapide', readState: 'reading',
          progress: 42,
          devoirs: [
            { name: 'TP Tri rapide', due: 'rendu vendredi' },
            { name: 'Quiz live · complexité', due: 'live demain' },
          ],
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
          n: 2, label: 'Graphes', readState: 'started',
          progress: 18,
          devoirs: [
            { name: 'TP routage Dijkstra', due: 'rendu sem. 15' },
          ],
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
          n: 3, label: 'Programmation dynamique', readState: 'done',
          progress: 73,
          devoirs: [
            { name: 'TP Memo Fibonacci',     due: 'rendu sem. 16' },
            { name: 'Mini-projet sac à dos', due: 'binôme' },
          ],
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

<span class="lm-c-fn">print</span>(<span class="lm-c-fn">fib</span>(<span class="lm-c-num">50</span>))</pre>
          `,
        },
      },
    },
    'reseaux-l2': {
      label: 'reseaux-l2', title: 'Réseaux', defaultChap: 'tcp-ip',
      chapters: {
        'tcp-ip': {
          n: 1, label: 'TCP / IP', readState: 'reading',
          progress: 35,
          devoirs: [
            { name: 'TP Wireshark', due: 'rendu sem. 12' },
          ],
          content: `
            <h1 class="lm-h1">Couche TCP / IP</h1>
            <p class="lm-p">Le modele TCP/IP organise les protocoles en 4 couches : application, transport, internet, acces reseau.</p>
            <h2 class="lm-h2">Encapsulation</h2>
            <p class="lm-p">Chaque couche ajoute un en-tete au paquet. Au niveau Ethernet, on parle de <b>trame</b> ; au niveau IP, de <b>paquet</b> ; au niveau TCP, de <b>segment</b>.</p>
            <pre class="lm-code">[Ethernet][ IP [ TCP [ HTTP ] ] ][CRC]</pre>
          `,
        },
        'osi': {
          n: 2, label: 'Modèle OSI', readState: 'started',
          progress: 12,
          devoirs: [],
          content: `
            <h1 class="lm-h1">Modele OSI</h1>
            <p class="lm-p">Le modele OSI definit <b>7 couches</b> de la physique a l'application.</p>
            <h2 class="lm-h2">Les 7 couches</h2>
            <p class="lm-p">7. Application · 6. Presentation · 5. Session · 4. Transport · 3. Reseau · 2. Liaison · 1. Physique</p>
          `,
        },
        'routage': {
          n: 3, label: 'Routage', readState: 'unread',
          progress: 0,
          devoirs: [
            { name: 'TP routage statique', due: 'rendu sem. 14' },
          ],
          content: `
            <h1 class="lm-h1">Routage</h1>
            <p class="lm-p">Le routage statique fixe les routes a la main. Le routage dynamique utilise des protocoles comme RIP ou OSPF.</p>
          `,
        },
      },
    },
    'web-e4': {
      label: 'web-e4', title: 'Projet Web', defaultChap: 'auth-jwt',
      chapters: {
        'auth-jwt': {
          n: 1, label: 'Auth JWT', readState: 'done',
          progress: 100,
          devoirs: [
            { name: 'Projet Web E4', due: 'rendu vendredi' },
          ],
          content: `
            <h1 class="lm-h1">Authentification JWT</h1>
            <p class="lm-p">JSON Web Token (JWT) : un token signe qui contient les claims de l'utilisateur. Stocke cote client (cookie httpOnly recommande).</p>
            <h2 class="lm-h2">Verification du token</h2>
            <pre class="lm-code"><span class="lm-c-kw">function</span> <span class="lm-c-fn">verifyToken</span>(req) {
  <span class="lm-c-kw">const</span> token = req.headers.authorization
    ?.<span class="lm-c-fn">replace</span>(<span class="lm-c-num">'Bearer '</span>, <span class="lm-c-num">''</span>)
  <span class="lm-c-kw">if</span> (!token) <span class="lm-c-kw">throw</span> <span class="lm-c-kw">new</span> Error(<span class="lm-c-num">'no token'</span>)
  <span class="lm-c-kw">return</span> jwt.<span class="lm-c-fn">verify</span>(token, SECRET)
}</pre>
          `,
        },
        'rest-api': {
          n: 2, label: 'API REST', readState: 'reading',
          progress: 58,
          devoirs: [
            { name: 'TP CRUD Express', due: 'rendu sem. 13' },
          ],
          content: `
            <h1 class="lm-h1">API REST</h1>
            <p class="lm-p">Une API REST expose des ressources via des verbes HTTP : <b>GET</b> pour lire, <b>POST</b> pour creer, <b>PATCH</b> pour modifier, <b>DELETE</b> pour supprimer.</p>
            <h2 class="lm-h2">Exemple Express.js</h2>
            <pre class="lm-code">app.<span class="lm-c-fn">get</span>(<span class="lm-c-num">'/users/:id'</span>, requireAuth, getUser)
app.<span class="lm-c-fn">post</span>(<span class="lm-c-num">'/users'</span>, requireAdmin, createUser)
app.<span class="lm-c-fn">patch</span>(<span class="lm-c-num">'/users/:id'</span>, requireSelf, updateUser)</pre>
          `,
        },
        'deploy': {
          n: 3, label: 'Déploiement', readState: 'unread',
          progress: 0,
          devoirs: [],
          content: `
            <h1 class="lm-h1">Deploiement</h1>
            <p class="lm-p">Container Docker + reverse-proxy Nginx + Let's Encrypt pour le HTTPS. CI GitHub Actions sur push pour build et deploy.</p>
          `,
        },
      },
    },
  }

  const lumenMain = document.getElementById('lumen-main')
  const lumenLinks = document.getElementById('lumen-links')
  const lumenProgressFill = document.getElementById('lumen-progress-fill')
  const lumenProgressLabel = document.getElementById('lumen-progress-label')
  const lumenChapsContainer = document.getElementById('lumen-chaps')
  const lumenRepoToggle = document.getElementById('lumen-repo-toggle')
  const lumenRepoMenu = document.getElementById('lumen-repo-menu')
  const lumenRepoName = document.getElementById('lumen-repo-name')
  const lumenTitle = document.getElementById('lumen-title')

  let currentRepo = 'algorithmique-l1'
  let currentChap = lumenRepos[currentRepo].defaultChap

  function renderLumenChaptersList() {
    if (!lumenChapsContainer) return
    const repo = lumenRepos[currentRepo]
    lumenChapsContainer.innerHTML = Object.entries(repo.chapters).map(([key, chap]) => `
      <button class="demo-lumen-chap${key === currentChap ? ' demo-lumen-chap--active' : ''}" data-lumen-chap="${key}" data-read-state="${chap.readState}" role="tab" aria-selected="${key === currentChap}">
        <span class="demo-lumen-chap-num">${chap.n}</span>
        <span class="demo-lumen-chap-title">${chap.label}</span>
        <span class="demo-lumen-chap-state" aria-label="${chap.readState}"></span>
      </button>
    `).join('')
    lumenChapsContainer.querySelectorAll('.demo-lumen-chap').forEach(btn => {
      btn.addEventListener('click', () => {
        currentChap = btn.dataset.lumenChap
        lumenChapsContainer.querySelectorAll('.demo-lumen-chap').forEach(b => {
          const a = b === btn
          b.classList.toggle('demo-lumen-chap--active', a)
          b.setAttribute('aria-selected', String(a))
        })
        renderLumenChapter()
      })
      btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click() } })
    })
  }

  function renderLumenChapter() {
    const repo = lumenRepos[currentRepo]
    const chap = repo?.chapters[currentChap]
    if (!chap || !lumenMain) return
    lumenMain.innerHTML = chap.content
    if (lumenLinks) {
      if (chap.devoirs.length === 0) {
        lumenLinks.innerHTML = '<span class="demo-lumen-empty">Pas de devoir lié</span>'
      } else {
        lumenLinks.innerHTML = chap.devoirs.map(d =>
          `<button type="button" class="demo-lumen-chip" tabindex="0" title="${d.name} · ${d.due}" data-lumen-chip-name="${d.name}" data-lumen-chip-due="${d.due}"><svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>${d.name}</button>`
        ).join('')
        // Click sur un chip : montre une bulle "due" cote du chip pendant 2.5s.
        lumenLinks.querySelectorAll('.demo-lumen-chip').forEach(chip => {
          chip.addEventListener('click', (ev) => {
            ev.stopPropagation()
            // Retire les anciennes bulles
            lumenLinks.querySelectorAll('.demo-lumen-chip-bubble').forEach(b => b.remove())
            const bubble = document.createElement('span')
            bubble.className = 'demo-lumen-chip-bubble'
            bubble.textContent = chip.dataset.lumenChipDue
            chip.appendChild(bubble)
            setTimeout(() => bubble.remove(), 2400)
          })
        })
      }
    }
    if (lumenProgressFill) lumenProgressFill.style.setProperty('--p', chap.progress + '%')
    if (lumenProgressLabel) lumenProgressLabel.textContent = chap.progress + '% lu'

    if (!prefersReducedMotion) {
      lumenMain.style.animation = 'none'
      void lumenMain.offsetHeight
      lumenMain.style.animation = 'msgAppear 350ms var(--ease-smooth) forwards'
    }
  }

  function selectLumenRepo(repoKey) {
    if (!lumenRepos[repoKey]) return
    currentRepo = repoKey
    currentChap = lumenRepos[repoKey].defaultChap
    if (lumenRepoName) lumenRepoName.textContent = lumenRepos[repoKey].label
    if (lumenTitle) lumenTitle.textContent = `Cours · ${lumenRepos[repoKey].title}`
    renderLumenChaptersList()
    renderLumenChapter()
  }

  function renderLumenRepoMenu() {
    if (!lumenRepoMenu) return
    lumenRepoMenu.innerHTML = Object.entries(lumenRepos).map(([key, r]) => `
      <button type="button" class="demo-lumen-repo-item${key === currentRepo ? ' demo-lumen-repo-item--active' : ''}" data-repo="${key}" role="menuitem">
        <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22h6V2H2z"/><rect width="14" height="20" x="8" y="2" rx="2"/></svg>
        <span>${r.label}</span>
      </button>
    `).join('')
    lumenRepoMenu.querySelectorAll('.demo-lumen-repo-item').forEach(item => {
      item.addEventListener('click', () => {
        selectLumenRepo(item.dataset.repo)
        renderLumenRepoMenu()
        closeLumenRepoMenu()
      })
    })
  }

  function openLumenRepoMenu() {
    if (!lumenRepoMenu || !lumenRepoToggle) return
    lumenRepoMenu.hidden = false
    lumenRepoToggle.setAttribute('aria-expanded', 'true')
    lumenRepoToggle.classList.add('demo-lumen-repo--open')
  }
  function closeLumenRepoMenu() {
    if (!lumenRepoMenu || !lumenRepoToggle) return
    lumenRepoMenu.hidden = true
    lumenRepoToggle.setAttribute('aria-expanded', 'false')
    lumenRepoToggle.classList.remove('demo-lumen-repo--open')
  }

  if (lumenRepoToggle) {
    lumenRepoToggle.addEventListener('click', (e) => {
      e.stopPropagation()
      if (lumenRepoMenu.hidden) { renderLumenRepoMenu(); openLumenRepoMenu() }
      else closeLumenRepoMenu()
    })
    document.addEventListener('click', (e) => {
      if (!lumenRepoMenu.contains(e.target) && !lumenRepoToggle.contains(e.target)) closeLumenRepoMenu()
    })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLumenRepoMenu() })
  }

  if (lumenMain) {
    renderLumenChaptersList()
    renderLumenChapter()
  }

  // ══════════════════════════════════════════════════════════════════════
  //  DOCS PREVIEW - apercu visuel riche par type de fichier
  //
  //  Chaque type (PDF / DOC / XLS / URL / PY / FIG) a un mock dedie qui
  //  ressemble au vrai viewer : pages avec lignes greekees pour PDF/DOC,
  //  grille pour XLS, code colore pour PY, fenetre navigateur pour URL,
  //  wireframe pour FIG. Le document est identifie par son nom de fichier
  //  via DOC_PREVIEWS, fallback heuristique sur le type d'icone sinon.
  // ══════════════════════════════════════════════════════════════════════
  const DOC_PREVIEWS = {
    'Cours Réseaux.pdf': {
      kind: 'pdf', title: 'Réseaux & protocoles', subtitle: 'Chapitre 3 · TCP/IP',
      page: 8, pages: 12,
      blocks: [
        { type: 'p', lines: [92, 78, 84, 66] },
        { type: 'figure', label: 'Fig. 3.1 · Modèle OSI 7 couches', figure: 'osi' },
        { type: 'p', lines: [88, 72, 90] },
      ],
    },
    'Algo - Complexité.pdf': {
      kind: 'pdf', title: 'Algorithmique', subtitle: 'Notation Big-O',
      page: 3, pages: 8,
      blocks: [
        { type: 'p', lines: [90, 80, 70] },
        { type: 'figure', label: 'Fig. 1 · Croissance asymptotique', figure: 'big-o' },
        { type: 'p', lines: [85, 75, 60] },
      ],
    },
    'Sujet TP Algo.docx': {
      kind: 'doc', title: 'TP Algo · Tri par fusion',
      author: 'Prof. Martin', date: '12 mars 2026',
      blocks: [
        { type: 'p', lines: [96, 88, 76] },
        { type: 'h2', text: 'Objectifs pédagogiques' },
        { type: 'ul', items: [82, 74, 68] },
        { type: 'h2', text: 'Livrable attendu' },
        { type: 'p', lines: [92, 84, 70] },
      ],
    },
    'TP Tri rapide.docx': {
      kind: 'doc', title: 'TP Tri rapide · Quicksort',
      author: 'Prof. Martin', date: '20 mars 2026',
      blocks: [
        { type: 'p', lines: [94, 86, 78] },
        { type: 'h2', text: 'Consignes' },
        { type: 'ul', items: [78, 70, 64] },
      ],
    },
    'Notes Algo S1.xlsx': {
      kind: 'xls', sheet: 'Notes-S1',
      headers: ['#', 'Étudiant', 'TP1', 'TP2', 'Note'],
      rows: [
        ['1', 'Emma L.',   '18', '17', { v: '17.5', g: 'a' }],
        ['2', 'Jean D.',   '14', '15', { v: '14.5', g: 'b' }],
        ['3', 'Sara B.',   '12', '11', { v: '11.5', g: 'c' }],
        ['4', 'Thomas M.', '16', '17', { v: '16.5', g: 'a' }],
        ['5', 'Lina F.',   '13', '14', { v: '13.5', g: 'b' }],
      ],
      summary: 'Moyenne 14.7 · 5 étudiants',
    },
    'GitHub projet web': {
      kind: 'github',
      repo: 'cesi/projet-web',
      desc: 'Projet Web E4, application full-stack avec auth JWT et API REST',
      lang: 'TypeScript', langColor: '#3178C6',
      stars: 24, forks: 6, branch: 'main',
      files: [
        { icon: 'folder', name: 'src' },
        { icon: 'folder', name: 'tests' },
        { icon: 'file',   name: 'README.md' },
        { icon: 'file',   name: 'package.json' },
      ],
    },
    'Moodle Réseaux': {
      kind: 'web',
      url: 'moodle.cesi.fr/course/view.php?id=42',
      site: 'Moodle CESI',
      title: 'Réseaux & protocoles · L2',
      blocks: [
        { type: 'h2', text: 'Section 3 · Protocoles TCP/IP' },
        { type: 'p', lines: [92, 78, 84] },
        { type: 'link', label: 'Cours Réseaux.pdf', kind: 'pdf' },
        { type: 'link', label: 'TP routage Dijkstra', kind: 'py' },
      ],
    },
    'tp_routage.py': {
      kind: 'code', lang: 'python', file: 'tp_routage.py',
      lines: [
        [['cmt', '# Algo Dijkstra : plus courts chemins']],
        [['kw', 'from'], ['', ' heapq '], ['kw', 'import'], ['', ' heappush, heappop']],
        [],
        [['kw', 'def'], ['', ' '], ['fn', 'dijkstra'], ['', '(graph, source):']],
        [['', '    dist = {n: '], ['fn', 'float'], ['', "('inf') "], ['kw', 'for'], ['', ' n '], ['kw', 'in'], ['', ' graph}']],
        [['', '    dist[source] = '], ['num', '0']],
        [['', '    pq = [('], ['num', '0'], ['', ', source)]']],
        [['kw', '    while'], ['', ' pq:']],
        [['', '        d, u = '], ['fn', 'heappop'], ['', '(pq)']],
        [['kw', '        if'], ['', ' d > dist[u]: '], ['kw', 'continue']],
      ],
    },
    'Maquettes projet': {
      kind: 'figma',
      file: 'Cursus · App',
      page: 'Mobile',
      frames: ['Login', 'Dashboard', 'Chat'],
    },
  }

  // ── Renderers ────────────────────────────────────────────────────────
  // Chaque renderer retourne une string HTML pour l'interieur de
  // .preview-body. Style propre via CSS (preview-pdf-*, preview-xls-*, ...).

  const ICON_PDF  = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  const ICON_PY   = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
  const ICON_LOCK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="10" x="5" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
  const ICON_FOLDER = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" opacity=".7"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
  const ICON_FILE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".55"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  const ICON_STAR = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity=".75"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  const ICON_FORK = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".75"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M6 8.5v7"/><path d="M18 8.5v1.5a4 4 0 0 1-4 4H8"/></svg>'

  function blockHTML(b) {
    if (b.type === 'p')   return `<div class="preview-doc-p">${b.lines.map(w => `<span class="preview-doc-line" style="--w:${w}%"></span>`).join('')}</div>`
    if (b.type === 'h2')  return `<div class="preview-doc-h2">${b.text}</div>`
    if (b.type === 'ul')  return `<ul class="preview-doc-ul">${b.items.map(w => `<li><span class="preview-doc-bullet"></span><span class="preview-doc-line" style="--w:${w}%"></span></li>`).join('')}</ul>`
    if (b.type === 'figure') {
      const fig = b.figure === 'osi' ? `
        <div class="preview-fig-osi">
          ${['Application','Présentation','Session','Transport','Réseau','Liaison','Physique']
            .map((l, i) => `<div class="preview-fig-osi-row" style="--d:${i * 60}ms"><span class="preview-fig-osi-num">${7 - i}</span><span class="preview-fig-osi-label">${l}</span></div>`).join('')}
        </div>`
        : `<svg class="preview-fig-bigo" viewBox="0 0 200 80" preserveAspectRatio="none">
          <line x1="0" y1="78" x2="200" y2="78" stroke="currentColor" stroke-width="0.5" opacity=".3"/>
          <line x1="2" y1="0" x2="2" y2="80" stroke="currentColor" stroke-width="0.5" opacity=".3"/>
          <path d="M2 78 L200 78" fill="none" stroke="#10B981" stroke-width="1.5" opacity=".7"/>
          <path d="M2 78 L100 70 L200 60" fill="none" stroke="#0EA5E9" stroke-width="1.5"/>
          <path d="M2 78 L100 50 L200 22" fill="none" stroke="#F59E0B" stroke-width="1.5"/>
          <path d="M2 78 Q60 70 100 30 T200 2" fill="none" stroke="#EF4444" stroke-width="1.5"/>
          <text x="186" y="76" font-size="6" fill="#10B981">O(1)</text>
          <text x="178" y="58" font-size="6" fill="#0EA5E9">O(log n)</text>
          <text x="170" y="20" font-size="6" fill="#F59E0B">O(n)</text>
          <text x="170" y="6"  font-size="6" fill="#EF4444">O(n²)</text>
        </svg>`
      return `<figure class="preview-doc-figure">${fig}<figcaption>${b.label}</figcaption></figure>`
    }
    if (b.type === 'link') {
      const ic = b.kind === 'pdf' ? ICON_PDF : ICON_PY
      return `<a class="preview-web-link"><span class="preview-web-link-icon" style="--c:${b.kind === 'pdf' ? '#dc2626' : '#f59e0b'}">${ic}</span>${b.label}</a>`
    }
    return ''
  }

  function renderPdf(d) {
    return `
      <div class="preview-pdf-page">
        <div class="preview-pdf-h1">${d.title}</div>
        <div class="preview-pdf-h2">${d.subtitle}</div>
        ${d.blocks.map(blockHTML).join('')}
      </div>
      <div class="preview-pdf-toolbar">
        <button class="preview-pdf-btn" type="button" aria-label="Précédent">‹</button>
        <span class="preview-pdf-pageinfo">${d.page} / ${d.pages}</span>
        <button class="preview-pdf-btn" type="button" aria-label="Suivant">›</button>
      </div>
    `
  }

  function renderDoc(d) {
    return `
      <div class="preview-doc-page">
        <div class="preview-doc-meta">${d.author} · ${d.date}</div>
        <div class="preview-doc-h1">${d.title}</div>
        ${d.blocks.map(blockHTML).join('')}
      </div>
    `
  }

  function renderXls(d) {
    const cell = (c) => typeof c === 'object'
      ? `<span class="preview-xls-grade preview-xls-grade--${c.g}">${c.v}</span>`
      : c
    return `
      <div class="preview-xls">
        <div class="preview-xls-tabs"><span class="preview-xls-tab preview-xls-tab--active">${d.sheet}</span><span class="preview-xls-tab">Détail</span><span class="preview-xls-tab">Récap</span></div>
        <table class="preview-xls-table">
          <thead><tr>${d.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${d.rows.map((row, i) => `<tr style="--d:${i * 50}ms">${row.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <div class="preview-xls-summary">${d.summary}</div>
      </div>
    `
  }

  function renderCode(d) {
    const tokenSpan = (t) => t[0] === '' ? t[1] : `<span class="lm-c-${t[0]}">${t[1]}</span>`
    const lines = d.lines.map((toks, i) =>
      `<div class="preview-code-line"><span class="preview-code-num">${i + 1}</span><span class="preview-code-content">${toks.map(tokenSpan).join('')}</span></div>`
    ).join('')
    return `
      <div class="preview-code">
        <div class="preview-code-tabs"><span class="preview-code-tab preview-code-tab--active">${ICON_PY} ${d.file}</span></div>
        <div class="preview-code-pre">${lines}</div>
      </div>
    `
  }

  function renderGithub(d) {
    return `
      <div class="preview-web">
        <div class="preview-web-bar"><span class="preview-web-lock">${ICON_LOCK}</span><span class="preview-web-url">github.com/${d.repo}</span></div>
        <div class="preview-github">
          <div class="preview-github-head">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            <span class="preview-github-repo">${d.repo}</span>
            <span class="preview-github-vis">Public</span>
          </div>
          <p class="preview-github-desc">${d.desc}</p>
          <div class="preview-github-meta">
            <span class="preview-github-lang"><span class="preview-github-lang-dot" style="--c:${d.langColor}"></span>${d.lang}</span>
            <span class="preview-github-pill">${ICON_STAR}${d.stars}</span>
            <span class="preview-github-pill">${ICON_FORK}${d.forks}</span>
          </div>
          <div class="preview-github-files">
            ${d.files.map(f => `<div class="preview-github-file">${f.icon === 'folder' ? ICON_FOLDER : ICON_FILE}<span>${f.name}</span></div>`).join('')}
          </div>
        </div>
      </div>
    `
  }

  function renderWeb(d) {
    return `
      <div class="preview-web">
        <div class="preview-web-bar"><span class="preview-web-lock">${ICON_LOCK}</span><span class="preview-web-url">${d.url}</span></div>
        <div class="preview-web-page">
          <div class="preview-web-site">${d.site}</div>
          <div class="preview-web-h1">${d.title}</div>
          ${d.blocks.map(blockHTML).join('')}
        </div>
      </div>
    `
  }

  function renderFigma(d) {
    return `
      <div class="preview-figma">
        <div class="preview-figma-toolbar"><span class="preview-figma-tool"></span><span class="preview-figma-tool"></span><span class="preview-figma-tool"></span><span class="preview-figma-file">${d.file} / ${d.page}</span><span class="preview-figma-zoom">100%</span></div>
        <div class="preview-figma-canvas">
          ${d.frames.map((name, i) => `
            <div class="preview-figma-frame" style="--d:${i * 100}ms">
              <span class="preview-figma-frame-label">${name}</span>
              <div class="preview-figma-screen">
                <div class="preview-figma-bar"></div>
                <div class="preview-figma-block preview-figma-block--lg"></div>
                <div class="preview-figma-block"></div>
                <div class="preview-figma-block preview-figma-block--sm"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  function renderDocPreview(d) {
    if (d.kind === 'pdf')    return renderPdf(d)
    if (d.kind === 'doc')    return renderDoc(d)
    if (d.kind === 'xls')    return renderXls(d)
    if (d.kind === 'code')   return renderCode(d)
    if (d.kind === 'github') return renderGithub(d)
    if (d.kind === 'web')    return renderWeb(d)
    if (d.kind === 'figma')  return renderFigma(d)
    return '<div class="preview-doc-p"><span class="preview-doc-line" style="--w:80%"></span></div>'
  }

  // ── Click handler : ouvre la preview, masque la grille et restaure au close
  document.querySelectorAll('.doc-item').forEach(item => {
    item.style.cursor = 'pointer'
    item.addEventListener('click', () => {
      const body = item.closest('.demo-docs-body')
      const grid = body.querySelector('.docs-grid')
      const empty = body.querySelector('.docs-empty')
      const old = body.querySelector('.doc-preview')
      if (old) old.remove()

      // Toggle : reclic sur le meme item ferme la preview
      if (item.classList.contains('doc-item--selected')) {
        item.classList.remove('doc-item--selected')
        if (grid)  grid.style.display = ''
        if (empty) empty.style.display = ''
        return
      }
      body.querySelectorAll('.doc-item--selected').forEach(s => s.classList.remove('doc-item--selected'))
      item.classList.add('doc-item--selected')

      const name  = item.querySelector('.doc-name')?.textContent.trim() || ''
      const meta  = item.querySelector('.doc-meta')?.textContent.trim() || ''
      const type  = item.querySelector('.doc-icon')?.textContent.trim() || ''
      const color = getComputedStyle(item).getPropertyValue('--doc-color').trim() || '#6366F1'

      const data = DOC_PREVIEWS[name] || { kind: type.toLowerCase() }
      const inner = renderDocPreview(data)

      const el = document.createElement('div')
      el.className = `doc-preview doc-preview--${data.kind}`
      el.style.setProperty('--c', color)
      el.innerHTML = `
        <div class="preview-header">
          <span class="preview-type-badge" style="background:${color}">${type || 'FILE'}</span>
          <div class="preview-titles">
            <span class="preview-name">${name}</span>
            ${meta ? `<span class="preview-meta">${meta}</span>` : ''}
          </div>
          <button class="preview-close" type="button" aria-label="Fermer l'aperçu">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="preview-body">${inner}</div>
      `
      if (grid)  grid.style.display = 'none'
      if (empty) empty.style.display = 'none'
      body.appendChild(el)

      function close() {
        el.remove()
        item.classList.remove('doc-item--selected')
        if (grid)  grid.style.display = ''
        if (empty) empty.style.display = ''
      }
      el.querySelector('.preview-close').addEventListener('click', e => { e.stopPropagation(); close() })
    })
  })
})
