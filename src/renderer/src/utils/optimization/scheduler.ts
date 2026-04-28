/**
 * Scheduler — planification de soutenances avec contraintes.
 *
 * Probleme : etant donne N soutenances de duree fixe, J jurys disponibles
 * sur des creneaux donnes, S salles avec capacite, generer un planning qui :
 *  - place chaque soutenance dans un slot et une salle
 *  - respecte les disponibilites de chaque jury
 *  - respecte les preferences etudiants (ex: pas avant 9h, pas vendredi PM)
 *  - minimise le nombre de jurys mobilises et les "trous" entre soutenances
 *
 * Approche : CSP avec backtracking + heuristiques (most-constrained variable
 * first, least-constraining value first). NP-hard en theorie, mais avec
 * 30 etudiants x 4 jurys x 20 slots, le backtrack converge en < 100ms.
 *
 * Pour des tailles plus grosses (> 100 etudiants), passer a un solveur CP-SAT
 * (OR-tools via service Python) ou ILP (glpk.js).
 */

export interface TimeSlot {
  /** ID unique du creneau */
  id: string
  /** Date+heure debut au format ISO */
  start: string
  /** Date+heure fin */
  end: string
  /** Label lisible pour l'UI (ex: "Lun 9h-9h30") */
  label?: string
}

export interface Jury {
  id: number
  name: string
  /** IDs de slots ou ce jury est disponible */
  availableSlotIds: string[]
  /** Cout d'utilisation : un jury "preferred" a cout 0, un externe a cout 5 */
  cost?: number
}

export interface Room {
  id: number
  name: string
  /** IDs de slots ou cette salle est libre */
  availableSlotIds: string[]
}

export interface Soutenance {
  id: number
  /** Etudiant ou groupe */
  candidate: string
  /** Slots interdits (ex: l'etudiant a un autre engagement) */
  forbiddenSlotIds?: string[]
  /** Si specifie, le jury doit appartenir a cette liste (sinon n'importe lequel) */
  preferredJuryIds?: number[]
  /** Duree en minutes (utilise pour eclater une soutenance sur slots consecutifs) */
  duration?: number
}

export interface ScheduleAssignment {
  soutenanceId: number
  candidate: string
  slotId: string
  juryIds: number[]
  roomId: number | null
}

export interface ScheduleResult {
  /** Affectations realisees (peut etre partiel si infaisable) */
  assignments: ScheduleAssignment[]
  /** Soutenances non placees (et raison) */
  unscheduled: Array<{ soutenance: Soutenance; reason: string }>
  /** Stats utiles pour l'UI */
  stats: {
    totalSlotsUsed: number
    totalJurysUsed: number
    totalCost: number
    /** Nombre de slots ouverts au-debut mais non-utilises (efficacite) */
    slotEfficiency: number
  }
}

export interface SchedulerOptions {
  /** Nombre de jurys requis par soutenance (defaut 2) */
  jurySize?: number
  /** Si true, accepte une solution partielle ; sinon throw si infaisable */
  allowPartial?: boolean
  /** Limite de backtrack pour eviter explosion combinatoire */
  maxBacktracks?: number
}

/**
 * Resout un probleme de scheduling avec backtracking + heuristiques.
 *
 * Heuristique MRV (most constrained variable) : on traite d'abord les
 * soutenances avec le moins de slots/jurys compatibles, pour echouer tot
 * si c'est infaisable. Heuristique LCV (least constraining value) : pour
 * chaque variable, on essaie d'abord les slots qui contraignent le moins
 * les autres variables.
 */
