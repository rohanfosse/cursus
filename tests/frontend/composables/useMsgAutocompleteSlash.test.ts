/**
 * Tests de la liste des commandes slash + routage executeCommand.
 *
 * On valide :
 *  - La composition de SLASH_COMMANDS apres les retraits /rappel /hr (v2.238).
 *  - Qu'une commande "builder" avec un handler declenche bien ce handler.
 *  - Qu'une commande sans handler tombe sur le fallback template (compatible
 *    tests unitaires + fallback degrade).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, nextTick } from 'vue'
import {
  useMsgAutocomplete,
  SLASH_COMMANDS,
  type SlashCommand,
} from '@/composables/useMsgAutocomplete'

function makeTextarea(value: string, selectionStart = value.length): HTMLTextAreaElement {
  return {
    value,
    selectionStart,
    selectionEnd: selectionStart,
    setSelectionRange: vi.fn(),
    focus: vi.fn(),
  } as unknown as HTMLTextAreaElement
}

function cmd(name: string): SlashCommand {
  const c = SLASH_COMMANDS.find(c => c.name === name)
  if (!c) throw new Error(`Command ${name} not found`)
  return c
}

describe('SLASH_COMMANDS composition', () => {
  it('contains the 10 expected commands (9 builders + aide)', () => {
    const names = SLASH_COMMANDS.map(c => c.name).sort()
    expect(names).toEqual([
      'aide',
      'annonce',
      'checklist',
      'code',
      'date',
      'devoir',
      'doc',
      'math',
      'sondage',
      'tableau',
    ].sort())
  })

  it('does not contain legacy /rappel and /hr (retired v2.238)', () => {
    const names = SLASH_COMMANDS.map(c => c.name)
    expect(names).not.toContain('rappel')
    expect(names).not.toContain('hr')
  })

  it('groups commands in 3 coherent categories', () => {
    const categories = new Set(SLASH_COMMANDS.map(c => c.category))
    expect(categories).toEqual(new Set(['ref', 'format', 'util']))
  })

  it('each command has a hex color, icon and description', () => {
    for (const c of SLASH_COMMANDS) {
      expect(c.color, `${c.name} color`).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(c.icon, `${c.name} icon`).toBeTruthy()
      expect(c.description, `${c.name} description`).toBeTruthy()
    }
  })
})

describe('useMsgAutocomplete executeCommand routing', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('/math : calls onOpenMath handler when branched', async () => {
    const content = ref('/math')
    const inputEl = ref(makeTextarea('/math'))
    const onOpenMath = vi.fn()
    const ac = useMsgAutocomplete(content, inputEl, vi.fn(), { onOpenMath })
    ac.executeCommand(cmd('math'))
    await nextTick()
    expect(onOpenMath).toHaveBeenCalledTimes(1)
  })

  it('/tableau : calls onOpenTable handler when branched', async () => {
    const content = ref('/tableau')
    const inputEl = ref(makeTextarea('/tableau'))
    const onOpenTable = vi.fn()
    const ac = useMsgAutocomplete(content, inputEl, vi.fn(), { onOpenTable })
    ac.executeCommand(cmd('tableau'))
    await nextTick()
    expect(onOpenTable).toHaveBeenCalledTimes(1)
  })

  it('/checklist : calls onOpenChecklist handler when branched', async () => {
    const content = ref('/checklist')
    const inputEl = ref(makeTextarea('/checklist'))
    const onOpenChecklist = vi.fn()
    const ac = useMsgAutocomplete(content, inputEl, vi.fn(), { onOpenChecklist })
    ac.executeCommand(cmd('checklist'))
    await nextTick()
    expect(onOpenChecklist).toHaveBeenCalledTimes(1)
  })

  it('/annonce : calls onOpenAnnounce handler when branched', async () => {
    const content = ref('/annonce')
    const inputEl = ref(makeTextarea('/annonce'))
    const onOpenAnnounce = vi.fn()
    const ac = useMsgAutocomplete(content, inputEl, vi.fn(), { onOpenAnnounce })
    ac.executeCommand(cmd('annonce'))
    await nextTick()
    expect(onOpenAnnounce).toHaveBeenCalledTimes(1)
  })

  it('/date : calls onOpenDate handler when branched', async () => {
    const content = ref('/date')
    const inputEl = ref(makeTextarea('/date'))
    const onOpenDate = vi.fn()
    const ac = useMsgAutocomplete(content, inputEl, vi.fn(), { onOpenDate })
    ac.executeCommand(cmd('date'))
    await nextTick()
    expect(onOpenDate).toHaveBeenCalledTimes(1)
  })

  it('/code without handler : falls back to ```js template', async () => {
    const content = ref('/code')
    const inputEl = ref(makeTextarea('/code'))
    const ac = useMsgAutocomplete(content, inputEl, vi.fn(), {})
    ac.executeCommand(cmd('code'))
    await nextTick()
    expect(content.value).toContain('```js')
  })

  it('/checklist without handler : falls back to 3 empty GFM tasks', async () => {
    const content = ref('/checklist')
    const inputEl = ref(makeTextarea('/checklist'))
    const ac = useMsgAutocomplete(content, inputEl, vi.fn(), {})
    ac.executeCommand(cmd('checklist'))
    await nextTick()
    expect(content.value).toContain('- [ ]')
  })

  it('/date without handler : falls back to today\'s long format', async () => {
    const content = ref('/date')
    const inputEl = ref(makeTextarea('/date'))
    const ac = useMsgAutocomplete(content, inputEl, vi.fn(), {})
    ac.executeCommand(cmd('date'))
    await nextTick()
    // Contains a French month name (template insert la date au format long)
    expect(content.value).toMatch(/janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre/i)
  })
})
