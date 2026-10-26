const crypto = require('crypto');
const prisma = require('../utils/prismaClient');
const { COACH_REF_SELECT, toCoachRef } = require('../utils/staffScope');

/**
 * Rôles V2 : programmes réutilisables (owner) et affectations aux membres.
 * Les fonctions lèvent une ProgramError portant le statut HTTP et un code stable.
 */
class ProgramError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const ASSIGNMENT_STATUSES = ['active', 'completed', 'cancelled'];

const generateProgramId = () => `PROGRAM-${crypto.randomBytes(8).toString('hex')}`;
const generateAssignmentId = () => `ASSIGN-${crypto.randomBytes(8).toString('hex')}`;

const EXERCISE_SELECT = {
  id: true,
  displayId: true,
  name: true,
  description: true,
  category: true,
  muscleGroup: true,
  equipment: true,
  difficulty: true,
  instructions: true
};

const PROGRAM_INCLUDE = {
  Creator: { select: COACH_REF_SELECT },
  ProgramDay: {
    orderBy: { dayOfWeek: 'asc' },
    include: {
      ProgramExercise: {
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        include: { Exercise: { select: EXERCISE_SELECT } }
      }
    }
  },
  _count: { select: { ProgramAssignment: { where: { status: 'active' } } } }
};

// ==================== Sérialisation ====================

function toProgramExercise(pe) {
  return {
    id: pe.id,
    exerciseId: pe.exerciseId,
    exercise: pe.Exercise,
    sets: pe.sets,
    reps: pe.reps,
    duration: pe.duration,
    weight: pe.weight,
    restTime: pe.restTime,
    notes: pe.notes,
    order: pe.order
  };
}

function toProgram(program) {
  return {
    id: program.id,
    displayId: program.displayId,
    title: program.title,
    description: program.description,
    level: program.level,
    durationWeeks: program.durationWeeks,
    createdBy: toCoachRef(program.Creator),
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
    days: program.ProgramDay.map(day => ({
      dayOfWeek: day.dayOfWeek,
      exercises: day.ProgramExercise.map(toProgramExercise)
    })),
    assignmentsCount: program._count?.ProgramAssignment ?? 0
  };
}

function toAssignment(assignment) {
  return {
    id: assignment.id,
    displayId: assignment.displayId,
    programId: assignment.programId,
    memberId: assignment.memberId,
    assignedBy: toCoachRef(assignment.Assigner),
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    status: assignment.status,
    createdAt: assignment.createdAt,
    ...(assignment.Program && { program: toProgram(assignment.Program) })
  };
}

/**
 * Projection d'une affectation dans l'ancienne forme « planning » pour que
 * l'app membre (/plannings/member, /plannings/next-day) ne change pas.
 * `id` est l'id de l'affectation ; `User` est l'auteur de l'affectation.
 */
function toLegacyPlanning(assignment) {
  const { Program: program } = assignment;
  return {
    id: assignment.id,
    displayId: assignment.displayId,
    memberId: assignment.memberId,
    coachId: assignment.assignedBy,
    programId: assignment.programId,
    title: program.title,
    description: program.description,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    status: assignment.status,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    User: assignment.Assigner || null,
    PlanningDay: program.ProgramDay.map(day => ({
      id: day.id,
      planningId: assignment.id,
      dayOfWeek: day.dayOfWeek,
      PlanningExercise: day.ProgramExercise.map(pe => ({
        id: pe.id,
        exerciseId: pe.exerciseId,
        planningDayId: day.id,
        sets: pe.sets,
        reps: pe.reps,
        duration: pe.duration,
        weight: pe.weight,
        restTime: pe.restTime,
        notes: pe.notes,
        order: pe.order,
        Exercise: pe.Exercise
      }))
    }))
  };
}

const LEGACY_ASSIGNMENT_INCLUDE = {
  Assigner: { select: { id: true, firstName: true, lastName: true, email: true, fcmToken: true } },
  Program: { include: PROGRAM_INCLUDE }
};

/** Minuit aujourd'hui (heure du serveur), comme les anciennes routes planning. */
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ==================== Validation ====================

function parseDayOfWeek(value) {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    throw new ProgramError(400, 'invalid_day_of_week', 'dayOfWeek doit être un entier de 0 (dimanche) à 6 (samedi)');
  }
  return day;
}

function optionalInt(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new ProgramError(400, 'invalid_field', `${field} doit être un entier positif`);
  return n;
}

