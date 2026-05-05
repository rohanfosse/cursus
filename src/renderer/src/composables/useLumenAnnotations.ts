/**
 * useLumenAnnotations : annotations locales d'un chapitre Lumen.
 *
 * Persistees en localStorage sous la cle `lumen-annotations-<repoId>-<path>`,
 * partagees entre le panneau d'annotations (LumenAnnotations.vue) et le menu
 * contextuel du clic droit dans le body markdown (LumenChapterViewer).
 *
 * Le composable est instancie une fois par le parent (le viewer), puis sa
 * valeur de retour est passee au panneau via props pour eviter les doubles
 * instances qui auraient leur propre etat in-memory.
 *
 * v2.285 — extrait de LumenAnnotations.vue pour reutilisation dans le menu
 * contextuel "annoter sur clic droit" (cf. demande utilisateur).
 */
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'

export type AnnotationKind = 'note' | 'correction'
export type AnnotationPriority = 'normal' | 'important'

export interface Annotation {
  id: string
  text: string
  comment: string
  createdAt: string
  /** v2.285 — type de l'annotation. 'note' = surlignage / commentaire, 'correction' = suggestion au prof. */
  kind?: AnnotationKind
  /** v2.285 — important = mise en avant orange/etoile dans le panneau. */
  priority?: AnnotationPriority
  /** v2.285 — pour les corrections : la formulation suggeree par l'etudiant. */
  suggestion?: string
}

export interface AddAnnotationOptions {
  kind?: AnnotationKind
  priority?: AnnotationPriority
  suggestion?: string
}

const STORAGE_PREFIX = 'lumen-annotations-'
const MAX_ANNOTATION_TEXT = 500

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useLumenAnnotations(repoId: Ref<number>, chapterPath: Ref<string>) {
  const annotations = ref<Annotation[]>([])
  const storageKey = computed(() => `${STORAGE_PREFIX}${repoId.value}-${chapterPath.value}`)

  function load(): void {
    try {
      const raw = localStorage.getItem(storageKey.value)
      annotations.value = raw ? JSON.parse(raw) : []
    } catch {
      annotations.value = []
    }
  }

  function persist(): void {
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(annotations.value))
    } catch {
      // quota depasse — annotations conservees in-memory tant que la page vit.
    }
  }

  function add(text: string, comment = '', options: AddAnnotationOptions = {}): Annotation | null {
    const trimmed = text.trim()
    if (!trimmed) return null
    // Truncate trop long pour eviter les selections accidentelles enormes
    // (ex: Cmd+A) qui exploserait le quota localStorage.
    const safeText = trimmed.slice(0, MAX_ANNOTATION_TEXT)
    const annotation: Annotation = {
      id: newId(),
      text: safeText,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      kind: options.kind ?? 'note',
      priority: options.priority ?? 'normal',
      ...(options.suggestion ? { suggestion: options.suggestion.trim() } : {}),
    }
    annotations.value = [...annotations.value, annotation]
    persist()
    return annotation
  }

  function remove(id: string): void {
    annotations.value = annotations.value.filter((a) => a.id !== id)
    persist()
  }

  function update(id: string, comment: string): void {
    annotations.value = annotations.value.map((a) =>
      a.id === id ? { ...a, comment: comment.trim() } : a,
    )
    persist()
  }

  watch([repoId, chapterPath], () => load(), { immediate: true })

  return { annotations, add, remove, update, load }
}

export type UseLumenAnnotationsReturn = ReturnType<typeof useLumenAnnotations>
