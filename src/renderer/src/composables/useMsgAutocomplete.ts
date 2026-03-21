/**
 * Autocomplétion unifiée dans le champ de message : @mention, #channel, /devoir, /doc.
 * Used by MessageInput.vue
 */
import { ref, computed, watch, nextTick, onMounted, type Ref } from 'vue'
import { useAppStore } from '@/stores/app'

// ── Types ────────────────────────────────────────────────────────────────────
export type RefType = 'mention' | 'channel' | 'devoir' | 'doc'

export interface MentionUser {
  name: string
  type: 'student' | 'teacher' | 'ta' | 'everyone'
}

export interface RefChannel { name: string; type: string }
export interface RefDevoir { id: number; title: string; type: string; deadline: string }
export interface RefDoc    { name: string; type: string; category: string | null }

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Unified autocomplete: @mention, #channel, /devoir, /doc.
 */
export function useMsgAutocomplete(
  content: Ref<string>,
  inputEl: Ref<HTMLTextAreaElement | null>,
  autoResize: () => void,
) {
  const appStore = useAppStore()

  // ── Mention state ──────────────────────────────────────────────────────────
  const allUsers        = ref<MentionUser[]>([])
  const mentionActive   = ref(false)
  const mentionSearch   = ref('')
  const mentionStart    = ref(-1)
  const mentionIndex    = ref(0)
  const mentionPopupEl  = ref<HTMLElement | null>(null)

  const mentionResults = computed(() => {
    if (!mentionActive.value) return []
    const q = normalize(mentionSearch.value)
    return allUsers.value
      .filter((u) => normalize(u.name).includes(q))
      .slice(0, 8)
  })

  watch(mentionSearch, () => { mentionIndex.value = 0 })
  watch(() => appStore.activePromoId, () => { allUsers.value = [] })

  async function loadUsers() {
    if (allUsers.value.length) return

    let students: MentionUser[] = []
    const promoId = appStore.activePromoId

    if (promoId) {
      const res = await window.api.getStudents(promoId)
      if (res?.ok) students = res.data.map((s: { name: string }) => ({ name: s.name, type: 'student' as const }))
    } else {
      const res = await window.api.getAllStudents()
      if (res?.ok) students = res.data.map((s: { name: string }) => ({ name: s.name, type: 'student' as const }))
    }

    if (appStore.currentUser && appStore.currentUser.type !== 'student') {
      const myName = appStore.currentUser.name
      const myType = appStore.currentUser.type as 'teacher' | 'ta'
      if (!students.some((u) => u.name === myName)) {
        students = [{ name: myName, type: myType }, ...students]
      }
    }

    allUsers.value = [{ name: 'everyone', type: 'everyone' }, ...students]
  }

  function insertMention(name: string) {
    if (!inputEl.value) return
    const cursorPos = inputEl.value.selectionStart ?? 0
    const before    = content.value.slice(0, mentionStart.value)
    const after     = content.value.slice(cursorPos)
    content.value   = `${before}@${name} ${after}`
    mentionActive.value = false
    nextTick(() => {
      const pos = mentionStart.value + name.length + 2
      inputEl.value?.setSelectionRange(pos, pos)
      inputEl.value?.focus()
      autoResize()
    })
  }

  function closeMention() {
    mentionActive.value = false
    mentionIndex.value  = 0
  }

  // ── Ref autocomplete (#channel, /devoir, /doc) ───────────────────────────
  const channelList = ref<RefChannel[]>([])
  const devoirList  = ref<RefDevoir[]>([])
  const docList     = ref<RefDoc[]>([])
  const activeRef   = ref<RefType | null>(null)
  const refSearch   = ref('')
  const refStart    = ref(-1)
  const refIndex    = ref(0)

  const refResults = computed(() => {
    if (!activeRef.value || activeRef.value === 'mention') return []
    const q = normalize(refSearch.value)
    if (activeRef.value === 'channel') {
      return channelList.value.filter(c => normalize(c.name).includes(q)).slice(0, 8)
    }
    if (activeRef.value === 'devoir') {
      return devoirList.value.filter(d => normalize(d.title).includes(q)).slice(0, 8)
    }
    if (activeRef.value === 'doc') {
      return docList.value.filter(d => normalize(d.name).includes(q)).slice(0, 8)
    }
    return []
  })

  watch(refSearch, () => { refIndex.value = 0 })

  let _channelsLoadedForPromo: number | null = null
  async function loadChannels() {
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (!promoId) return
    if (channelList.value.length && _channelsLoadedForPromo === promoId) return
    const res = await window.api.getChannels(promoId)
    channelList.value = res?.ok ? (res.data as RefChannel[]) : []
    _channelsLoadedForPromo = promoId
  }

  async function loadDevoirs() {
    const channelId = appStore.activeChannelId
    if (!channelId) return
    const res = await window.api.getTravaux(channelId)
    devoirList.value = res?.ok ? (res.data as RefDevoir[]) : []
  }

  async function loadDocs() {
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (!promoId) return
    const res = await window.api.getProjectDocuments(promoId)
    docList.value = res?.ok ? (res.data as RefDoc[]) : []
  }

  // Précharger au montage et quand la promo change
  onMounted(() => {
    loadUsers()
    loadChannels()
  })
  watch(() => appStore.activePromoId, () => {
    _channelsLoadedForPromo = null
    channelList.value = []
    loadChannels()
  })

  function insertRef(text: string) {
    const el = inputEl.value
    if (!el) return
    const end  = el.selectionStart
    const pre  = content.value.slice(0, refStart.value)
    const post = content.value.slice(end)
    content.value = pre + text + ' ' + post
    activeRef.value = null
    nextTick(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = refStart.value + text.length + 1
      autoResize()
    })
  }

  // ── Popup positioning (escape overflow:hidden parents) ───────────────────
  const wrapperEl = ref<HTMLElement | null>(null)
  const popupStyle = computed(() => {
    if (!wrapperEl.value) return {}
    const rect = wrapperEl.value.getBoundingClientRect()
    return {
      position: 'fixed' as const,
      bottom: `${window.innerHeight - rect.top + 6}px`,
      left:   `${rect.left}px`,
      width:  `${rect.width}px`,
      zIndex: '9999',
    }
  })

  /** Detect autocomplete triggers from current input */
  function detectTriggers() {
    if (!inputEl.value) return
    const cursor = inputEl.value.selectionStart ?? 0
    const before = content.value.slice(0, cursor)

    const matchMention = before.match(/@([^\s@]*)$/)
    const matchChannel = before.match(/#([^\s#]*)$/)
    const matchDevoir2 = before.match(/\\([^\s\\]*)$/)
    const matchDevoir  = before.match(/\/devoir\s?(.*)$/i)
    const matchDoc     = before.match(/\/doc\s?(.*)$/i)

    if (matchMention) {
      mentionSearch.value = matchMention[1]
      mentionStart.value  = cursor - matchMention[0].length
      mentionActive.value = true
      activeRef.value = null
      loadUsers()
    } else if (matchChannel) {
      activeRef.value = 'channel'
      refSearch.value = matchChannel[1]
      refStart.value  = cursor - matchChannel[0].length
      mentionActive.value = false
      loadChannels()
    } else if (matchDevoir2) {
      activeRef.value = 'devoir'
      refSearch.value = matchDevoir2[1]
      refStart.value  = cursor - matchDevoir2[0].length
      mentionActive.value = false
      loadDevoirs()
    } else if (matchDevoir) {
      activeRef.value = 'devoir'
      refSearch.value = matchDevoir[1]
      refStart.value  = cursor - matchDevoir[0].length
      mentionActive.value = false
      loadDevoirs()
    } else if (matchDoc) {
      activeRef.value = 'doc'
      refSearch.value = matchDoc[1]
      refStart.value  = cursor - matchDoc[0].length
      mentionActive.value = false
      loadDocs()
    } else {
      mentionActive.value = false
      activeRef.value = null
    }
  }

  function scrollMentionIntoView() {
    nextTick(() => {
      const popup = mentionPopupEl.value
      if (!popup) return
      const active = popup.querySelector('.mi-mention-selected') as HTMLElement
      active?.scrollIntoView({ block: 'nearest' })
    })
  }

  // ── Trigger buttons ──────────────────────────────────────────────────────
  function triggerMention() {
    const el = inputEl.value
    if (!el) return
    const pos    = el.selectionStart ?? content.value.length
    const before = content.value.slice(0, pos)
    const after  = content.value.slice(pos)
    content.value = before + '@' + after
    nextTick(() => {
      const newPos = pos + 1
      el.setSelectionRange(newPos, newPos)
      el.focus()
      mentionSearch.value = ''
      mentionStart.value  = newPos - 1
      mentionActive.value = true
      loadUsers()
      autoResize()
    })
  }

  function triggerChannel() {
    const el = inputEl.value
    if (!el) return
    const pos    = el.selectionStart ?? content.value.length
    const before = content.value.slice(0, pos)
    const after  = content.value.slice(pos)
    content.value = before + '#' + after
    nextTick(() => {
      const newPos = pos + 1
      el.setSelectionRange(newPos, newPos)
      el.focus()
      refSearch.value = ''
      refStart.value  = newPos - 1
      activeRef.value = 'channel'
      loadChannels()
      autoResize()
    })
  }

  function triggerDevoir() {
    const el = inputEl.value
    if (!el) return
    const pos    = el.selectionStart ?? content.value.length
    const before = content.value.slice(0, pos)
    const after  = content.value.slice(pos)
    content.value = before + '\\' + after
    nextTick(() => {
      const newPos = pos + 1
      el.setSelectionRange(newPos, newPos)
      el.focus()
      refSearch.value = ''
      refStart.value  = newPos - 1
      activeRef.value = 'devoir'
      loadDevoirs()
      autoResize()
    })
  }

  function dismissAll() {
    closeMention()
    activeRef.value = null
  }

  return {
    // Mention
    mentionActive,
    mentionResults,
    mentionIndex,
    mentionPopupEl,
    insertMention,
    closeMention,
    // Ref autocomplete
    activeRef,
    refResults,
    refIndex,
    insertRef,
    // Popup
    wrapperEl,
    popupStyle,
    // Triggers
    detectTriggers,
    scrollMentionIntoView,
    triggerMention,
    triggerChannel,
    triggerDevoir,
    dismissAll,
  }
}
