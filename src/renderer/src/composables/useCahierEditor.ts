/**
 * Construction/destruction de l'Editor TipTap pour un cahier.
 *
 * Isole la config TipTap (StarterKit + Collaboration + Placeholder) pour que
 * CahierEditor.vue reste focalise sur la presentation.
 * Accepte une ref `editable` pour passer en lecture seule (cas auth perdue).
 */
import { shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import Placeholder from '@tiptap/extension-placeholder'
import type * as Y from 'yjs'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { colorForUser } from './useCahierCollab'
import { useAppStore } from '@/stores/app'

interface Params {
  ydoc: Ref<Y.Doc | null>
  provider: Ref<HocuspocusProvider | null>
  editable?: Ref<boolean>
}

export function useCahierEditor({ ydoc, provider, editable }: Params) {
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
      editable: editable?.value !== false,
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

  // Passer en read-only a la volee (ex. auth refusee mid-session)
  if (editable) {
    watch(editable, (canEdit) => {
      editor.value?.setEditable(canEdit)
    })
  }

  onBeforeUnmount(destroy)

  return { editor, build, destroy }
}
