const { initSchema }   = require('./schema');
const { seedIfEmpty, resetAndSeed } = require('./seed');

const promotions  = require('./models/promotions');
const students    = require('./models/students');
const groups      = require('./models/groups');
const messages    = require('./models/messages');
const assignments = require('./models/assignments');
const submissions = require('./models/submissions');
const documents   = require('./models/documents');

// Initialisation complète : schema + migrations + seed
function init() {
  initSchema();
  seedIfEmpty();
}

module.exports = {
  init,
  resetAndSeed,
  ...promotions,
  ...students,
  ...groups,
  ...messages,
  ...assignments,
  ...submissions,
  ...documents,
};
