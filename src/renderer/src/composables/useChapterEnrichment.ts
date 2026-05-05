/**
 * useChapterEnrichment : enrichissement post-render du body markdown.
 *
 * Apres rendu marked + DOMPurify, le HTML brut ne porte pas les widgets
 * interactifs (boutons Copier sur les blocs de code, ancres "#" sur les
 * headings, schemas Mermaid rendus en SVG). Ce composable injecte ces
 * widgets de maniere idempotente — on peut l'appeler plusieurs fois sans
 * dupliquer les boutons.
 *
 * Extrait de LumenChapterViewer.vue (v2.283) pour reduire la taille du
 * composant parent et permettre de tester independamment l'enrichissement.
 *
 * Charge mermaid en dynamic import : ~500KB de parse JS evites au boot tant
 * qu'aucun chapitre n'utilise de schema.
 */
import { useToast } from '@/composables/useToast'

const ICON_COPY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
const ICON_CHECK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
const ICON_CHEVRON_DOWN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
const ICON_CHEVRON_UP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'
const ICON_WRAP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 7 21 7"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="11 22 7 18 11 14"/><line x1="3" y1="17" x2="3" y2="17"/></svg>'

let mermaidInitialized = false

export interface ChapterEnrichmentArgs {
  /** Construit le permalink lumen://repo/path#section pour les heading anchors. */
  buildAnchorUrl: (headingId: string) => string
}

