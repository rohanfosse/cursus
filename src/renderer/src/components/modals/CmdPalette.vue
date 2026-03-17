<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
  import { Search } from 'lucide-vue-next'
  import logoUrl from '@/assets/logo.png'
  import { useAppStore }      from '@/stores/app'
  import { useModalsStore }   from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { useRouter }        from 'vue-router'
  import type { Channel, Student, Promotion } from '@/types'

  const appStore      = useAppStore()
  const modals        = useModalsStore()
  const messagesStore = useMessagesStore()
  const router        = useRouter()

  const query    = ref('')
  const inputEl  = ref<HTMLInputElement | null>(null)
  const listEl   = ref<HTMLUListElement | null>(null)
  const selected = ref(0)

  // Données pour la recherche
  const allChannels = ref<(Channel & { promo_name?: string })[]>([])
  const allStudents = ref<Student[]>([])
  const allPromos   = ref<Promotion[]>([])

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

  // ── Fuzzy search ──────────────────────────────────────────────────────────
  /**
   * Algorithme de scoring inspiré de FZF, sans dépendance externe.
   *
   * Principe : tous les caractères de `q` doivent apparaître dans `str`
   * dans l'ordre (sous-séquence). Le score favorise :
   *   - les correspondances consécutives (+5 par caractère consécutif)
   *   - les débuts de mot / après séparateur (+3)
   *
   * Retourne -1 si aucune correspondance (filtre out).
   *
   * Pourquoi pas une vraie lib (fuse.js, fuzzysort) ?
   *   - Pas de bundle supplémentaire (~20 kB non compressé pour fuse.js)
   *   - La palette traite au plus quelques dizaines de canaux/étudiants
   *   - Cet algo couvre 95 % des cas d'usage réels (typos légères, initiales)
   */
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

    // Tous les caractères de la query n'ont pas été trouvés → pas de match
    return qi < query_.length ? -1 : score
  }

  const SECTIONS = [
    { key: 'messages',  label: 'Messages' },
    { key: 'travaux',   label: 'Travaux'  },
    { key: 'documents', label: 'Documents'},
  ]

  const results = computed(() => {
    const q = query.value.trim()
    if (!q) return []

    const channels = allChannels.value
      .map((c) => ({ item: c, score: fuzzyScore(c.name, q) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ item: c }) => ({
        type: 'channel' as const,
        label: `#${c.name}`,
        sub: c.promo_name,
        data: c,
      }))

    const students = allStudents.value
      .map((s) => ({ item: s, score: fuzzyScore(s.name, q) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ item: s }) => ({
        type: 'dm' as const,
        label: `@${s.name}`,
        sub: (s as Student & { promo_name?: string }).promo_name,
        data: s,
      }))

    const sections = SECTIONS
      .filter(({ key }) => fuzzyScore(key, q) >= 0)
      .map(({ key, label }) => ({
        type: 'section' as const,
        label,
        sub: 'Section',
        data: key,
      }))

    return [...channels, ...students, ...sections]
  })

  // ── Remise à zéro de la sélection quand les résultats changent ───────────
  watch(results, () => { selected.value = 0 })

  // ── Navigation clavier — scroll automatique vers l'item sélectionné ──────
  /**
   * scrollIntoView({ block: 'nearest' }) est la méthode native la plus
   * performante : elle ne scrolle que si l'élément est hors de la vue,
   * et uniquement de la distance minimale nécessaire.
   * Pas besoin de calculer des offsets manuellement.
   */
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
    query.value = ''

    if (item.type === 'channel') {
      const c = item.data as Channel & { promo_name?: string }
      appStore.openChannel(c.id, c.promo_id, c.name, c.type)
      messagesStore.fetchMessages()
    } else if (item.type === 'dm') {
      const s = item.data as Student
      appStore.openDm(s.id, s.promo_id, s.name)
      messagesStore.fetchMessages()
    } else {
      router.push('/' + item.data)
    }
  }

  function onGlobalKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); modals.cmdPalette = true }
  }

  onMounted(()   => { document.addEventListener('keydown', onGlobalKey); loadData() })
  onUnmounted(() => document.removeEventListener('keydown', onGlobalKey))

  watch(() => modals.cmdPalette, (open) => {
    if (open) {
      query.value    = ''
      selected.value = 0
      setTimeout(() => inputEl.value?.focus(), 50)
    }
  })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modals.cmdPalette"
      class="modal-overlay"
      @click.self="modals.cmdPalette = false"
    >
      <div class="cmd-palette-box">
        <!-- Barre de recherche -->
        <div class="cmd-search-bar">
          <img :src="logoUrl" class="cmd-logo" alt="CESIA" />
          <input
            ref="inputEl"
            v-model="query"
            type="text"
            placeholder="Chercher un canal, un étudiant, une section…"
            class="cmd-search-input"
            @keydown.escape="modals.cmdPalette = false"
            @keydown.arrow-down.prevent="moveSelection(+1)"
            @keydown.arrow-up.prevent="moveSelection(-1)"
            @keydown.enter.prevent="select(selected)"
          />
          <kbd class="cmd-kbd">Esc</kbd>
        </div>

        <!-- Résultats -->
        <ul ref="listEl" class="cmd-results">
          <template v-if="results.length">
            <li
              v-for="(r, i) in results"
              :key="i"
              data-result-item
              class="cmd-result-item"
              :class="{ active: i === selected }"
              @click="select(i)"
              @mouseenter="selected = i"
            >
              <span class="cmd-result-label">{{ r.label }}</span>
              <span class="cmd-result-sub">{{ r.sub }}</span>
            </li>
          </template>
          <li v-else-if="query" class="cmd-empty">Aucun résultat pour « {{ query }} »</li>
          <li v-else class="cmd-empty">Tapez pour chercher…</li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cmd-palette-box {
  width: 100%;
  max-width: 560px;
  background: var(--bg-modal);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(0,0,0,.5);
}

/* ── Barre de recherche ── */
.cmd-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.25));
}

.cmd-search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
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

.cmd-kbd {
  flex-shrink: 0;
  font-size: 10px;
  font-family: var(--font);
  color: var(--text-muted);
  background: rgba(255,255,255,.07);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
}

/* ── Liste des résultats ── */
.cmd-results {
  list-style: none;
  padding: 6px 0;
  max-height: 360px;
  overflow-y: auto;
  /* Scroll discret */
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.12) transparent;
}

.cmd-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 16px;
  cursor: pointer;
  transition: background .08s;
  gap: 12px;
}

.cmd-result-item.active {
  background: rgba(74,144,217,.15);
}

.cmd-result-item:hover:not(.active) {
  background: var(--bg-hover);
}

.cmd-result-label {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
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

.cmd-empty {
  padding: 20px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  font-style: italic;
}
</style>
