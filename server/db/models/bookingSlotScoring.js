/**
 * Anti-gruyere : score chaque creneau libre selon sa contiguite avec
 * les RDV deja confirmes du prof. But : nudger l'etudiant vers les
 * creneaux qui *densifient* le planning, sans bloquer les autres.
 *
 * Heuristique :
 *   +5  si le creneau est ADJACENT a un RDV existant (debut ou fin colle)
 *   +2  si le creneau est dans la meme demi-journee qu'un RDV existant
 *   -3  si le creneau cree un trou de 30 min trop court pour reloger
 *   -1  si le creneau est seul dans une journee vide
 *    0  par defaut
 *
 * Score normalise dans [0..1] pour l'UI : score / 5.
 *
 * Utilisable par le frontend public-booking pour afficher un badge
 * "Recommande" sur les top 2-3 creneaux. L'etudiant garde toute liberte
 * de cliquer sur n'importe quel autre creneau (philosophie nudge).
 *
 * @param {Array<{start: string, end: string}>} freeSlots
 * @param {Array<{start_datetime: string, end_datetime: string}>} bookedSlots
 * @returns {Array<{start, end, score, normalized}>} freeSlots enrichis
 */
function scoreSlotsAntiGruyere(freeSlots, bookedSlots) {
  // Sentinels : minutes since epoch pour comparaisons rapides
  const toMin = (iso) => Math.floor(new Date(iso).getTime() / 60_000)
  const ADJACENT_THRESHOLD = 1  // <= 1 min d'ecart = adjacent
  const HALF_DAY_MIN = 4 * 60   // 4h = meme demi-journee
  const HOLE_MIN = 15 * 60      // entre 15-30 min = trou pourri
  const HOLE_MAX = 30 * 60

  const booked = bookedSlots.map(b => ({
    start: toMin(b.start_datetime || b.start),
    end:   toMin(b.end_datetime   || b.end),
  })).sort((a, b) => a.start - b.start)

  return freeSlots.map(slot => {
    const sStart = toMin(slot.start)
    const sEnd   = toMin(slot.end)
    let score = 0

    // Adjacence (+5) : un booked finit pile au debut, ou commence pile a la fin
    for (const b of booked) {
      if (Math.abs(b.end - sStart) <= ADJACENT_THRESHOLD) { score += 5; break }
      if (Math.abs(b.start - sEnd) <= ADJACENT_THRESHOLD) { score += 5; break }
    }

    // Meme demi-journee (+2) : un booked est dans une fenetre de 4h autour
    if (score < 5) {
      for (const b of booked) {
        const dist = Math.min(Math.abs(b.start - sStart), Math.abs(b.end - sEnd))
        if (dist <= HALF_DAY_MIN) { score += 2; break }
      }
    }

    // Penalite trou pourri (-3) : entre ce slot et le booked le plus proche,
    // il reste un gap de 15-30 min, trop court pour caser un autre RDV.
    for (const b of booked) {
      const gapBefore = sStart - b.end
      const gapAfter  = b.start - sEnd
      if ((gapBefore > HOLE_MIN && gapBefore < HOLE_MAX) ||
          (gapAfter  > HOLE_MIN && gapAfter  < HOLE_MAX)) {
        score -= 3
        break
      }
    }

    // Slot seul dans une journee sans aucun booked +/- 8h (-1)
    const sameDayBooked = booked.some(b =>
      Math.abs(b.start - sStart) <= 8 * 60,
    )
    if (!sameDayBooked) score -= 1

    return {
      ...slot,
      score,
      normalized: Math.max(0, Math.min(1, score / 5)),
    }
  })
}

module.exports = { scoreSlotsAntiGruyere }