function optionalFloat(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new ProgramError(400, 'invalid_field', `${field} doit être un nombre positif`);
  return n;
}

function exerciseData(input, index = 0) {
  const exerciseId = Number(input?.exerciseId);
  if (!Number.isInteger(exerciseId)) throw new ProgramError(400, 'exercise_id_required', 'exerciseId requis');
  return {
    exerciseId,
    sets: optionalInt(input.sets, 'sets'),
    reps: optionalInt(input.reps, 'reps'),
    duration: optionalInt(input.duration, 'duration'),
    weight: optionalFloat(input.weight, 'weight'),
    restTime: optionalInt(input.restTime, 'restTime'),
    notes: input.notes ?? null,
    order: input.order !== undefined ? optionalInt(input.order, 'order') : index
  };
}

/** Valide `days` et vérifie que tous les exercices existent. */
async function parseDays(days) {
  if (!Array.isArray(days)) throw new ProgramError(400, 'invalid_days', 'days doit être un tableau');
  const parsed = days.map(day => ({
    dayOfWeek: parseDayOfWeek(day?.dayOfWeek),
    exercises: (Array.isArray(day?.exercises) ? day.exercises : []).map(exerciseData)
  }));
  const seen = new Set();
  for (const d of parsed) {
    if (seen.has(d.dayOfWeek)) throw new ProgramError(400, 'duplicate_day', `Jour ${d.dayOfWeek} en double`);
    seen.add(d.dayOfWeek);
  }
  await assertExercisesExist(parsed.flatMap(d => d.exercises.map(e => e.exerciseId)));
  return parsed;
}

async function assertExercisesExist(ids) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const found = await prisma.exercise.count({ where: { id: { in: unique } } });
  if (found !== unique.length) throw new ProgramError(404, 'exercise_not_found', 'Exercice introuvable');
}

function programFields(input, { partial }) {
  const data = {};
  if (input.title !== undefined || !partial) {
    if (typeof input.title !== 'string' || !input.title.trim()) {
      throw new ProgramError(400, 'title_required', 'title requis');
    }
    data.title = input.title.trim();
  }
  if (input.description !== undefined) data.description = input.description || null;
  if (input.level !== undefined) data.level = input.level || null;
  if (input.durationWeeks !== undefined) data.durationWeeks = optionalInt(input.durationWeeks, 'durationWeeks');
  return data;
}

function daysCreate(days) {
  return days.map(d => ({
    dayOfWeek: d.dayOfWeek,
    ProgramExercise: { create: d.exercises }
  }));
}

function parseDate(value, field, { required }) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ProgramError(400, 'invalid_date', `${field} requis`);
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ProgramError(400, 'invalid_date', `${field} invalide`);
  return date;
}

// ==================== Programmes ====================

async function getProgramOrThrow(id) {
  const program = await prisma.program.findUnique({ where: { id }, include: PROGRAM_INCLUDE });
  if (!program) throw new ProgramError(404, 'program_not_found', 'Programme introuvable');
  return program;
}

async function listPrograms({ search } = {}) {
  const programs = await prisma.program.findMany({
    where: search ? { title: { contains: search, mode: 'insensitive' } } : {},
    include: PROGRAM_INCLUDE,
    orderBy: { createdAt: 'desc' }
  });
  return programs.map(toProgram);
}

async function getProgram(id) {
  return toProgram(await getProgramOrThrow(id));
}

async function createProgram(input, creatorId) {
  const data = programFields(input, { partial: false });
  const days = input.days !== undefined ? await parseDays(input.days) : [];
  const program = await prisma.program.create({
    data: {
      ...data,
      displayId: generateProgramId(),
      createdBy: creatorId,
      ProgramDay: { create: daysCreate(days) }
    },
    include: PROGRAM_INCLUDE
  });
  return toProgram(program);
}

async function updateProgram(id, input) {
  await getProgramOrThrow(id);
  const data = programFields(input, { partial: true });
  const days = input.days !== undefined ? await parseDays(input.days) : null;

  await prisma.$transaction(async (tx) => {
    if (days) {
      await tx.programDay.deleteMany({ where: { programId: id } });
    }
    await tx.program.update({
      where: { id },
      data: { ...data, ...(days && { ProgramDay: { create: daysCreate(days) } }) }
    });
  });
  return getProgram(id);
}

