import { describe, expect, it } from 'vitest'
import { parseLiveCsv, csvActivityToPayload } from '@/composables/useLiveCsv'

describe('parseLiveCsv - Kahoot format (fallback)', () => {
  it('parses a classic Kahoot-style CSV', () => {
    const csv = `Question;Reponse1;Reponse2;Reponse3;Reponse4;Temps;Bonne reponse
Capitale France ?;Paris;Londres;Rome;Berlin;20;1`
    const { activities, errors, format } = parseLiveCsv(csv)
    expect(format).toBe('kahoot')
    expect(errors).toHaveLength(0)
    expect(activities).toHaveLength(1)
    expect(activities[0].type).toBe('qcm')
    expect(activities[0].options).toEqual(['Paris', 'Londres', 'Rome', 'Berlin'])
    expect(activities[0].correctIndices).toEqual([0])
  })
})

describe('parseLiveCsv - Universal format', () => {
  it('detects universal format via known type in column 1', () => {
    const csv = `Type;Question;Options;Extra
sondage;Votre couleur preferee ?;Bleu|Rouge|Vert;
nuage;Un mot pour decrire la prez ?;;2
echelle;Notez la session sur 5;;5
question_ouverte;Que retenez-vous ?;;
humeur;Votre ressenti ?;;`
    const { activities, errors, format } = parseLiveCsv(csv)
    expect(format).toBe('universal')
    expect(errors).toHaveLength(0)
    expect(activities).toHaveLength(5)

    expect(activities[0].type).toBe('sondage')
    expect(activities[0].options).toEqual(['Bleu', 'Rouge', 'Vert'])

    expect(activities[1].type).toBe('nuage')
    expect(activities[1].maxWords).toBe(2)

    expect(activities[2].type).toBe('echelle')
    expect(activities[2].maxRating).toBe(5)

    expect(activities[3].type).toBe('question_ouverte')
    expect(activities[4].type).toBe('humeur')
  })

  it('accepts FR aliases with accents and spaces', () => {
    const csv = `Type;Question;Options;Extra
"Nuage de mots";Un mot pour le cours;;3
"Question ouverte";Qu'avez-vous appris ?;;
Priorité;Classez ces thèmes;Sécurité|Performance|UX;`
    const { activities, errors } = parseLiveCsv(csv)
    expect(errors).toHaveLength(0)
    expect(activities).toHaveLength(3)
    expect(activities[0].type).toBe('nuage')
    expect(activities[0].maxWords).toBe(3)
    expect(activities[1].type).toBe('question_ouverte')
    expect(activities[2].type).toBe('priorite')
    expect(activities[2].options).toEqual(['Sécurité', 'Performance', 'UX'])
  })

  it('accepts QCM with multi-correct "1,3"', () => {
    const csv = `Type;Question;Options;Extra
qcm;Lesquels sont pairs ?;2|3|4|5;"1,3"`
    const { activities, errors } = parseLiveCsv(csv)
    expect(errors).toHaveLength(0)
    expect(activities[0].type).toBe('qcm')
    expect(activities[0].correctIndices).toEqual([0, 2])
  })

  it('accepts vrai_faux', () => {
    const csv = `Type;Question;;Bonne
vrai_faux;La Terre est ronde ?;;1`
    const { activities } = parseLiveCsv(csv)
    expect(activities[0].type).toBe('vrai_faux')
    expect(activities[0].correctIndices).toEqual([0])
  })

  it('flags invalid types', () => {
    const csv = `Type;Question;Options
sondage;Valide;A|B
inconnu;Pas bon;A|B`
    const { activities, errors } = parseLiveCsv(csv)
    expect(activities).toHaveLength(1)
    expect(errors[0].message).toMatch(/inconnu/)
  })

  it('flags sondage/priorite with too few options', () => {
    const csv = `Type;Question;Options
sondage;Pas assez d'options;Seule`
    const { activities, errors } = parseLiveCsv(csv)
    expect(activities).toHaveLength(0)
    expect(errors[0].message).toMatch(/deux options/)
  })

  it('snaps echelle max_rating to 5 or 10 (default 5)', () => {
    const csv = `Type;Question;;Extra
echelle;Note 1;;7
echelle;Note 2;;10
echelle;Note 3;;`
    const { activities } = parseLiveCsv(csv)
    expect(activities[0].maxRating).toBe(5) // 7 not valid → default 5
    expect(activities[1].maxRating).toBe(10)
    expect(activities[2].maxRating).toBe(5)
  })

  it('clamps nuage max_words to 1-3', () => {
    const csv = `Type;Question;;Extra
nuage;Q1;;1
nuage;Q2;;5
nuage;Q3;;`
    const { activities } = parseLiveCsv(csv)
    expect(activities[0].maxWords).toBe(1)
    expect(activities[1].maxWords).toBe(2) // default fallback
    expect(activities[2].maxWords).toBe(2)
  })

  it('handles timer in 5th column (universal format)', () => {
    const csv = `Type;Question;Options;Extra;Temps
qcm;Q avec timer explicite;A|B|C;1;45`
    const { activities } = parseLiveCsv(csv)
    expect(activities[0].timerSeconds).toBe(45)
  })
})

describe('csvActivityToPayload', () => {
  it('serializes Pulse options as JSON strings', () => {
    const payload = csvActivityToPayload({
      type: 'sondage',
      title: 'Q',
      options: ['A', 'B', 'C'],
      timerSeconds: 30,
    })
    expect(payload.options).toBe('["A","B","C"]')
  })

  it('keeps Spark options as string array', () => {
    const payload = csvActivityToPayload({
      type: 'qcm',
      title: 'Q',
      options: ['A', 'B'],
      correctIndices: [0],
      timerSeconds: 30,
    })
    expect(payload.options).toEqual(['A', 'B'])
    expect(payload.correct_answers).toEqual([0])
  })

  it('auto-sets vrai_faux options', () => {
    const payload = csvActivityToPayload({
      type: 'vrai_faux',
      title: 'Q',
      correctIndices: [0],
      timerSeconds: 30,
    })
    expect(payload.options).toEqual(['Vrai', 'Faux'])
  })

  it('auto-sets humeur emojis', () => {
    const payload = csvActivityToPayload({
      type: 'humeur',
      title: 'Q',
      timerSeconds: 30,
    })
    expect(typeof payload.options).toBe('string')
    const parsed = JSON.parse(payload.options as string)
    expect(parsed).toHaveLength(5)
  })
})
