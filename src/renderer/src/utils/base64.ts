/**
 * Helpers base64 pour le frontend.
 *
 * Usage typique : le backend renvoie du contenu binaire encode en base64
 * (PDF, DOCX, XLSX, images, videos). Selon la destination, on veut :
 *   - un Uint8Array / ArrayBuffer (parsers comme pdf.js, mammoth, exceljs)
 *   - un Blob (pour URL.createObjectURL → <img>, <video>)
 *   - un data URL (fallback quand Blob URL impossible ou API exige une string)
 *
 * Centralise pour eviter la reimplementation de l'`atob` + loop dans chaque
 * composant consommateur.
 */

export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  return base64ToUint8Array(b64).buffer as ArrayBuffer
}

export function base64ToBlob(b64: string, mimeType: string): Blob {
  return new Blob([base64ToUint8Array(b64) as BlobPart], { type: mimeType })
}

export function base64ToBlobUrl(b64: string, mimeType: string): string {
  return URL.createObjectURL(base64ToBlob(b64, mimeType))
}

export function base64ToDataUrl(b64: string, mimeType: string): string {
  return `data:${mimeType};base64,${b64}`
}

/**
 * Parse un data URL PDF `data:application/pdf;base64,...` en bytes.
 * Retourne null si le format ne correspond pas. Utile pour les APIs heritees
 * qui manipulent encore le data URL (LumenPdfViewer avant refactor).
 */
export function dataUrlToUint8Array(dataUrl: string, expectedMime = 'application/pdf'): Uint8Array | null {
  const escaped = expectedMime.replace(/[/+]/g, (m) => `\\${m}`)
  const re = new RegExp(`^data:${escaped};base64,(.+)$`)
  const m = dataUrl.match(re)
  if (!m) return null
  try {
    return base64ToUint8Array(m[1])
  } catch {
    return null
  }
}
