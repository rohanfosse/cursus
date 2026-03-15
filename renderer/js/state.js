// Etat global de l'application — source de verite unique
// Proxy reactif : state.X = value declenche automatiquement les abonnes

const _data = {
  // Identite connectee
  currentUser: null,          // { id, name, avatar_initials, type: 'teacher'|'student', promo_id, promo_name }

  // Navigation
  activeChannelId:    null,   // canal de chat actif
  activeDmStudentId:  null,   // etudiant DM actif
  activePromoId:      null,   // promo du contexte courant
  activeChannelType:  'chat', // 'chat' | 'annonce'

  // Panels & modals
  rightPanel:         null,   // 'travaux' | 'profil' | null
  currentTravailId:   null,   // travail ouvert dans la modal depots/suivi
  pendingNoteDepotId: null,   // depot en attente de notation

  // Recherche
  searchActive:       false,  // barre de recherche visible

  // Non-lus (channelId -> count)
  unread:             {},
};

const _subs = {};

/** S'abonner aux changements d'une clé. Retourne une fonction de désabonnement. */
export function subscribe(key, fn) {
  (_subs[key] ??= new Set()).add(fn);
  return () => _subs[key]?.delete(fn);
}

export const state = new Proxy(_data, {
  set(target, key, value) {
    target[key] = value;
    _subs[key]?.forEach(fn => fn(value));
    return true;
  },
});
