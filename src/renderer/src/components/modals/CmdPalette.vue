<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
  import { Search, Hash, MessageSquare, User, LayoutGrid } from 'lucide-vue-next'
  import logoUrl from '@/assets/logo.png'
  import { useAppStore }      from '@/stores/app'
  import { useModalsStore }   from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { useRouter }        from 'vue-router'
  import { formatDate } from '@/utils/date'
  import type { Channel, Student, Promotion } from '@/types'

  const appStore      = useAppStore()
  const modals        = useModalsStore()
  const messagesStore = useMessagesStore()
  const router        = useRouter()

  const query    = ref('')
  const inputEl  = ref<HTMLInputElement | null>(null)
  const listEl   = ref<HTMLUListElement | null>(null)
  const selected = ref(0)

  // Données structure
  const allChannels = ref<(Channel & { promo_name?: string })[]>([])
  const allStudents = ref<Student[]>([])
  const allPromos   = ref<Promotion[]>([])

  // Résultats messages (async, debounced)
  type MsgResult = { id: number; content: string; author_name: string; created_at: string; channel_id: number; channel_name: string; promo_id: number }
  const msgResults    = ref<MsgResult[]>([])
  const msgSearching  = ref(false)
  let   debounceTimer = 0

  async function loadData() {
    const [pRes, sRes] = await Promise.all([
      window.api.getPromotions(),
      window.api.getAllStudents(),
    ])
    allPromos.value   = pRes?.ok ? pRes.data : []
    allStudents.value = sRes?.ok ? sRes.data : []

    const chArrays = await Promise.all(
      allPromos.value.map((p) => window.api.getChannels(p.id)),
    )
    allChannels.value = chArrays.flatMap((r, i) =>
      r?.ok ? r.data.map((c) => ({ ...c, promo_name: allPromos.value[i].name })) : [],
    )
  }

  // ── Fuzzy score (même algo qu'avant) ─────────────────────────────────────
  function fuzzyScore(str: string, q: string): number {
    if (!q) return 0
    const s = str.toLowerCase()
    const query_ = q.toLowerCase()
    let si = 0, qi = 0, score = 0, lastMatchIdx = -1
    while (si < s.length && qi < query_.length) {
      if (s[si] === query_[qi]) {
        const consecutive = lastMatchIdx === si - 1 ? 5 : 0
        const wordStart   = si === 0 || /[\s\-_.]/.test(s[si - 1]) ? 3 : 0
        score += 1 + consecutive + wordStart
        lastMatchIdx = si
        qi++
      }
      si++
    }
    return qi < query_.length ? -1 : score
  }

  // ── Troncature contenu message ────────────────────────────────────────────
  function excerpt(content: string, q: string, maxLen = 72): string {
    const clean = content.replace(/[*_`>#[\]!]/g, '').trim()
    const idx   = clean.toLowerCase().indexOf(q.toLowerCase())
    if (idx > 20) {
      return '…' + clean.slice(Math.max(0, idx - 10), idx + maxLen - 12) + (clean.length > idx + maxLen ? '…' : '')
    }
    return clean.slice(0, maxLen) + (clean.length > maxLen ? '…' : '')
  }

  const SECTIONS = [
    { key: 'messages',  label: 'Messages' },
    { key: 'travaux',   label: 'Travaux'  },
    { key: 'documents', label: 'Documents'},
  ]

  type ResultItem =
    | { type: 'channel'; label: string; sub: string; data: Channel & { promo_name?: string } }
    | { type: 'dm';      label: string; sub: string; data: Student }
    | { type: 'section'; label: string; sub: string; data: string }
    | { type: 'message'; label: string; sub: string; data: MsgResult }

  const structureResults = computed((): ResultItem[] => {
    const q = query.value.trim()
    if (!q) return []

    const channels = allChannels.value
      .map((c) => ({ item: c, score: fuzzyScore(c.name, q) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ item: c }): ResultItem => ({ type: 'channel', label: `#${c.name}`, sub: c.promo_name ?? '', data: c }))

    const students = allStudents.value
      .map((s) => ({ item: s, score: fuzzyScore(s.name, q) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ item: s }): ResultItem => ({ type: 'dm', label: s.name, sub: (s as Student & { promo_name?: string }).promo_name ?? '', data: s }))

    const sections = SECTIONS
      .filter(({ key }) => fuzzyScore(key, q) >= 0)
      .map(({ key, label }): ResultItem => ({ type: 'section', label, sub: 'Section', data: key }))

    return [...channels, ...students, ...sections]
  })

  const results = computed((): ResultItem[] => {
    const msgs: ResultItem[] = msgResults.value.map((m): ResultItem => ({
      type:  'message',
      label: excerpt(m.content, query.value.trim()),
      sub:   `#${m.channel_name} · ${formatDate(m.created_at)}`,
      data:  m,
    }))
    return [...structureResults.value, ...msgs]
  })

  // ── Recherche asynchrone de messages (debounce 300ms) ────────────────────
  async function searchMessages(q: string) {
    if (q.length < 2) { msgResults.value = []; return }
    msgSearching.value = true
    try {
      const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id ?? null
      const res = await window.api.searchAllMessages({ promoId, query: q, limit: 10 })
      msgResults.value = res?.ok ? res.data : []
    } finally {
      msgSearching.value = false
    }
  }

  watch(query, (q) => {
    clearTimeout(debounceTimer)
    const trimmed = q.trim()
    if (!trimmed) { msgResults.value = []; return }
    debounceTimer = window.setTimeout(() => searchMessages(trimmed), 300)
  })

  // ── Navigation ────────────────────────────────────────────────────────────
  watch(results, () => { selected.value = 0 })

  watch(selected, () => {
    nextTick(() => {
      if (!listEl.value) return
      const items = listEl.value.querySelectorAll<HTMLElement>('[data-result-item]')
      items[selected.value]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  })

  function moveSelection(delta: number) {
    selected.value = Math.max(0, Math.min(selected.value + delta, results.value.length - 1))
  }

  function select(i: number) {
    const item = results.value[i]
    if (!item) return
    modals.cmdPalette = false
    query.value       = ''
    msgResults.value  = []

    if (item.type === 'channel') {
      const c = item.data as Channel & { promo_name?: string }
      appStore.openChannel(c.id, c.promo_id, c.name, c.type)
      messagesStore.fetchMessages()
    } else if (item.type === 'dm') {
      const s = item.data as Student
      appStore.openDm(s.id, s.promo_id, s.name)
      messagesStore.fetchMessages()
    } else if (item.type === 'section') {
      router.push('/' + item.data)
    } else if (item.type === 'message') {
      const m = item.data as MsgResult
      const ch = allChannels.value.find((c) => c.id === m.channel_id)
      if (ch) {
        messagesStore.highlightMessageId = m.id
        appStore.openChannel(ch.id, ch.promo_id, ch.name, ch.type)
        router.push('/messages')
        messagesStore.fetchMessages()
      }
    }
  }

  function onGlobalKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); modals.cmdPalette = true }
  }

  onMounted(()   => { document.addEventListener('keydown', onGlobalKey); loadData() })
  onUnmounted(() => { document.removeEventListener('keydown', onGlobalKey); clearTimeout(debounceTimer) })

  watch(() => modals.cmdPalette, (open) => {
    if (open) {
      query.value       = ''
      selected.value    = 0
      msgResults.value  = []
      setTimeout(() => inputEl.value?.focus(), 50)
    }
  })

  // ── Icône par type de résultat ────────────────────────────────────────────
  function resultIcon(type: string) {
    if (type === 'channel') return Hash
    if (type === 'dm')      return User
    if (type === 'section') return LayoutGrid
    return MessageSquare
  }

  // Détecter la première occurrence d'un type 'message' pour afficher le séparateur
  function isFirstMessage(i: number): boolean {
    if (results.value[i].type !== 'message') return false
    return i === 0 || results.value[i - 1].type !== 'message'
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="cmd-fade">
      <div
        v-if="modals.cmdPalette"
        class="modal-overlay"
        @click.self="modals.cmdPalette = false"
      >
        <div class="cmd-palette-box">
          <!-- Barre de recherche -->
          <div class="cmd-search-bar">
            <img :src="logoUrl" class="cmd-logo" alt="Cursus" />
            <Search :size="15" class="cmd-search-icon" />
            <input
              ref="inputEl"
              v-model="query"
              type="text"
              placeholder="Canaux, contacts, messages…"
              class="cmd-search-input"
              aria-label="Rechercher des canaux, contacts ou messages"
              @keydown.escape="modals.cmdPalette = false"
              @keydown.arrow-down.prevent="moveSelection(+1)"
              @keydown.arrow-up.prevent="moveSelection(-1)"
              @keydown.enter.prevent="select(selected)"
            />
            <span v-if="msgSearching" class="cmd-searching-dot" title="Recherche…" />
            <kbd class="cmd-kbd">Esc</kbd>
          </div>

          <!-- Résultats -->
          <ul ref="listEl" class="cmd-results">
            <template v-if="results.length">
              <!-- Séparateur avant la section Messages -->
              <template v-for="(r, i) in results" :key="i">
                <li v-if="isFirstMessage(i)" class="cmd-section-sep">
                  <span>Messages</span>
                </li>
                <li
                  data-result-item
                  class="cmd-result-item"
                  :class="{ active: i === selected }"
                  @click="select(i)"
                  @mouseenter="selected = i"
                >
                  <component :is="resultIcon(r.type)" :size="13" class="cmd-result-icon" :class="`icon-${r.type}`" />
                  <div class="cmd-result-body">
                    <span class="cmd-result-label">{{ r.label }}</span>
                    <span v-if="r.type === 'message'" class="cmd-result-author">
                      {{ (r.data as any).author_name }}
                    </span>
                  </div>
                  <span class="cmd-result-sub">{{ r.sub }}</span>
                </li>
              </template>
            </template>

            <li v-else-if="query" class="cmd-empty">
              <Search :size="16" class="cmd-empty-icon" />
              Aucun résultat pour « {{ query }} »
            </li>
            <li v-else class="cmd-empty cmd-empty-hint">
              <kbd>↑</kbd><kbd>↓</kbd> naviguer &nbsp;·&nbsp; <kbd>↵</kbd> ouvrir &nbsp;·&nbsp; <kbd>Ctrl K</kbd> ouvrir/fermer
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Transition overlay ── */
.cmd-fade-enter-active,
.cmd-fade-leave-active { transition: opacity .12s ease; }
.cmd-fade-enter-from,
.cmd-fade-leave-to     { opacity: 0; }

.cmd-palette-box {
  width: 100%;
  max-width: 580px;
  background: var(--bg-modal);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 28px 56px rgba(0, 0, 0, .55);
}

/* ── Barre de recherche ── */
.cmd-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.cmd-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.25));
}

