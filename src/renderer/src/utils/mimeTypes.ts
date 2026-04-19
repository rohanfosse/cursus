/**
 * Constants MIME + predicats de classification.
 *
 * Evite les strings magiques (`'application/pdf'`, les deux formes docx/doc)
 * dupliquees dans DocumentPreviewModal, LumenPdfViewer, preload/fileReader
 * et stores/documents.
 */

export const MIME = {
  PDF:  'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC:  'application/msword',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS:  'application/vnd.ms-excel',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  PPT:  'application/vnd.ms-powerpoint',
  PLAIN_TEXT: 'text/plain',
  MARKDOWN:   'text/markdown',
  CSV:        'text/csv',
  ICAL:       'text/calendar',
} as const

export type MimeCategory = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'word' | 'excel' | 'powerpoint' | 'other'

export function isPdf(mime: string | null | undefined): boolean {
  return mime === MIME.PDF
}

export function isImage(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/')
}

export function isVideo(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('video/')
}

export function isAudio(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('audio/')
}

export function isText(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('text/')
}

export function isWord(mime: string | null | undefined): boolean {
  return mime === MIME.DOCX || mime === MIME.DOC
}

export function isExcel(mime: string | null | undefined): boolean {
  return mime === MIME.XLSX || mime === MIME.XLS
}

export function isPowerPoint(mime: string | null | undefined): boolean {
  return mime === MIME.PPTX || mime === MIME.PPT
}

/**
 * Categorise un MIME dans un bucket pour le routage preview / icone.
 * Retourne 'other' quand aucun predicat ne matche.
 */
export function categorizeMime(mime: string | null | undefined): MimeCategory {
  if (isImage(mime)) return 'image'
  if (isPdf(mime))   return 'pdf'
  if (isVideo(mime)) return 'video'
  if (isAudio(mime)) return 'audio'
  if (isText(mime))  return 'text'
  if (isWord(mime))  return 'word'
  if (isExcel(mime)) return 'excel'
  if (isPowerPoint(mime)) return 'powerpoint'
  return 'other'
}
