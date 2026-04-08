<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useLumenEditor, type CursorInfo } from '@/composables/useLumenEditor'

interface Props {
  modelValue: string
  placeholder?: string
  showLineNumbers?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'cursor', info: CursorInfo): void
  (e: 'ready'): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Écris ton cours en Markdown…',
  showLineNumbers: false,
})
const emit = defineEmits<Emits>()

const editorRoot = ref<HTMLElement | null>(null)
let editor: ReturnType<typeof useLumenEditor> | null = null

// Flag pour eviter les loops de sync externe ↔ interne
let applyingExternal = false

onMounted(() => {
  if (!editorRoot.value) return
  editor = useLumenEditor({
    initial: props.modelValue,
    placeholder: props.placeholder,
    showLineNumbers: props.showLineNumbers,
    onChange: (doc) => {
      if (applyingExternal) return
      emit('update:modelValue', doc)
    },
    onCursor: (info) => emit('cursor', info),
  })
  editor.mount(editorRoot.value)
  emit('ready')
})

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})

// Sync externe → editeur (charger un autre cours)
watch(() => props.modelValue, (newVal) => {
  if (!editor) return
  if (newVal === editor.getText()) return
  applyingExternal = true
  editor.setText(newVal)
  applyingExternal = false
})

watch(() => props.showLineNumbers, (v) => editor?.setLineNumbers(!!v))

// ── API exposee via defineExpose ────────────────────────────────────────────
function wrap(prefix: string, suffix?: string, placeholder?: string) {
  editor?.wrapSelection(prefix, suffix, placeholder)
}
function prefixLine(prefix: string) { editor?.prefixLine(prefix) }
function insertBlock(block: string, selectAfter?: boolean) { editor?.insertBlock(block, selectAfter) }
function insertAtCursor(text: string) { editor?.insertAtCursor(text) }
function focus() { editor?.focus() }
function getText(): string { return editor?.getText() ?? '' }
function setText(text: string) { editor?.setText(text) }
function getScrollRatio(): number { return editor?.getScrollRatio() ?? 0 }
function setScrollRatio(ratio: number) { editor?.setScrollRatio(ratio) }
function scrollToLine(line: number) { editor?.scrollToLine(line) }

defineExpose({
  wrap, prefixLine, insertBlock, insertAtCursor,
  focus, getText, setText, getScrollRatio, setScrollRatio,
  scrollToLine,
})

const wrapperClass = computed(() => 'lumen-cm-wrapper')
</script>

<template>
  <div :class="wrapperClass" ref="editorRoot" />
</template>

<style scoped>
.lumen-cm-wrapper {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--bg-card, #fff);
}
.lumen-cm-wrapper :deep(.cm-editor) {
  height: 100%;
}
.lumen-cm-wrapper :deep(.cm-scroller) {
  overflow: auto;
}
</style>
