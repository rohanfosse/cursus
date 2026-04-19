/**
 * Mapping Document -> icone / couleur / label.
 *
 * Centralise toute la logique "quel visuel pour ce document" qui etait
 * auparavant eclatee entre useDocumentsData (types + colors + labels + mapping)
 * et DocumentsView.vue (composant Lucide associe). Une seule source de verite.
 *
 * API publique :
 *   - DocIconType       : union des types reconnus
 *   - docIconType(doc)  : classifie un document
 *   - iconColor(type)   : couleur hex
 *   - iconLabel(type)   : libelle FR
 *   - iconComponent(t)  : composant Lucide
 *   - getDocumentIcon(doc) : { type, color, label, component } en un appel
 *   - TYPE_FILTERS      : liste pour les tabs de filtre
 */
import type { Component } from 'vue'
import {
  BookOpen, ClipboardList, File, FileSpreadsheet, FileText, Github,
  Globe, Image, Link2, Linkedin, Package, Video,
} from 'lucide-vue-next'
import type { AppDocument } from '@/types'

export type DocIconType =
  | 'image' | 'pdf' | 'video' | 'link' | 'file' | 'spreadsheet'
  | 'moodle' | 'github' | 'linkedin' | 'web' | 'package' | 'grille'
  | 'note-peda' | 'fiche-validation'

const COLORS: Record<DocIconType, string> = {
  pdf:         '#E74C3C',
  image:       '#3498DB',
  video:       '#9B59B6',
  link:        '#27AE60',
  file:        '#4A90D9',
  spreadsheet: '#059669',
  moodle:      '#f59e0b',
  github:      '#6e7681',
  linkedin:    '#0a66c2',
  web:         '#22c55e',
  package:     '#8b5cf6',
  grille:              '#ef4444',
  'note-peda':         '#06b6d4',
  'fiche-validation':  '#10b981',
}

const LABELS: Record<DocIconType, string> = {
  pdf:         'PDF',
  image:       'Image',
  video:       'Vidéo',
  link:        'Lien',
  file:        'Fichier',
  spreadsheet: 'Tableur',
  moodle:      'Moodle',
  github:      'GitHub',
  linkedin:    'LinkedIn',
  web:         'Site Web',
  package:     'Package',
  grille:              'Grille',
  'note-peda':         'Note Péda',
  'fiche-validation':  'Fiche de validation',
}

const COMPONENTS: Record<DocIconType, Component> = {
  image:       Image,
  pdf:         FileText,
  video:       Video,
  link:        Link2,
  file:        File,
  spreadsheet: FileSpreadsheet,
  moodle:      BookOpen,
  github:      Github,
  linkedin:    Linkedin,
  web:         Globe,
  package:     Package,
  grille:              ClipboardList,
  'note-peda':         FileText,
  'fiche-validation':  FileText,
}

/**
 * Mapping libelle categorie FR -> type d'icone (pour les liens categorises).
 * Garde les cles en FR puisque c'est ce que l'utilisateur saisit dans le form.
 */
const CATEGORY_TO_TYPE: Record<string, DocIconType> = {
  'Moodle':   'moodle',
  'GitHub':   'github',
  'LinkedIn': 'linkedin',
  'Site Web': 'web',
  'Package':  'package',
  'Grille':              'grille',
  'Note Péda':           'note-peda',
  'Fiche de validation': 'fiche-validation',
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp']
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm']
const SPREADSHEET_EXTENSIONS = ['xlsx', 'xls', 'csv', 'ods']

export function docIconType(doc: AppDocument): DocIconType {
  if (doc.type === 'link') {
    if (doc.category && CATEGORY_TO_TYPE[doc.category]) return CATEGORY_TO_TYPE[doc.category]
    return 'link'
  }
  const ext = doc.content?.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  if (SPREADSHEET_EXTENSIONS.includes(ext)) return 'spreadsheet'
  return 'file'
}

export function iconColor(type: DocIconType): string {
  return COLORS[type]
}

export function iconLabel(type: DocIconType): string {
  return LABELS[type]
}

export function iconComponent(type: DocIconType): Component {
  return COMPONENTS[type]
}

/**
 * One-shot helper : resout tout en un seul appel, optimise pour les v-for
 * ou le DocumentCard qui a besoin des 4 proprietes simultanement.
 */
export function getDocumentIcon(doc: AppDocument) {
  const type = docIconType(doc)
  return {
    type,
    color:     COLORS[type],
    label:     LABELS[type],
    component: COMPONENTS[type],
  }
}

/** Tabs de filtre par type sur la vue Documents. */
export const TYPE_FILTERS: { id: DocIconType | null; label: string }[] = [
  { id: null,          label: 'Tous' },
  { id: 'pdf',         label: 'PDF' },
  { id: 'image',       label: 'Images' },
  { id: 'video',       label: 'Vidéos' },
  { id: 'link',        label: 'Liens' },
  { id: 'spreadsheet', label: 'Tableurs' },
  { id: 'file',        label: 'Autres' },
]
