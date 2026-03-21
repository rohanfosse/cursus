const { getDb } = require('./connection');
const path   = require('path');
const fs     = require('fs');

// ═══════════════════════════════════════════════════════════════════════════════
// SEED — Données réelles (promotions, canaux par bloc, examens du calendrier)
// ═══════════════════════════════════════════════════════════════════════════════

function seedIfEmpty() {
  const db = getDb()
  const count = db.prepare('SELECT COUNT(*) AS n FROM promotions').get().n
  if (count > 0) return
  doSeed(db)
}

function resetAndSeed() {
  const db = getDb()
  db.transaction(() => {
    for (const t of ['depots','travail_group_members','ressources','channel_documents',
                     'messages','group_members','groups','travaux','students','channels','promotions']) {
      try { db.prepare(`DELETE FROM ${t}`).run() } catch {}
    }
    try { db.prepare("DELETE FROM sqlite_sequence").run() } catch {}
  })()
  doSeed(db)
}

function doSeed(db) {
  const ip = db.prepare('INSERT INTO promotions (name, color) VALUES (?, ?)')
  const ic = db.prepare('INSERT INTO channels (promo_id, name, description, type, category) VALUES (?, ?, ?, ?, ?)')
  const it = db.prepare('INSERT INTO travaux (promo_id, channel_id, group_id, title, description, start_date, deadline, category, type, published, requires_submission) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)')

  // ════════════════════════════════════════
  //  PROMOTION 1 — CPI A2 Informatique
  // ════════════════════════════════════════
  const p1 = ip.run('CPI A2 Informatique', '#4A90D9').lastInsertRowid

  // Canaux par défaut
  ic.run(p1, 'annonces', 'Informations importantes', 'annonce', null)
  ic.run(p1, 'general', 'Canal principal', 'chat', null)

  // Canaux par bloc de formation
  const c1_se  = ic.run(p1, 'systemes-embarques', 'Systèmes embarqués', 'chat', 'Systèmes embarqués').lastInsertRowid
  const c1_cpo = ic.run(p1, 'conception-programmation-objet', 'Conception et programmation objet', 'chat', 'Conception et programmation objet').lastInsertRowid
  const c1_rs  = ic.run(p1, 'reseaux-systeme', 'Réseaux et Système', 'chat', 'Réseaux et Système').lastInsertRowid
  const c1_dw  = ic.run(p1, 'developpement-web', 'Développement web', 'chat', 'Développement web').lastInsertRowid

  // ── Examens CPI A2 — Systèmes embarqués ──
  it.run(p1, c1_se, null, 'Architectures informatiques', '**Session Initiale**\nHoraire : 08h45 → 09h30\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-10-23T08:45:00', 'Systèmes embarqués', 'cctl', 0)
  it.run(p1, c1_se, null, 'Théorie du langage (et compilation)', '**Session Initiale**\nHoraire : 09h05 → 10h00\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-10-23T09:05:00', 'Systèmes embarqués', 'cctl', 0)
  it.run(p1, c1_se, null, 'Calculs de complexité', '**Session Initiale**\nHoraire : 08h45 → 09h30\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-06T08:45:00', 'Systèmes embarqués', 'cctl', 0)
  it.run(p1, c1_se, null, 'Représentation de l\'information et structures de données', '**Session Initiale**\nHoraire : 09h05 → 10h10\nDurée : 30 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-06T09:05:00', 'Systèmes embarqués', 'cctl', 0)
  it.run(p1, c1_se, null, 'Environnement d\'exécution', '**Session Initiale**\nHoraire : 09h35 → 10h50\nDurée : 30 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-06T09:35:00', 'Systèmes embarqués', 'cctl', 0)
  it.run(p1, c1_se, null, 'Programmation embarquée', '**Session Initiale**\nHoraire : 10h05 → 11h15\nDurée : 15 min\nFormat : Étude de cas\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-06T10:05:00', 'Systèmes embarqués', 'etude_de_cas', 0)

  // Rattrapages Systèmes embarqués
  it.run(p1, c1_se, null, 'Architectures informatiques (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 17h00\nDurée : 20 min\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-27T13:30:00', 'Systèmes embarqués', 'cctl', 0)
  it.run(p1, c1_se, null, 'Environnement d\'exécution (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 17h00\nDurée : 30 min\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-27T13:30:00', 'Systèmes embarqués', 'cctl', 0)
  it.run(p1, c1_se, null, 'Calculs de complexité (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 17h00\nDurée : 20 min\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-27T13:30:00', 'Systèmes embarqués', 'cctl', 0)
  it.run(p1, c1_se, null, 'Programmation embarquée (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 17h00\nDurée : 15 min\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-27T13:30:00', 'Systèmes embarqués', 'etude_de_cas', 0)
  it.run(p1, c1_se, null, 'Représentation de l\'information (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 17h00\nDurée : 30 min\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-27T13:30:00', 'Systèmes embarqués', 'cctl', 0)
  it.run(p1, c1_se, null, 'Théorie du langage (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 17h00\nDurée : 20 min\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-11-27T13:30:00', 'Systèmes embarqués', 'cctl', 0)

  // ── Examens CPI A2 — Conception et programmation objet ──
  it.run(p1, c1_cpo, null, 'Notions de POO', '**Session Initiale**\nHoraire : 08h45 → 09h55\nDurée : 40 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-12-11T08:45:00', 'Conception et programmation objet', 'cctl', 0)
  it.run(p1, c1_cpo, null, 'Génie logiciel', '**Session Initiale**\nHoraire : 09h25 → 10h50\nDurée : 40 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-12-11T09:25:00', 'Conception et programmation objet', 'cctl', 0)
  it.run(p1, c1_cpo, null, 'Programmation Objet', '**Session Initiale**\nHoraire : 10h05 → 11h55\nDurée : 45 min\nFormat : Étude de cas\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-12-11T10:05:00', 'Conception et programmation objet', 'etude_de_cas', 0)
  // Rattrapages CPO
  it.run(p1, c1_cpo, null, 'Génie logiciel (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 16h40\nDurée : 40 min\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-01-08T13:30:00', 'Conception et programmation objet', 'cctl', 0)
  it.run(p1, c1_cpo, null, 'Notions de POO (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 16h40\nDurée : 40 min\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-01-08T13:30:00', 'Conception et programmation objet', 'cctl', 0)
  it.run(p1, c1_cpo, null, 'Programmation Objet (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 16h40\nDurée : 45 min\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-01-08T13:30:00', 'Conception et programmation objet', 'etude_de_cas', 0)

  // ── Examens CPI A2 — Réseaux et Système ──
  it.run(p1, c1_rs, null, 'Commutation / Ethernet', '**Session Initiale**\nHoraire : 08h45 → 09h30\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-01-15T08:45:00', 'Réseaux et Système', 'cctl', 0)
  it.run(p1, c1_rs, null, 'Adressage IP / NAT', '**Session Initiale**\nHoraire : 09h05 → 10h25\nDurée : 40 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-01-15T09:05:00', 'Réseaux et Système', 'cctl', 0)
  it.run(p1, c1_rs, null, 'CCNA 1', '**Session Initiale**\nFormat : Quiz\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-02-02T23:59:00', 'Réseaux et Système', 'cctl', 0)
  it.run(p1, c1_rs, null, 'Protocoles de couches hautes (TCP, UDP, DNS)', '**Session Initiale**\nHoraire : 08h45 → 09h30\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-02-05T08:45:00', 'Réseaux et Système', 'cctl', 0)
  it.run(p1, c1_rs, null, 'Troubleshooting', '**Session Initiale**\nHoraire : 09h05 → 10h55\nDurée : 60 min\nFormat : Étude de cas\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-02-05T09:05:00', 'Réseaux et Système', 'etude_de_cas', 0)
  // Rattrapages Réseaux
  it.run(p1, c1_rs, null, 'Adressage IP / NAT (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h10\nDurée : 40 min', null, '2026-03-05T13:30:00', 'Réseaux et Système', 'cctl', 0)
  it.run(p1, c1_rs, null, 'Commutation / Ethernet (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h10\nDurée : 20 min', null, '2026-03-05T13:30:00', 'Réseaux et Système', 'cctl', 0)
  it.run(p1, c1_rs, null, 'CCNA 1 (Rattrapage)', '**Session Rattrapage**\nFormat : Quiz', null, '2026-03-05T23:59:00', 'Réseaux et Système', 'cctl', 0)
  it.run(p1, c1_rs, null, 'Protocoles couches hautes (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h40\nDurée : 20 min', null, '2026-03-12T13:30:00', 'Réseaux et Système', 'cctl', 0)
  it.run(p1, c1_rs, null, 'Troubleshooting (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h40\nDurée : 60 min', null, '2026-03-12T13:30:00', 'Réseaux et Système', 'etude_de_cas', 0)

  // ── Examens CPI A2 — Développement web ──
  it.run(p1, c1_dw, null, 'Administration Apache - HTTP', '**Session Initiale**\nHoraire : 08h45 → 09h30\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-04-02T08:45:00', 'Développement web', 'cctl', 0)
  it.run(p1, c1_dw, null, 'Backend', '**Session Initiale**\nHoraire : 09h05 → 10h00\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-04-02T09:05:00', 'Développement web', 'cctl', 0)
  it.run(p1, c1_dw, null, 'HTML / CSS et Javascript', '**Session Initiale**\nHoraire : 09h25 → 10h55\nDurée : 40 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-04-02T09:25:00', 'Développement web', 'cctl', 0)
  it.run(p1, c1_dw, null, 'Application Web', '**Session Initiale**\nHoraire : 11h05 → 11h40\nDurée : 30 min\nFormat : Étude de cas\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-04-02T11:05:00', 'Développement web', 'etude_de_cas', 0)
  // Rattrapages Dev web
  it.run(p1, c1_dw, null, 'Backend (Rattrapage)', '**Session Rattrapage**\nHoraire : 09h45 → 10h50\nDurée : 20 min', null, '2026-04-30T09:45:00', 'Développement web', 'cctl', 0)
  it.run(p1, c1_dw, null, 'Application Web (Rattrapage)', '**Session Rattrapage**\nHoraire : 10h05 → 11h35\nDurée : 30 min', null, '2026-04-30T10:05:00', 'Développement web', 'etude_de_cas', 0)
  it.run(p1, c1_dw, null, 'Administration Apache (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h10\nDurée : 20 min', null, '2026-04-30T13:30:00', 'Développement web', 'cctl', 0)
  it.run(p1, c1_dw, null, 'HTML / CSS et Javascript (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h10\nDurée : 40 min', null, '2026-04-30T13:30:00', 'Développement web', 'cctl', 0)


  // ════════════════════════════════════════
  //  PROMOTION 2 — FISA Informatique A4
  // ════════════════════════════════════════
  const p2 = ip.run('FISA Informatique A4', '#7B5EA7').lastInsertRowid

  ic.run(p2, 'annonces', 'Informations importantes', 'annonce', null)
  ic.run(p2, 'general', 'Canal principal', 'chat', null)

  const c2_bd  = ic.run(p2, 'big-data', 'Big data', 'chat', 'Big data').lastInsertRowid
  const c2_iot = ic.run(p2, 'iot', 'IoT', 'chat', 'IoT').lastInsertRowid
  const c2_ia  = ic.run(p2, 'intelligence-artificielle', 'Intelligence Artificielle', 'chat', 'Intelligence Artificielle').lastInsertRowid
  const c2_ang = ic.run(p2, 'anglais', 'Anglais - TOEIC', 'chat', 'Anglais').lastInsertRowid

  // ── FISA A4 — Big data ──
  it.run(p2, c2_bd, null, 'Architecture et infrastructure Big data', '**Session Initiale**\nHoraire : 08h45 → 09h30\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-10-30T08:45:00', 'Big data', 'cctl', 0)
  it.run(p2, c2_bd, null, 'Manipulation des données', '**Session Initiale**\nHoraire : 09h05 → 10h25\nDurée : 40 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2025-10-30T09:05:00', 'Big data', 'cctl', 0)
  it.run(p2, c2_bd, null, 'Architecture Big data (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h10\nDurée : 20 min', null, '2026-01-22T13:30:00', 'Big data', 'cctl', 0)
  it.run(p2, c2_bd, null, 'Manipulation des données (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h10\nDurée : 40 min', null, '2026-01-22T13:30:00', 'Big data', 'cctl', 0)

  // ── FISA A4 — IoT ──
  it.run(p2, c2_iot, null, 'Introduction à l\'IoT et ses enjeux', '**Session Initiale**\nHoraire : 08h45 → 09h30\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-02-12T08:45:00', 'IoT', 'cctl', 0)
  it.run(p2, c2_iot, null, 'Technologies de communication pour l\'IoT', '**Session Initiale**\nHoraire : 09h05 → 10h00\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-02-12T09:05:00', 'IoT', 'cctl', 0)
  it.run(p2, c2_iot, null, 'Protocoles de communication pour l\'IoT', '**Session Initiale**\nHoraire : 09h25 → 11h00\nDurée : 40 min\nFormat : Étude de cas\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-02-12T09:25:00', 'IoT', 'etude_de_cas', 0)
  it.run(p2, c2_iot, null, 'Introduction IoT (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h45\nDurée : 20 min', null, '2026-03-26T13:30:00', 'IoT', 'cctl', 0)
  it.run(p2, c2_iot, null, 'Protocoles IoT (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h45\nDurée : 40 min', null, '2026-03-26T13:30:00', 'IoT', 'etude_de_cas', 0)
  it.run(p2, c2_iot, null, 'Technologies IoT (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h45\nDurée : 20 min', null, '2026-03-26T13:30:00', 'IoT', 'cctl', 0)

  // ── FISA A4 — Intelligence Artificielle ──
  it.run(p2, c2_ia, null, 'I.A. - Généralités', '**Session Initiale**\nHoraire : 08h45 → 09h30\nDurée : 20 min\nFormat : Test\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-04-09T08:45:00', 'Intelligence Artificielle', 'cctl', 0)
  it.run(p2, c2_ia, null, 'I.A. - Algorithmes d\'apprentissage', '**Session Initiale**\nHoraire : 09h05 → 10h55\nDurée : 60 min\nFormat : Étude de cas\nCalculatrice autorisée\nAucune ressource autorisée', null, '2026-04-09T09:05:00', 'Intelligence Artificielle', 'etude_de_cas', 0)
  it.run(p2, c2_ia, null, 'Algorithmes d\'apprentissage (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h40\nDurée : 60 min', null, '2026-04-30T13:30:00', 'Intelligence Artificielle', 'etude_de_cas', 0)
  it.run(p2, c2_ia, null, 'I.A. Généralités (Rattrapage)', '**Session Rattrapage**\nHoraire : 13h30 → 15h40\nDurée : 20 min', null, '2026-04-30T13:30:00', 'Intelligence Artificielle', 'cctl', 0)

  // ── FISA A4 — Anglais (TOEIC) ──
  it.run(p2, c2_ang, null, 'TOEIC Blanc 1', 'Durée : 120 min\nFormat : TOEIC Blanc\nPlateforme : Global Exam\nAucune ressource autorisée', null, '2025-10-06T23:59:00', 'Anglais', 'autre', 0)
  it.run(p2, c2_ang, null, 'TOEIC Blanc 2', 'Durée : 120 min\nFormat : TOEIC Blanc\nPlateforme : Global Exam\nAucune ressource autorisée', null, '2026-01-12T23:59:00', 'Anglais', 'autre', 0)
  it.run(p2, c2_ang, null, 'TOEIC Blanc 3', 'Durée : 120 min\nFormat : TOEIC Blanc\nPlateforme : Global Exam\nAucune ressource autorisée', null, '2026-03-16T23:59:00', 'Anglais', 'autre', 0)
}

module.exports = { seedIfEmpty, resetAndSeed }
