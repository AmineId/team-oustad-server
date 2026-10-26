const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const prisma = require('../utils/prismaClient');
const { generateUserId } = require('../utils/idGenerator');
const { getFullName } = require('../utils/nameUtils');
const { sendPasswordResetNotification } = require('./notificationService');
const { GYM_REF_SELECT, COACH_REF_SELECT, getCoachGyms, toCoachRef } = require('../utils/staffScope');

/**
 * Rôles V2 : coachs (création par l'owner, salles N-N, affectation aux membres).
 * Les fonctions lèvent une CoachError portant le statut HTTP et un code stable.
 */
class CoachError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

/** Valide un tableau d'IDs de salles : entiers, uniques, non vide, salles existantes. */
async function validateGymIds(gymIds) {
  if (!Array.isArray(gymIds) || gymIds.length === 0) {
    throw new CoachError(400, 'gym_ids_required', 'gymIds doit être un tableau non vide');
  }
  const ids = [...new Set(gymIds.map(Number))];
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new CoachError(400, 'invalid_gym_ids', 'gymIds doit contenir des entiers');
  }
  const found = await prisma.gym.count({ where: { id: { in: ids } } });
  if (found !== ids.length) {
    throw new CoachError(404, 'gym_not_found', 'Une ou plusieurs salles sont introuvables');
  }
  return ids;
}

/** Forme commune d'un coach dans les réponses. */
function toCoachResponse(user, gyms, extra = {}) {
  return {
    id: user.id,
    displayId: user.displayId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    role: 'coach',
    gymId: user.gymId,
    gyms,
    ...extra
  };
}

async function createCoach({ email, password, firstName, lastName, phoneNumber, gymIds, sendSetupEmail = true }) {
  if (!email || !firstName || !lastName) {
    throw new CoachError(400, 'missing_fields', 'email, firstName, lastName et gymIds requis');
  }
  const ids = await validateGymIds(gymIds);

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) throw new CoachError(400, 'email_taken', 'Cet email est déjà utilisé');
  if (phoneNumber) {
    const existingPhone = await prisma.user.findUnique({ where: { phoneNumber } });
    if (existingPhone) throw new CoachError(400, 'phone_taken', 'Ce numéro de téléphone est déjà utilisé');
  }

  // Sans mot de passe : mot de passe aléatoire + email d'activation, comme pour les managers
  const shouldSendSetupEmail = !password && sendSetupEmail !== false;
  const hashedPassword = await bcrypt.hash(password || crypto.randomBytes(32).toString('hex'), 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      ...(phoneNumber && { phoneNumber }),
      role: 'coach',
      // Salle principale : la première de la liste (User.gymId est obligatoire)
      gymId: ids[0],
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      displayId: generateUserId(),
      Coach: {
        create: { CoachGym: { create: ids.map(gymId => ({ gymId })) } }
      }
    },
    include: { Gym: true }
  });

  try {
    const qrCode = await QRCode.toBuffer(JSON.stringify({
      userId: user.id,
      uniqueCode: user.uniqueCode,
      fullName: getFullName(user),
      role: 'coach',
      gymName: user.Gym.name,
      accessType: 'gym_access',
      generatedAt: new Date().toISOString()
    }), { type: 'png', width: 300, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } });
    await prisma.user.update({ where: { id: user.id }, data: { qrCode } });
  } catch (qrError) {
    console.error(`⚠️ Erreur génération QR code pour coach ${getFullName(user)}:`, qrError);
  }

  if (shouldSendSetupEmail) {
    try {
      const setupToken = crypto.randomInt(100000, 999999).toString();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: setupToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      await sendPasswordResetNotification(user, setupToken, true);
    } catch (emailError) {
      console.error('⚠️ Erreur envoi notification d\'activation coach:', emailError);
    }
  }

  return { coach: toCoachResponse(user, await getCoachGyms(user.id)), setupEmailSent: shouldSendSetupEmail };
}

async function getCoachUser(coachId) {
  const user = await prisma.user.findUnique({ where: { id: coachId } });
  if (!user || user.role !== 'coach') throw new CoachError(404, 'coach_not_found', 'Coach introuvable');
  return user;
}

