import type { Ref } from 'vue'

/**
 * Inline formatting toolbar: bold, italic, code, block, strikethrough, quote, lists.
 */
export function useMsgFormatting(
  content: Ref<string>,
  inputEl: Ref<HTMLTextAreaElement | null>,
  autoResize: () => void,
) {
  function fmtWrap(pre: string, post: string) {
    const el = inputEl.value
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const sel   = el.value.slice(start, end) || 'texte'
    el.value = el.value.slice(0, start) + pre + sel + post + el.value.slice(end)
    content.value = el.value
    el.focus()
    el.selectionStart = start + pre.length
    el.selectionEnd   = start + pre.length + sel.length
    autoResize()
  }

  function fmtLinePrefix(prefix: string) {
    const el = inputEl.value
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const lines = el.value.slice(start, end || start)

    if (start === end) {
      const lineStart = el.value.lastIndexOf('\n', start - 1) + 1
      el.value = el.value.slice(0, lineStart) + prefix + el.value.slice(lineStart)
      content.value = el.value
      el.focus()
      el.selectionStart = el.selectionEnd = start + prefix.length
    } else {
      const prefixed = lines.split('\n').map(l => prefix + l).join('\n')
      el.value = el.value.slice(0, start) + prefixed + el.value.slice(end)
      content.value = el.value
      el.focus()
      el.selectionStart = start
      el.selectionEnd = start + prefixed.length
    }
    autoResize()
  }

  function fmtInsertBlock() {
    const el = inputEl.value
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const sel   = el.value.slice(start, end) || 'code'
    const block = '```\n' + sel + '\n```'
    el.value = el.value.slice(0, start) + block + el.value.slice(end)
    content.value = el.value
    el.focus()
    el.selectionStart = start + 4
    el.selectionEnd   = start + 4 + sel.length
    autoResize()
  }

  return {
    fmtWrap,
    fmtLinePrefix,
    fmtInsertBlock,
  }
}
