<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
  import { Search } from '@lucide/vue-next'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { useRouter } from 'vue-router'
  import type { Channel, Student, Promotion } from '@/types'

  const appStore      = useAppStore()
  const modals        = useModalsStore()
  const messagesStore = useMessagesStore()
  const router        = useRouter()

  const query       = ref('')
  const inputEl     = ref<HTMLInputElement | null>(null)
  const selected    = ref(0)

  // Données pour la recherche
  const allChannels  = ref<(Channel & { promo_name?: string })[]>([])
  const allStudents  = ref<Student[]>([])
  const allPromos    = ref<Promotion[]>([])

  async function loadData() {
    const [pRes, sRes] = await Promise.all([
      window.api.getPromotions(),
      window.api.getAllStudents(),
    ])
    allPromos.value   = pRes?.ok  ? pRes.data  : []
    allStudents.value = sRes?.ok  ? sRes.data  : []

    const chArrays = await Promise.all(
      allPromos.value.map((p) => window.api.getChannels(p.id)),
    )
    allChannels.value = chArrays
      .flatMap((r, i) => (r?.ok ? r.data.map((c) => ({ ...c, promo_name: allPromos.value[i].name })) : []))
  }

  const results = computed(() => {
    const q = query.value.trim().toLowerCase()
    if (!q) return []

    const channels = allChannels.value
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({ type: 'channel' as const, label: `#${c.name}`, sub: c.promo_name, data: c }))

    const students = allStudents.value
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s) => ({ type: 'dm' as const, label: `@${s.name}`, sub: s.promo_name, data: s }))

    const sections = ['messages', 'travaux', 'documents']
      .filter((s) => s.includes(q))
      .map((s) => ({ type: 'section' as const, label: s.charAt(0).toUpperCase() + s.slice(1), sub: 'Section', data: s }))

    return [...channels, ...students, ...sections]
  })

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

  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); modals.cmdPalette = true }
  }

  onMounted(()   => { document.addEventListener('keydown', onKey); loadData() })
  onUnmounted(() => document.removeEventListener('keydown', onKey))

  watch(() => modals.cmdPalette, (open) => {
    if (open) { query.value = ''; selected.value = 0; setTimeout(() => inputEl.value?.focus(), 50) }
  })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modals.cmdPalette"
      id="cmd-palette-overlay"
      class="modal-overlay"
      @click.self="modals.cmdPalette = false"
    >
      <div class="cmd-palette-box" style="max-width:560px;width:100%;background:var(--bg-secondary);border-radius:var(--radius);padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border)">
          <Search :size="16" style="color:var(--text-muted)" />
          <input
            id="cmd-palette-input"
            ref="inputEl"
            v-model="query"
            type="text"
            placeholder="Chercher un canal, un étudiant, une section…"
            style="flex:1;background:transparent;border:none;outline:none;color:var(--text-primary);font-size:14px"
            @keydown.escape="modals.cmdPalette = false"
            @keydown.arrow-down.prevent="selected = Math.min(selected + 1, results.length - 1)"
            @keydown.arrow-up.prevent="selected = Math.max(selected - 1, 0)"
            @keydown.enter.prevent="select(selected)"
          />
        </div>
        <ul id="cmd-palette-results" style="list-style:none;padding:8px 0;max-height:360px;overflow-y:auto">
          <li
            v-for="(r, i) in results"
            :key="i"
            class="cmd-result-item"
            :class="{ active: i === selected }"
            style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;cursor:pointer"
            @click="select(i)"
            @mouseenter="selected = i"
          >
            <span>{{ r.label }}</span>
            <span style="font-size:11px;color:var(--text-muted)">{{ r.sub }}</span>
          </li>
          <li v-if="!results.length && query" style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">
            Aucun résultat
          </li>
          <li v-else-if="!query" style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">
            Tapez pour chercher…
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>
