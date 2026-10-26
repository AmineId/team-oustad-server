/**
 * Rôles V2 : owner / manager / coach / member.
 *
 * `admin` est l'ancien nom de `manager`. Il reste accepté en entrée (anciens
 * clients, JWT émis avant la migration) mais le serveur ne renvoie jamais
 * que `manager`.
 */

const ROLES = Object.freeze({
  OWNER: 'owner',
  MANAGER: 'manager',
  COACH: 'coach',
  MEMBER: 'member',
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

const ROLE_ALIASES = Object.freeze({ admin: ROLES.MANAGER });

const CLIENTS = Object.freeze({ APP: 'app', KIOSK: 'kiosk' });

/** Rôles autorisés à se connecter au kiosk. */
const KIOSK_ROLES = Object.freeze([ROLES.OWNER, ROLES.MANAGER]);

/**
 * Normalise un rôle reçu en entrée (`admin` → `manager`). Les valeurs
 * inconnues sont renvoyées telles quelles pour que l'appelant les refuse.
 */
function normalizeRole(role) {
  if (typeof role !== 'string') return role;
  const lower = role.trim().toLowerCase();
  return ROLE_ALIASES[lower] || lower;
}

function isValidRole(role) {
  return ALL_ROLES.includes(normalizeRole(role));
}

/** Staff de salle : owner ou manager. */
function isOwnerOrManager(role) {
  const r = normalizeRole(role);
  return r === ROLES.OWNER || r === ROLES.MANAGER;
}

module.exports = {
  ROLES,
  ALL_ROLES,
  CLIENTS,
  KIOSK_ROLES,
  normalizeRole,
  isValidRole,
  isOwnerOrManager,
};
