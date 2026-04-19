/**
 * Construction/destruction de l'Editor TipTap pour un cahier.
 *
 * Isole la config TipTap (extensions StarterKit + Collaboration + Placeholder)
 * pour que CahierEditor.vue reste focalise sur la presentation.
 */
import { shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import Placeholder from '@tiptap/extension-placeholder'
import type * as Y from 'yjs'
import { colorForUser } from './useCahierCollab'
import { useAppStore } from '@/stores/app'

interface Params {
  ydoc: Ref<Y.Doc | null>
  provider: Ref<{ awareness: unknown; destroy: () => void } | null>
}

export function useCahierEditor({ ydoc, provider }: Params) {
  const appStore = useAppStore()
  // shallowRef : pas de proxy profond, preserve les references internes TipTap
  const editor = shallowRef<Editor | null>(null)

  function build() {
    editor.value?.destroy()
    editor.value = null
    if (!ydoc.value) return
    const user = appStore.currentUser
    editor.value = new Editor({
      extensions: [
        StarterKit.configure({ undoRedo: false }), // undo/redo gere par Yjs history
        Placeholder.configure({ placeholder: 'Commencez a ecrire...' }),
        Collaboration.configure({ document: ydoc.value }),
        CollaborationCaret.configure({
          provider: provider.value,
          user: {
            name: user?.name ?? 'Anonyme',
            color: user ? colorForUser(user.id) : '#3b82f6',
          },
        }),
      ],
      editable: true,
    })
  }

  function destroy() {
    editor.value?.destroy()
    editor.value = null
  }

  // Rebuild quand ydoc change (nouveau cahier charge)
  watch(ydoc, (newDoc) => {
    if (newDoc) build()
    else destroy()
  })

  onBeforeUnmount(destroy)

  return { editor, build, destroy }
}