export function useChapterEnrichment(args: ChapterEnrichmentArgs) {
  const { showToast } = useToast()

  /**
   * Injecte la barre d'actions (Wrap, Plier, Copier) dans le header de
   * chaque .lumen-codeblock. Idempotent : skip si deja injectees.
   *
   * Pedagogique :
   * - Copier : toujours visible (tablette + clarte d'affordance en cours)
   * - Plier  : pour les blocs longs, ouvre/ferme via classe lumen-codeblock--folded
   * - Wrap   : retour a la ligne au lieu du scroll horizontal (utile en
   *            projection / videoprojecteur ou les longues lignes sortent
   *            du champ visible)
   */
  function injectCopyButtons(root: HTMLElement): void {
    const blocks = root.querySelectorAll<HTMLElement>('.lumen-codeblock')
    blocks.forEach((block) => {
      const header = block.querySelector<HTMLElement>('.lumen-codeblock-header')
      const pre = block.querySelector<HTMLElement>('pre.lumen-code')
      if (!header || !pre) return
      if (header.querySelector('.lumen-codeblock-actions')) return

      const actions = document.createElement('div')
      actions.className = 'lumen-codeblock-actions'

      // Wrap toggle (utile pour la projection en cours).
      const wrapBtn = document.createElement('button')
      wrapBtn.type = 'button'
      wrapBtn.className = 'lumen-codeblock-icon-btn lumen-wrap-btn'
      wrapBtn.title = 'Activer/desactiver le retour a la ligne'
      wrapBtn.setAttribute('aria-label', 'Retour a la ligne')
      wrapBtn.innerHTML = ICON_WRAP
      wrapBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        block.classList.toggle('lumen-codeblock--wrapped')
        wrapBtn.classList.toggle('active', block.classList.contains('lumen-codeblock--wrapped'))
      })

      // Fold toggle : intelligent — visible seulement si bloc > 10 lignes.
      const lineGutter = block.querySelector<HTMLElement>('.lumen-code-gutter')
      const lineCount = lineGutter ? lineGutter.textContent?.split('\n').length ?? 0 : 0
      let foldBtn: HTMLButtonElement | null = null
      if (lineCount > 10) {
        foldBtn = document.createElement('button')
        foldBtn.type = 'button'
        foldBtn.className = 'lumen-codeblock-icon-btn lumen-fold-btn'
        const isFolded = block.classList.contains('lumen-codeblock--folded')
        foldBtn.title = isFolded ? 'Deplier le bloc' : 'Plier le bloc'
        foldBtn.setAttribute('aria-label', 'Plier/deplier')
        foldBtn.setAttribute('aria-expanded', String(!isFolded))
        foldBtn.innerHTML = isFolded ? ICON_CHEVRON_DOWN : ICON_CHEVRON_UP
        foldBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          const folded = block.classList.toggle('lumen-codeblock--folded')
          foldBtn!.innerHTML = folded ? ICON_CHEVRON_DOWN : ICON_CHEVRON_UP
          foldBtn!.title = folded ? 'Deplier le bloc' : 'Plier le bloc'
          foldBtn!.setAttribute('aria-expanded', String(!folded))
        })
      }

      // Bouton Copier (le plus utilise — a droite, le plus visible).
      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = 'lumen-copy-btn'
      copyBtn.title = 'Copier le code'
      copyBtn.setAttribute('aria-label', 'Copier le code')
      copyBtn.innerHTML = `${ICON_COPY}<span class="lumen-copy-label">Copier</span>`
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const code = pre.querySelector('code')?.innerText ?? ''
        try {
          await navigator.clipboard.writeText(code)
          copyBtn.classList.add('copied')
          copyBtn.innerHTML = `${ICON_CHECK}<span class="lumen-copy-label">Copie</span>`
          setTimeout(() => {
            copyBtn.classList.remove('copied')
            copyBtn.innerHTML = `${ICON_COPY}<span class="lumen-copy-label">Copier</span>`
          }, 1500)
        } catch {
          showToast('Copie impossible', 'error')
        }
      })

      actions.appendChild(wrapBtn)
      if (foldBtn) actions.appendChild(foldBtn)
      actions.appendChild(copyBtn)
      header.appendChild(actions)

      // Click sur le header (zone vide) deplie un bloc plie. UX Notion :
      // un bloc plie est cliquable pour s'agrandir.
      header.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return
        if (block.classList.contains('lumen-codeblock--folded')) {
          block.classList.remove('lumen-codeblock--folded')
          if (foldBtn) {
            foldBtn.innerHTML = ICON_CHEVRON_UP
            foldBtn.title = 'Plier le bloc'
            foldBtn.setAttribute('aria-expanded', 'true')
          }
        }
      })
    })
  }

  /**
   * Bouton "#" sur chaque heading (h1-h6 avec id), copie un permalink
   * lumen://repo/path#section. Pattern GitHub README, MDN, Stripe docs.
   */
  function injectHeadingAnchors(root: HTMLElement): void {
    const headings = root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
    headings.forEach((h) => {
      if (!h.id) return
      if (h.querySelector('.lumen-heading-anchor')) return
      if (h.closest('.lumen-admonition')) return

      const a = document.createElement('button')
      a.type = 'button'
      a.className = 'lumen-heading-anchor'
      a.title = 'Copier le lien vers cette section'
      a.setAttribute('aria-label', `Copier le lien vers ${h.textContent ?? 'cette section'}`)
      a.textContent = '#'
      a.addEventListener('click', async (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        try {
          await navigator.clipboard.writeText(args.buildAnchorUrl(h.id))
          a.classList.add('copied')
          setTimeout(() => a.classList.remove('copied'), 1500)
          showToast('Lien de la section copie', 'success')
        } catch {
          showToast('Copie impossible', 'error')
        }
      })
      h.appendChild(a)
    })
  }

  /**
   * Rendu Mermaid : remplace chaque <pre class="lumen-mermaid-src"> par le
   * SVG correspondant. Mermaid est lazy-importe (~500KB), ce qui evite de
   * payer le cout pour tous les chapitres qui ne l'utilisent pas.
   * En cas d'erreur de parse Mermaid, on remplace par un bloc d'erreur
   * lisible plutot que de planter le rendu du chapitre entier.
   */
  async function renderMermaidBlocks(root: HTMLElement): Promise<void> {
    const blocks = root.querySelectorAll('pre.lumen-mermaid-src')
    if (!blocks.length) return
    try {
      const { default: mermaid } = await import('mermaid')
      if (!mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'strict',
          fontFamily: 'inherit',
        })
        mermaidInitialized = true
      }
      let i = 0
      for (const pre of Array.from(blocks)) {
        const src = (pre as HTMLElement).textContent ?? ''
        const id = `lumen-mermaid-${Date.now()}-${i++}`
        try {
          const { svg } = await mermaid.render(id, src)
          const wrapper = document.createElement('div')
          wrapper.className = 'lumen-mermaid'
          wrapper.innerHTML = svg
          pre.replaceWith(wrapper)
        } catch (err) {
          const errBox = document.createElement('div')
          errBox.className = 'lumen-mermaid-error'
          errBox.textContent = `Schema Mermaid invalide : ${(err as Error).message}`
          pre.replaceWith(errBox)
        }
      }
    } catch {
      // mermaid indisponible : on laisse les pres en place (visibles comme texte).
    }
  }

  return { injectCopyButtons, injectHeadingAnchors, renderMermaidBlocks }
}