/**
 * Remplace les salles d'un coach. Les membres des salles retirées qui lui
 * étaient affectés repassent sans coach.
 */
async function setCoachGyms(coachId, gymIds) {
  const user = await getCoachUser(coachId);
  const ids = await validateGymIds(gymIds);

  const unassigned = await prisma.$transaction(async (tx) => {
    await tx.coachGym.deleteMany({ where: { coachId, gymId: { notIn: ids } } });
    await tx.coachGym.createMany({
      data: ids.map(gymId => ({ coachId, gymId })),
      skipDuplicates: true
    });
    const { count } = await tx.member.updateMany({
      where: { coachId, User: { gymId: { notIn: ids } } },
      data: { coachId: null }
    });
    // La salle principale doit rester une salle du coach
    if (!ids.includes(user.gymId)) {
      await tx.user.update({ where: { id: coachId }, data: { gymId: ids[0] } });
    }
    return count;
  });

  return { id: coachId, gymIds: ids, gyms: await getCoachGyms(coachId), unassignedMembers: unassigned };
}

/** Coachs, éventuellement filtrés sur une salle, avec leur nombre de membres affectés. */
async function listCoaches({ gymId } = {}) {
  const coaches = await prisma.user.findMany({
    where: {
      role: 'coach',
      ...(gymId !== undefined && { Coach: { CoachGym: { some: { gymId } } } })
    },
    include: {
      Coach: { include: { CoachGym: { include: { Gym: { select: GYM_REF_SELECT } } } } },
      _count: { select: { CoachedMembers: true } }
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });

  return coaches.map(c => toCoachResponse(
    c,
    (c.Coach?.CoachGym || []).map(l => l.Gym).sort((a, b) => a.name.localeCompare(b.name)),
    { membersCount: c._count.CoachedMembers }
  ));
}

/** Membres affectés à un coach (toutes ses salles). */
async function getCoachMembers(coachId) {
  const members = await prisma.user.findMany({
    where: { role: 'member', Member: { coachId } },
    include: {
      Gym: { select: GYM_REF_SELECT },
      Member: {
        include: {
          Coach: { select: COACH_REF_SELECT },
          Subscription: { where: { status: 'active' }, take: 1 }
        }
      }
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });

  return members.map(u => {
    const sub = u.Member?.Subscription?.[0];
    return {
      id: u.id,
      displayId: u.displayId,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phoneNumber: u.phoneNumber,
      gymId: u.gymId,
      gym: u.Gym,
      fitnessLevel: u.Member?.fitnessLevel ?? null,
      coachId: u.Member?.coachId ?? null,
      coach: toCoachRef(u.Member?.Coach),
      activeSubscription: sub ? {
        id: sub.id,
        status: sub.status,
        startDate: sub.startDate,
        endDate: sub.endDate,
        sessionQuota: sub.sessionQuota,
        sessionsUsed: sub.sessionsUsed
      } : null
    };
  });
}

/**
 * Affecte (ou retire avec null) le coach principal d'un membre. Le coach doit
 * être rattaché à la salle du membre.
 */
async function assignCoach(memberId, coachId) {
  const member = await prisma.user.findUnique({ where: { id: memberId }, include: { Member: true } });
  if (!member || member.role !== 'member' || !member.Member) {
    throw new CoachError(404, 'member_not_found', 'Membre introuvable');
  }

  let coach = null;
  if (coachId !== null) {
    coach = await getCoachUser(coachId);
    const linked = await prisma.coachGym.count({ where: { coachId, gymId: member.gymId } });
    if (!linked) {
      throw new CoachError(400, 'coach_not_in_gym', 'Le coach n\'est pas rattaché à la salle du membre');
    }
  }

  await prisma.member.update({ where: { userId: memberId }, data: { coachId } });
  return { memberId, coachId, coach: toCoachRef(coach) };
}

module.exports = {
  CoachError,
  createCoach,
  setCoachGyms,
  listCoaches,
  getCoachMembers,
  assignCoach
};
