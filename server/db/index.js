const { initSchema }   = require('./schema');
const { seedIfEmpty, resetAndSeed } = require('./seed');
const { closeDb }      = require('./connection');

const promotions  = require('./models/promotions');
const students    = require('./models/students');
const groups      = require('./models/groups');
const messages    = require('./models/messages');
const assignments = require('./models/assignments');
const submissions = require('./models/submissions');
const documents   = require('./models/documents');
const rubrics     = require('./models/rubrics');
const teachers    = require('./models/teachers');
const admin       = require('./models/admin');
const live        = require('./models/live');
const rex         = require('./models/rex');
const kanban         = require('./models/kanban');
const teacherNotes   = require('./models/teacherNotes');
const engagement     = require('./models/engagement')
const projects       = require('./models/projects');
const lumen          = require('./models/lumen');
const cahiers        = require('./models/cahiers');
const liveUnified    = require('./models/live-unified');

// Initialisation complète : schema + migrations + seed
function init() {
  initSchema();
  seedIfEmpty();
}

module.exports = {
  init,
  close: closeDb,
  resetAndSeed,
  ...promotions,
  ...students,
  ...groups,
  ...messages,
  ...assignments,
  ...submissions,
  ...documents,
  ...rubrics,
  ...teachers,
  ...admin,
  ...live,
  ...rex,
  ...kanban,
  ...teacherNotes,
  ...engagement,
  ...projects,
  ...lumen,
  ...cahiers,
  ...liveUnified,
};
