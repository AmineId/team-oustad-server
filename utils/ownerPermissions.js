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
  if (!ownerRow) return { ...DEFAULT_OWNER_PERMISSIONS };
  return {
    canManageAdmins: ownerRow.canManageAdmins,
    canManageGyms: ownerRow.canManageGyms,
    canViewReports: ownerRow.canViewReports,
    maxGymsAllowed: ownerRow.maxGymsAllowed
  };
}

async function getOwnerPermissions(userId) {
  const owner = await prisma.owner.findUnique({ where: { userId } });
  return toOwnerPermissions(owner);
}

/**
 * true si `user` (ligne User) est un owner disposant de `permission`.
 * Toujours false pour un admin ou un membre.
 */
async function ownerHasPermission(user, permission) {
  if (!user || user.role !== 'owner') return false;
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
