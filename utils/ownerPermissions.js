const prisma = require('./prismaClient');

/**
 * Permissions fines d'un owner (table Owner). Un owner sans ligne Owner
 * reçoit les valeurs par défaut du schéma Prisma (tout autorisé).
 */
const DEFAULT_OWNER_PERMISSIONS = Object.freeze({
  canManageAdmins: true,
  canManageGyms: true,
  canViewReports: true,
  maxGymsAllowed: 5
});

function toOwnerPermissions(ownerRow) {
  const permissions = ownerRow ? {
    canManageAdmins: ownerRow.canManageAdmins,
    canManageGyms: ownerRow.canManageGyms,
    canViewReports: ownerRow.canViewReports,
    maxGymsAllowed: ownerRow.maxGymsAllowed
  } : { ...DEFAULT_OWNER_PERMISSIONS };
  // Rôles V2 : alias exposé pendant la transition (même colonne en base)
  permissions.canManageManagers = permissions.canManageAdmins;
  return permissions;
}

async function getOwnerPermissions(userId) {
  const owner = await prisma.owner.findUnique({ where: { userId } });
  return toOwnerPermissions(owner);
}

/**
 * true si `user` (ligne User) est un owner disposant de `permission`.
 * Toujours false pour un manager, un coach ou un membre.
 */
async function ownerHasPermission(user, permission) {
  if (!user || user.role !== 'owner') return false;
  if (permission === 'canManageManagers') permission = 'canManageAdmins';
  const permissions = await getOwnerPermissions(user.id);
  return permissions[permission] === true;
}

/**
 * Middleware : à placer après `auth`. Exige un owner (rôle relu en base, pas
 * dans le JWT) disposant de `permission`.
 */
function requireOwnerPermission(permission) {
  return async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user?.sub } });
      if (!user || user.role !== 'owner') {
        return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
      }
      if (!(await ownerHasPermission(user, permission))) {
        return res.status(403).json({ error: `Permission requise : ${permission}` });
      }
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

module.exports = {
  DEFAULT_OWNER_PERMISSIONS,
  toOwnerPermissions,
  getOwnerPermissions,
  ownerHasPermission,
  requireOwnerPermission
};
