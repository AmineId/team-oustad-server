const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * Contexte d'audit propagé le long d'une requête ou d'une tâche planifiée :
 * qui écrit (actorId) et d'où (source). Sans contexte (seed, scripts, tests
 * qui manipulent la base directement), les écritures ne sont pas journalisées.
 */
const storage = new AsyncLocalStorage();

function sourceOf(req) {
  return `${req.method} ${(req.originalUrl || req.url).split('?')[0]}`;
}

/** Middleware global : ouvre un contexte anonyme pour chaque requête. */
function auditContextMiddleware(req, res, next) {
  storage.run({ source: sourceOf(req), actorId: null, actorRole: null }, next);
}

/**
 * Rattache l'utilisateur authentifié au contexte courant (appelé par
 * middleware/auth.js), ou ouvre le contexte s'il n'existe pas encore.
 */
function setAuditActor(req, userId, role) {
  const store = storage.getStore();
  if (store) {
    store.actorId = userId;
    store.actorRole = role;
    store.actorLabel = undefined;
  } else {
    storage.enterWith({ source: sourceOf(req), actorId: userId, actorRole: role });
  }
}

/**
 * Exécute `fn` comme le système (tâche planifiée `name`). L'`await` se fait
 * dans le contexte : une requête Prisma ne part qu'au premier `then`.
 */
function runAsSystem(name, fn) {
  const store = { source: `cron:${name}`, actorId: null, actorRole: null, actorLabel: `Système (${name})` };
  return storage.run(store, async () => await fn());
}

function getAuditContext() {
  return storage.getStore();
}

module.exports = {
  auditContextMiddleware,
  setAuditActor,
  runAsSystem,
  getAuditContext,
};