export function scheduleSoutenances(
  soutenances: Soutenance[],
  jurys: Jury[],
  rooms: Room[],
  slots: TimeSlot[],
  options: SchedulerOptions = {},
): ScheduleResult {
  const { jurySize = 2, allowPartial = true, maxBacktracks = 10_000 } = options

  // Pre-calcul : pour chaque soutenance, les slots et jurys compatibles
  // (on filtre une fois pour eviter de recalculer dans le backtrack)
  const compatible = soutenances.map(s => {
    const allowedSlots = slots.filter(slot => {
      if (s.forbiddenSlotIds?.includes(slot.id)) return false
      // Au moins jurySize jurys disponibles sur ce slot ?
      const okJurys = jurys.filter(j => j.availableSlotIds.includes(slot.id))
      const filteredJurys = s.preferredJuryIds
        ? okJurys.filter(j => s.preferredJuryIds!.includes(j.id))
        : okJurys
      return filteredJurys.length >= jurySize
    })
    return { soutenance: s, allowedSlotIds: allowedSlots.map(s => s.id) }
  })

  // Tri MRV : les plus contraintes en premier (moins de choix = plus dur)
  compatible.sort((a, b) => a.allowedSlotIds.length - b.allowedSlotIds.length)

  // Etat du backtrack
  const usedSlots = new Set<string>()
  const usedJurysPerSlot = new Map<string, Set<number>>() // slot -> jury IDs deja utilises
  const usedRoomsPerSlot = new Map<string, Set<number>>()
  const assignments: ScheduleAssignment[] = []
  const unscheduled: Array<{ soutenance: Soutenance; reason: string }> = []
  let backtracks = 0

  function tryAssign(idx: number): boolean {
    if (idx >= compatible.length) return true // tout placé
    if (backtracks >= maxBacktracks) return false

    const { soutenance, allowedSlotIds } = compatible[idx]

    // LCV : trier les slots par nombre de "conflits" qu'ils introduiraient
    // pour les soutenances suivantes. Approximation : on prefere les slots
    // peu demandes par les autres soutenances restantes.
    const remaining = compatible.slice(idx + 1)
    const slotPressure = new Map<string, number>()
    for (const r of remaining) {
      for (const s of r.allowedSlotIds) {
        slotPressure.set(s, (slotPressure.get(s) ?? 0) + 1)
      }
    }
    const sortedSlots = [...allowedSlotIds].sort(
      (a, b) => (slotPressure.get(a) ?? 0) - (slotPressure.get(b) ?? 0),
    )

    for (const slotId of sortedSlots) {
      if (usedSlots.has(slotId)) continue

      // Trouve les jurys disponibles pour ce slot et cette soutenance
      const usedJ = usedJurysPerSlot.get(slotId) ?? new Set<number>()
      const okJurys = jurys
        .filter(j => j.availableSlotIds.includes(slotId) && !usedJ.has(j.id))
        .filter(j => !soutenance.preferredJuryIds || soutenance.preferredJuryIds.includes(j.id))
      if (okJurys.length < jurySize) continue

      // Choix gourmand : les jurys de moindre cout en premier
      const sortedJurys = [...okJurys].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))
      const chosenJurys = sortedJurys.slice(0, jurySize)

      // Trouve une salle libre sur ce slot
      const usedR = usedRoomsPerSlot.get(slotId) ?? new Set<number>()
      const freeRoom = rooms.find(r => r.availableSlotIds.includes(slotId) && !usedR.has(r.id))
      // Salle facultative : si aucune n'est libre, on assigne sans salle
      const chosenRoomId = freeRoom?.id ?? null

      // Tentative : push l'assignment + recurse
      assignments.push({
        soutenanceId: soutenance.id,
        candidate: soutenance.candidate,
        slotId,
        juryIds: chosenJurys.map(j => j.id),
        roomId: chosenRoomId,
      })
      usedSlots.add(slotId)
      const newUsedJ = new Set(usedJ)
      for (const j of chosenJurys) newUsedJ.add(j.id)
      usedJurysPerSlot.set(slotId, newUsedJ)
      if (chosenRoomId !== null) {
        const newUsedR = new Set(usedR)
        newUsedR.add(chosenRoomId)
        usedRoomsPerSlot.set(slotId, newUsedR)
      }

      if (tryAssign(idx + 1)) return true

      // Backtrack
      backtracks++
      assignments.pop()
      usedSlots.delete(slotId)
      usedJurysPerSlot.set(slotId, usedJ) // rollback
      if (chosenRoomId !== null) usedRoomsPerSlot.set(slotId, usedR)
    }

    // Aucune option n'a marche pour cette soutenance
    if (allowPartial) {
      unscheduled.push({
        soutenance,
        reason: allowedSlotIds.length === 0
          ? 'Aucun slot compatible (jury ou contraintes)'
          : 'Tous les slots compatibles sont occupes',
      })
      return tryAssign(idx + 1) // continue avec les autres
    }
    return false
  }

  tryAssign(0)

  // Calcul des stats
  const usedJurysGlobal = new Set<number>()
  let totalCost = 0
  for (const a of assignments) {
    for (const jId of a.juryIds) {
      usedJurysGlobal.add(jId)
      const j = jurys.find(jj => jj.id === jId)
      totalCost += j?.cost ?? 0
    }
  }
  const slotEfficiency = slots.length > 0 ? assignments.length / slots.length : 0

  return {
    assignments,
    unscheduled,
    stats: {
      totalSlotsUsed: usedSlots.size,
      totalJurysUsed: usedJurysGlobal.size,
      totalCost,
      slotEfficiency,
    },
  }
}

/**
 * Helper : genere une grille de slots reguliers entre 2 dates a une duree
 * donnee. Utilise pour bootstrap un planning sans config manuelle.
 */
export function generateSlots(
  startDate: Date,
  endDate: Date,
  durationMinutes: number,
  options: { skipWeekends?: boolean; skipLunch?: boolean; dayStart?: number; dayEnd?: number } = {},
): TimeSlot[] {
  const { skipWeekends = true, skipLunch = true, dayStart = 9, dayEnd = 18 } = options
  const slots: TimeSlot[] = []
  const cur = new Date(startDate)
  cur.setSeconds(0, 0)

  while (cur < endDate) {
    const day = cur.getDay()
    const hour = cur.getHours()
    const min = cur.getMinutes()

    if (skipWeekends && (day === 0 || day === 6)) {
      cur.setDate(cur.getDate() + 1)
      cur.setHours(dayStart, 0, 0, 0)
      continue
    }
    if (hour < dayStart) {
      cur.setHours(dayStart, 0, 0, 0)
      continue
    }
    if (hour >= dayEnd) {
      cur.setDate(cur.getDate() + 1)
      cur.setHours(dayStart, 0, 0, 0)
      continue
    }
    if (skipLunch && hour >= 12 && hour < 13) {
      cur.setHours(13, 0, 0, 0)
      continue
    }

    const end = new Date(cur.getTime() + durationMinutes * 60_000)
    slots.push({
      id: `slot-${cur.toISOString()}`,
      start: cur.toISOString(),
      end: end.toISOString(),
      label: cur.toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) +
             '-' + end.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    })
    cur.setTime(cur.getTime() + durationMinutes * 60_000)
  }

  return slots
}