async function deleteProgram(id) {
  const program = await getProgramOrThrow(id);
  const active = program._count.ProgramAssignment;
  if (active > 0) {
    throw new ProgramError(409, 'program_in_use', 'Ce programme est encore affecté à des membres', { activeAssignments: active });
  }
  await prisma.program.delete({ where: { id } });
  return { deletedId: id };
}

async function addExercise(programId, dayOfWeekRaw, input) {
  await getProgramOrThrow(programId);
  const dayOfWeek = parseDayOfWeek(dayOfWeekRaw);
  const day = await prisma.programDay.upsert({
    where: { programId_dayOfWeek: { programId, dayOfWeek } },
    update: {},
    create: { programId, dayOfWeek }
  });
  const count = await prisma.programExercise.count({ where: { programDayId: day.id } });
  const data = exerciseData(input, count);
  await assertExercisesExist([data.exerciseId]);

  const created = await prisma.programExercise.create({
    data: { ...data, programDayId: day.id },
    include: { Exercise: { select: EXERCISE_SELECT } }
  });
  await prisma.program.update({ where: { id: programId }, data: { updatedAt: new Date() } });
  return toProgramExercise(created);
}

async function findProgramExercise(programId, dayOfWeekRaw, programExerciseId) {
  const dayOfWeek = parseDayOfWeek(dayOfWeekRaw);
  const pe = await prisma.programExercise.findFirst({
    where: { id: programExerciseId, ProgramDay: { programId, dayOfWeek } }
  });
  if (!pe) throw new ProgramError(404, 'program_exercise_not_found', 'Exercice introuvable dans ce programme');
  return pe;
}

async function updateExercise(programId, dayOfWeekRaw, programExerciseId, input) {
  const existing = await findProgramExercise(programId, dayOfWeekRaw, programExerciseId);
  const data = exerciseData({ exerciseId: existing.exerciseId, order: existing.order, ...input });
  await assertExercisesExist([data.exerciseId]);
  // Les champs absents du body sont conservés
  for (const field of ['sets', 'reps', 'duration', 'weight', 'restTime', 'notes']) {
    if (input[field] === undefined) data[field] = existing[field];
  }
  const updated = await prisma.programExercise.update({
    where: { id: programExerciseId },
    data,
    include: { Exercise: { select: EXERCISE_SELECT } }
  });
  return toProgramExercise(updated);
}

async function removeExercise(programId, dayOfWeekRaw, programExerciseId) {
  await findProgramExercise(programId, dayOfWeekRaw, programExerciseId);
  await prisma.programExercise.delete({ where: { id: programExerciseId } });
  return { deletedId: programExerciseId };
}

// ==================== Affectations ====================

/**
 * Raison pour laquelle `requester` ne peut pas consulter le programme du membre,
 * ou null s'il le peut. owner : tous ; manager : sa salle ; coach : ses membres.
 */
function readDenial(requester, memberUser) {
  if (!memberUser || memberUser.role !== 'member' || !memberUser.Member) return 'member_not_found';
  switch (requester.role) {
    case 'owner':
      return null;
    case 'manager':
      return memberUser.gymId === requester.gymId ? null : 'other_gym';
    case 'coach':
      return memberUser.Member.coachId === requester.id ? null : 'not_your_member';
    default:
      return 'forbidden';
  }
}

/**
 * Affectation et annulation : owner et coach uniquement. Le manager planifie des
 * créneaux avec un coach mais n'affecte pas de programme (lecture seule).
 */
function assignmentDenial(requester, memberUser) {
  if (requester.role === 'manager') return 'forbidden';
  return readDenial(requester, memberUser);
}

