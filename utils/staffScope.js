const prisma = require('./prismaClient');
const { ROLES } = require('./roles');

/**
 * Rôles V2 : portée d'un utilisateur sur les salles.
 * - owner   : toutes les salles
 * - manager : sa salle (`User.gymId`)
 * - coach   : ses salles (table CoachGym)
 * - member  : sa salle
 */

const GYM_REF_SELECT = { id: true, displayId: true, name: true };

/** Salles d'un coach, triées par nom : [{ id, displayId, name }] */
async function getCoachGyms(coachId) {
  const links = await prisma.coachGym.findMany({
    where: { coachId },
    include: { Gym: { select: GYM_REF_SELECT } },
    orderBy: { Gym: { name: 'asc' } }
  });
  return links.map(l => l.Gym);
}

async function getCoachGymIds(coachId) {
  const links = await prisma.coachGym.findMany({ where: { coachId }, select: { gymId: true } });
  return links.map(l => l.gymId);
}

/** true si `user` (ligne User avec role et gymId) a accès à la salle `gymId`. */
async function canAccessGym(user, gymId) {
  if (!user || !Number.isInteger(gymId)) return false;
  switch (user.role) {
    case ROLES.OWNER:
      return true;
    case ROLES.COACH:
      return (await prisma.coachGym.count({ where: { coachId: user.id, gymId } })) > 0;
    default:
      return user.gymId === gymId;
  }
}

/** Sérialisation commune du coach affecté à un membre. */
function toCoachRef(coach) {
  return coach ? { id: coach.id, firstName: coach.firstName, lastName: coach.lastName } : null;
}

const COACH_REF_SELECT = { id: true, firstName: true, lastName: true };

module.exports = {
  GYM_REF_SELECT,
  COACH_REF_SELECT,
  getCoachGyms,
  getCoachGymIds,
  canAccessGym,
  toCoachRef
};