.cmd-search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.cmd-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 14px;
}
.cmd-search-input::placeholder { color: var(--text-muted); }

/* Point de chargement ── */
.cmd-searching-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: cmd-pulse 1.2s ease-in-out infinite;
}
@keyframes cmd-pulse {
  0%, 100% { opacity: .3; transform: scale(.8); }
  50%       { opacity: 1;  transform: scale(1.1); }
}

.cmd-kbd {
  flex-shrink: 0;
  font-size: 11px;
  font-family: var(--font);
  color: var(--text-muted);
  background: rgba(255, 255, 255, .07);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
}

/* ── Séparateur de section Messages ── */
.cmd-section-sep {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  margin-top: 4px;
  user-select: none;
}

/* ── Liste des résultats ── */
.cmd-results {
  list-style: none;
  padding: 6px 0;
  max-height: 380px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, .12) transparent;
}

.cmd-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background .08s;
}
.cmd-result-item.active     { background: rgba(74, 144, 217, .15); }
.cmd-result-item:hover:not(.active) { background: var(--bg-hover); }

/* Icône type ── */
.cmd-result-icon { flex-shrink: 0; color: var(--text-muted); }
.icon-channel { color: var(--accent); }
.icon-message { color: #9B87F5; }
.icon-dm      { color: #27AE60; }
.icon-section { color: var(--color-warning, #E5A842); }

/* Corps du résultat ── */
.cmd-result-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cmd-result-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cmd-result-author {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cmd-result-sub {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── État vide ── */
.cmd-empty {
  padding: 20px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  font-style: italic;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.cmd-empty-icon { opacity: .4; }

.cmd-empty-hint {
  font-size: 11.5px;
  font-style: normal;
  gap: 4px;
}
.cmd-empty-hint kbd {
  font-size: 10px;
  font-family: var(--font);
  background: rgba(255, 255, 255, .08);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--text-secondary);
}
</style>