async function assignProgram(programId, input, requester) {
  const program = await getProgramOrThrow(programId);
  const memberIds = Array.isArray(input.memberIds) ? [...new Set(input.memberIds.map(Number))] : [];
  if (memberIds.length === 0 || memberIds.some(id => !Number.isInteger(id))) {
    throw new ProgramError(400, 'member_ids_required', 'memberIds doit être un tableau d\'entiers non vide');
  }
  const startDate = parseDate(input.startDate, 'startDate', { required: true });
  const endDate = parseDate(input.endDate, 'endDate', { required: false });
  if (endDate && endDate < startDate) {
    throw new ProgramError(400, 'invalid_date', 'endDate doit être postérieure à startDate');
  }

  const users = await prisma.user.findMany({ where: { id: { in: memberIds } }, include: { Member: true } });
  const byId = new Map(users.map(u => [u.id, u]));
  const rejected = memberIds
    .map(memberId => ({ memberId, reason: assignmentDenial(requester, byId.get(memberId)) }))
    .filter(r => r.reason);
  if (rejected.length > 0) {
    throw new ProgramError(422, 'assignment_rejected', 'Certains membres ne peuvent pas recevoir ce programme', { rejected });
  }

  const { assignments, replaced } = await prisma.$transaction(async (tx) => {
    // Un seul programme actif par membre
    const { count } = await tx.programAssignment.updateMany({
      where: { memberId: { in: memberIds }, status: 'active' },
      data: { status: 'completed' }
    });
    const created = [];
    for (const memberId of memberIds) {
      created.push(await tx.programAssignment.create({
        data: {
          displayId: generateAssignmentId(),
          programId,
          memberId,
          assignedBy: requester.id,
          startDate,
          endDate
        },
        include: { Assigner: { select: COACH_REF_SELECT } }
      }));
    }
    return { assignments: created, replaced: count };
  });

  return {
    assignments: assignments.map(a => ({ ...toAssignment(a), program: toProgram(program) })),
    replaced,
    // Pour les notifications (non renvoyé tel quel au client)
    members: users,
    program
  };
}

async function cancelAssignment(assignmentId, requester) {
  const assignment = await prisma.programAssignment.findUnique({
    where: { id: assignmentId },
    include: { Member: { include: { User: { include: { Member: true } } } } }
  });
  if (!assignment) throw new ProgramError(404, 'assignment_not_found', 'Affectation introuvable');
  const reason = assignmentDenial(requester, assignment.Member.User);
  if (reason) throw new ProgramError(403, reason, 'Vous ne pouvez pas gérer le programme de ce membre');

  const updated = await prisma.programAssignment.update({
    where: { id: assignmentId },
    data: { status: 'cancelled' },
    include: { Assigner: { select: COACH_REF_SELECT }, Program: { include: PROGRAM_INCLUDE } }
  });
  return toAssignment(updated);
}

/** Lecture des programmes d'un membre : lui-même, staff de sa salle, son coach, owner. */
function canReadMemberPrograms(requester, memberUser) {
  if (requester.role === 'member') return requester.id === memberUser.id;
  return readDenial(requester, memberUser) === null;
}

async function getMemberUserOrThrow(memberId) {
  const user = await prisma.user.findUnique({ where: { id: memberId }, include: { Member: true } });
  if (!user || user.role !== 'member' || !user.Member) {
    throw new ProgramError(404, 'member_not_found', 'Membre introuvable');
  }
  return user;
}

async function listMemberAssignments(memberId, { status } = {}) {
  if (status && !ASSIGNMENT_STATUSES.includes(status)) {
    throw new ProgramError(400, 'invalid_status', `status doit valoir ${ASSIGNMENT_STATUSES.join(', ')}`);
  }
  const assignments = await prisma.programAssignment.findMany({
    where: { memberId, ...(status && { status }) },
    include: { Assigner: { select: COACH_REF_SELECT }, Program: { include: PROGRAM_INCLUDE } },
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }]
  });
  return assignments.map(toAssignment);
}

/** Affectations dans l'ancienne forme « planning » (routes /plannings historiques). */
async function listLegacyPlannings(where) {
  const assignments = await prisma.programAssignment.findMany({
    where,
    include: LEGACY_ASSIGNMENT_INCLUDE,
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }]
  });
  return assignments.map(a => {
    const planning = toLegacyPlanning(a);
    if (planning.User) delete planning.User.fcmToken;
    return planning;
  });
}

/**
 * Affectation active couvrant `date` (la plus récente). Sans endDate,
 * l'affectation court tant qu'elle est active.
 */
async function findActiveAssignment(memberId, date = startOfToday()) {
  return prisma.programAssignment.findFirst({
    where: {
      memberId,
      status: 'active',
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }]
    },
    include: LEGACY_ASSIGNMENT_INCLUDE,
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }]
  });
}

module.exports = {
  ProgramError,
  ASSIGNMENT_STATUSES,
  listPrograms,
  getProgram,
  createProgram,
  updateProgram,
  deleteProgram,
  addExercise,
  updateExercise,
  removeExercise,
  assignProgram,
  cancelAssignment,
  canReadMemberPrograms,
  getMemberUserOrThrow,
  listMemberAssignments,
  listLegacyPlannings,
  findActiveAssignment,
  startOfToday,
  toLegacyPlanning
};
