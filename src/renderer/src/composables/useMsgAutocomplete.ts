/**
 * Autocomplétion unifiée dans le champ de message : @mention, #channel, /devoir, /doc.
 * Used by MessageInput.vue
 */
import { ref, computed, watch, nextTick, onMounted, type Ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { searchEmojiShortcodes, type EmojiShortcode } from '@/utils/emojiShortcodes'

// ── Types ────────────────────────────────────────────────────────────────────
export type RefType = 'mention' | 'channel' | 'devoir' | 'doc' | 'command' | 'emoji'

export interface SlashCommand {
  name: string
  description: string
  icon: string
  category: 'ref' | 'format' | 'util'
  color: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Références
  { name: 'devoir',   description: 'Référencer un devoir',                icon: 'BookOpen',     category: 'ref',    color: '#9B87F5' },
  { name: 'doc',      description: 'Référencer un document',              icon: 'FileText',     category: 'ref',    color: '#2ECC71' },
  // Formatage
  { name: 'annonce',   description: 'Message d\'annonce officiel',         icon: 'Megaphone',    category: 'format', color: '#4A90D9' },
  { name: 'sondage',   description: 'Sondage avec options de vote',        icon: 'BarChart2',    category: 'format', color: '#1ABC9C' },
  { name: 'tableau',   description: 'Tableau en colonnes',                 icon: 'Table',        category: 'format', color: '#E67E22' },
  { name: 'checklist', description: 'Liste de tâches cochables',           icon: 'ListChecks',   category: 'format', color: '#16A085' },
  { name: 'code',      description: 'Bloc de code avec coloration',        icon: 'Code2',        category: 'format', color: '#8E44AD' },
  { name: 'math',      description: 'Formule mathématique (LaTeX)',        icon: 'Sigma',        category: 'format', color: '#D35400' },
  // Utilitaires
  { name: 'aide',     description: 'Raccourcis et syntaxe disponibles',   icon: 'HelpCircle',   category: 'util',   color: '#95A5A6' },
  { name: 'date',     description: 'Insérer une date',                    icon: 'Calendar',     category: 'util',   color: '#3498DB' },
]

export const COMMAND_CATEGORIES: Record<string, string> = {
  ref:    'Références',
  format: 'Formatage',
  util:   'Utilitaires',
}

export interface MentionUser {
  name: string
  type: 'admin' | 'student' | 'teacher' | 'ta' | 'everyone'
}

export interface RefChannel { name: string; type: string }
export interface RefDevoir { id: number; title: string; type: string; deadline: string }
export interface RefDoc    { id: number; name: string; type: string; content: string; category: string | null }

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export interface SlashHandlers {
  /** Appele quand /sondage est execute. Retourner true pour skip le template. */
  onOpenPoll?: () => void
  /** Appele quand /aide est execute. */
  onOpenHelp?: () => void
  /** Appele quand /tableau est execute : ouvre le builder visuel au lieu
   *  d'inserer un template markdown brut dans le textarea. */
  onOpenTable?: () => void
  /** Appele quand /code est execute : ouvre le builder avec selecteur de
   *  langage + preview highlight.js. Fallback sur l'ancien template js vide. */
  onOpenCode?: () => void
  /** Appele quand /annonce est execute : ouvre le builder qui genere un
   *  bloc formate (emoji type + titre + message + blockquote). */
  onOpenAnnounce?: () => void
  /** Appele quand /checklist est execute : ouvre le builder qui genere une
   *  liste de taches markdown `- [ ] item` (GFM task list). */
  onOpenChecklist?: () => void
  /** Appele quand /date est execute : ouvre le date-picker (vs insertion
   *  immediate de la date du jour en fallback). */
  onOpenDate?: () => void
  /** Appele quand /math est execute : ouvre l'editeur LaTeX avec preview
   *  KaTeX et chips de formules courantes. */
  onOpenMath?: () => void
}

/**
 * Unified autocomplete: @mention, #channel, /devoir, /doc.
 */
export function useMsgAutocomplete(
  content: Ref<string>,
  inputEl: Ref<HTMLTextAreaElement | null>,
  autoResize: () => void,
  handlers: SlashHandlers = {},
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
    const filtered = allUsers.value
      .filter((u) => normalize(u.name).includes(q))
    // Sort: @everyone first (already at index 0 in allUsers), then teachers (Pilotes), then students alphabetically
    filtered.sort((a, b) => {
      if (a.type === 'everyone') return -1
      if (b.type === 'everyone') return 1
      if ((a.type === 'admin' || a.type === 'teacher') && b.type !== 'admin' && b.type !== 'teacher') return -1
      if ((b.type === 'admin' || b.type === 'teacher') && a.type !== 'admin' && a.type !== 'teacher') return 1
      if (a.type === 'ta' && b.type === 'student') return -1
      if (b.type === 'ta' && a.type === 'student') return 1
      return a.name.localeCompare(b.name, 'fr')
    })
    return filtered.slice(0, 8)
  })

  watch(mentionSearch, () => { mentionIndex.value = 0 })
  watch(() => appStore.activePromoId, () => { allUsers.value = [] })

  async function loadUsers() {
    if (allUsers.value.length) return

    let users: MentionUser[] = []
    const promoId = appStore.activePromoId

    if (promoId) {
      const [stuRes, teachRes] = await Promise.all([
        window.api.getStudents(promoId),
        window.api.getTeachers(),
      ])
      if (stuRes?.ok) users.push(...stuRes.data.map((s: { name: string }) => ({ name: s.name, type: 'student' as const })))
      if (teachRes?.ok) {
        for (const t of teachRes.data as { name: string }[]) {
          if (!users.some((u) => u.name === t.name)) {
            users.push({ name: t.name, type: 'teacher' as const })
          }
        }
      }
    } else {
      const [stuRes, teachRes] = await Promise.all([
        window.api.getAllStudents(),
        window.api.getTeachers(),
      ])
      if (stuRes?.ok) users.push(...stuRes.data.map((s: { name: string }) => ({ name: s.name, type: 'student' as const })))
      if (teachRes?.ok) {
        for (const t of teachRes.data as { name: string }[]) {
          if (!users.some((u) => u.name === t.name)) {
            users.push({ name: t.name, type: 'teacher' as const })
          }
        }
      }
    }

    if (appStore.currentUser && appStore.currentUser.type !== 'student') {
      const myName = appStore.currentUser.name
      const myType = appStore.currentUser.type as 'admin' | 'teacher' | 'ta'
      if (!users.some((u) => u.name === myName)) {
        users = [{ name: myName, type: myType }, ...users]
      }
    }

    allUsers.value = [{ name: 'everyone', type: 'everyone' }, ...users]
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
    if (activeRef.value === 'command') {
      return SLASH_COMMANDS.filter(c => normalize(c.name).includes(q))
    }
    if (activeRef.value === 'channel') {
      return channelList.value.filter(c => normalize(c.name).includes(q)).slice(0, 8)
    }
    if (activeRef.value === 'devoir') {
      return devoirList.value.filter(d => normalize(d.title).includes(q)).slice(0, 8)
    }
    if (activeRef.value === 'doc') {
      return docList.value.filter(d => normalize(d.name).includes(q)).slice(0, 8)
    }
    if (activeRef.value === 'emoji') {
      return searchEmojiShortcodes(refSearch.value)
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
    const matchSlash   = before.match(/^\/([^\s]*)$/i) // "/" au début de la ligne
    const matchDevoir  = before.match(/\/devoir\s?(.*)$/i)
    const matchDoc     = before.match(/\/doc\s?(.*)$/i)
    // Emoji shortcode — `:` doit etre precede d'un espace ou debut de ligne
    // pour eviter de declencher sur les URLs `https://...`. On exige au moins
    // 1 caractere apres le `:` pour ne pas polluer la saisie avec des popups
    // intempestifs (par ex. quand l'utilisateur tape un deux-points normal).
    const matchEmoji   = before.match(/(?:^|\s)(:([a-z0-9_+\-]{1,30}))$/i)

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
    } else if (matchSlash && !matchDevoir && !matchDoc) {
      // "/" seul ou "/xxx" au début → liste des commandes
      activeRef.value = 'command'
      refSearch.value = matchSlash[1]
      refStart.value  = cursor - matchSlash[0].length
      mentionActive.value = false
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
    } else if (matchEmoji) {
      activeRef.value = 'emoji'
      // matchEmoji[1] = ':xxx', matchEmoji[2] = 'xxx'
      refSearch.value = matchEmoji[2]
      refStart.value  = cursor - matchEmoji[1].length
      mentionActive.value = false
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

  function executeCommand(cmd: SlashCommand) {
    const el = inputEl.value
    if (!el) return
    const before = content.value.slice(0, refStart.value)
    const after  = content.value.slice(el.selectionStart ?? content.value.length)

    const TEMPLATES: Record<string, () => void> = {
      devoir() {
        content.value = before + '/devoir ' + after
        activeRef.value = 'devoir'; refSearch.value = ''; refStart.value = before.length
        loadDevoirs()
      },
      doc() {
        content.value = before + '/doc ' + after
        activeRef.value = 'doc'; refSearch.value = ''; refStart.value = before.length
        loadDocs()
      },
      annonce() {
        // Builder avec type / titre / message + preview si un handler est
        // branche. Sinon (tests), fallback sur l'ancien template inline.
        if (handlers.onOpenAnnounce) {
          content.value = before + after
          activeRef.value = null
          handlers.onOpenAnnounce()
        } else {
          content.value = before + '**Annonce** - ' + after
          activeRef.value = null
        }
      },
      sondage() {
        // Efface le "/sondage" et ouvre le modal de composition.
        content.value = before + after
        activeRef.value = null
        handlers.onOpenPoll?.()
      },
      tableau() {
        // Efface le "/tableau" et ouvre le builder visuel. Si aucun handler
        // n'est branche (ex. tests unitaires), fallback sur l'ancien template.
        if (handlers.onOpenTable) {
          content.value = before + after
          activeRef.value = null
          handlers.onOpenTable()
        } else {
          content.value = before + '| Colonne 1 | Colonne 2 | Colonne 3 |\n|---|---|---|\n| … | … | … |\n| … | … | … |' + after
          activeRef.value = null
        }
      },
      code() {
        // Preferable : ouvrir le builder avec selecteur de langage + preview.
        // Fallback (si aucun handler) : ancien template ```js\n\n```.
        if (handlers.onOpenCode) {
          content.value = before + after
          activeRef.value = null
          handlers.onOpenCode()
        } else {
          content.value = before + '```js\n\n```' + after
          activeRef.value = null
          nextTick(() => { const pos = before.length + 6; el.setSelectionRange(pos, pos) })
        }
      },
      checklist() {
        // Builder de liste de taches GFM (- [ ] / - [x]). Si pas de handler,
        // fallback sur 3 items vides.
        if (handlers.onOpenChecklist) {
          content.value = before + after
          activeRef.value = null
          handlers.onOpenChecklist()
        } else {
          content.value = before + '- [ ] Tâche 1\n- [ ] Tâche 2\n- [ ] Tâche 3' + after
          activeRef.value = null
        }
      },
      math() {
        // Editeur LaTeX avec preview KaTeX. Fallback : inline math vide.
        if (handlers.onOpenMath) {
          content.value = before + after
          activeRef.value = null
          handlers.onOpenMath()
        } else {
          content.value = before + '$  $' + after
          activeRef.value = null
          nextTick(() => { const pos = before.length + 2; el.setSelectionRange(pos, pos) })
        }
      },
      aide() {
        // Efface le "/aide" et ouvre la modale d'aide riche.
        content.value = before + after
        activeRef.value = null
        handlers.onOpenHelp?.()
      },
      date() {
        // Builder si un handler est branche (picker + formats + chips).
        // Sinon fallback sur insertion directe de la date du jour, format long.
        if (handlers.onOpenDate) {
          content.value = before + after
          activeRef.value = null
          handlers.onOpenDate()
        } else {
          const d = new Date()
          const formatted = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          content.value = before + formatted + after
          activeRef.value = null
        }
      },
    }

    const handler = TEMPLATES[cmd.name]
    if (handler) handler()
    else { activeRef.value = null }

    nextTick(() => { el.focus(); autoResize() })
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
    executeCommand,
    dismissAll,
  }
}
