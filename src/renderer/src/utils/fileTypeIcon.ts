/**
 * Mapping extension → icone lucide. Utilise pour afficher une icone
 * contextuelle a cote du nom d'un fichier (depot etudiant, card document…).
 *
 * Fallback generique File si l'extension n'est pas reconnue.
 */
import {
  FileText, Image, FileSpreadsheet, FileArchive, Film, FileCode, File,
} from 'lucide-vue-next'

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']
const SPREAD_EXTS = ['xls', 'xlsx', 'csv', 'ods']
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz']
const VIDEO_EXTS = ['mp4', 'avi', 'mkv', 'mov', 'webm']
const CODE_EXTS = ['js', 'ts', 'py', 'java', 'html', 'css', 'json', 'xml', 'vue']
const DOC_EXTS = ['pdf', 'doc', 'docx', 'odt', 'txt', 'rtf', 'ppt', 'pptx']

export function fileTypeIcon(name: string): typeof FileText {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTS.includes(ext)) return Image
  if (SPREAD_EXTS.includes(ext)) return FileSpreadsheet
  if (ARCHIVE_EXTS.includes(ext)) return FileArchive
  if (VIDEO_EXTS.includes(ext)) return Film
  if (CODE_EXTS.includes(ext)) return FileCode
  if (DOC_EXTS.includes(ext)) return FileText
  return File
}
