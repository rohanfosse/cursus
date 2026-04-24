/**
 * useFormDraft - Auto-save d'un objet de formulaire dans localStorage.
 *
 * Cas d'usage : un prof redige une longue consigne dans NewDevoirModal,
 * ferme accidentellement l'onglet ou l'app crashe → contenu perdu.
 * Avec ce composable, l'etat est sauvegarde a chaque frappe (debounce 500ms)
 * et restaure a l'ouverture suivante. Appelez `clear()` apres submit pour
 * eviter que l'ancien brouillon remonte a la prochaine creation.
 *
 * Usage :
 *   const draft = useFormDraft('draft_new_devoir', { title, description })
 *   // en submit :
 *   draft.clear()
 */
import { ref, watch, onUnmounted, getCurrentInstance, type Ref } from 'vue'
import { safeGet, safeSet, safeRemove } from '@/utils/safeStorage'

type Primitive = string | number | boolean | null

const DEBOUNCE_MS = 500
const SAVED_INDICATOR_MS = 1500

/**
 * Restaure le brouillon s'il existe, puis auto-save a chaque mutation des refs.
 * @param key cle localStorage stable pour ce formulaire (ex: `draft_new_devoir_${promoId}`).
 *            Passez `null` pour desactiver (ex: modal ferme, promo absente).
 * @param fields map nom → Ref<primitive> a serialiser.
 */
export function useFormDraft<T extends Record<string, Ref<Primitive>>>(
  key: string | null,
  fields: T,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let savedTimer: ReturnType<typeof setTimeout> | null = null
  let lastSerialized = ''
  const justSaved = ref(false)

  function snapshot(): Record<string, Primitive> {
    const out: Record<string, Primitive> = {}
    for (const [name, ref] of Object.entries(fields)) out[name] = ref.value
    return out
  }

  function hasContent(snap: Record<string, Primitive>): boolean {
    return Object.values(snap).some((v) => typeof v === 'string' && v.trim().length > 0)
  }

  function save(): void {
    if (timer) { clearTimeout(timer); timer = null }
    if (!key) return
    const snap = snapshot()
    if (!hasContent(snap)) { safeRemove(key); lastSerialized = ''; return }
    const serialized = JSON.stringify(snap)
    if (serialized === lastSerialized) return
    safeSet(key, serialized)
    lastSerialized = serialized
    justSaved.value = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => { justSaved.value = false }, SAVED_INDICATOR_MS)
  }

  function clear(): void {
    if (timer) { clearTimeout(timer); timer = null }
    if (key) safeRemove(key)
    lastSerialized = ''
  }

  function restore(): void {
    if (!key) return
    const raw = safeGet(key)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, Primitive>
      for (const [name, ref] of Object.entries(fields)) {
        if (name in parsed) {
          const val = parsed[name]
          if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) {
            ref.value = val
          }
        }
      }
      lastSerialized = raw
    } catch { /* brouillon corrompu : on ignore */ }
  }

  // Watch les refs directement (array) plutot que { deep: true } sur un
  // snapshot reconstruit — evite un rebuild d'objet a chaque frappe.
  const refsToWatch = Object.values(fields)
  const stopWatch = watch(refsToWatch, () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; save() }, DEBOUNCE_MS)
  })

  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (timer) { clearTimeout(timer); timer = null; save() }
      if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
      stopWatch()
    })
  }

  return { save, clear, restore, justSaved }
}
