const prisma = require('../utils/prismaClient');
const { sendPushNotification } = require('../services/pushNotificationService');
const sessionService = require('../services/sessionService');

/**
 * Rôles V2 : jobs des séances (toutes les 15 minutes).
 * - Rappel FCM aux membres inscrits, environ 1 h avant la séance
 * - Clôture des séances passées : status `done`, inscrits non pointés `absent`
 */

async function sendSessionReminders() {
  const sessions = await sessionService.sessionsNeedingReminder();
  let sent = 0;
  for (const session of sessions) {
    const time = new Date(session.startAt).toLocaleTimeString('fr-FR', {
      timeZone: process.env.GYM_TIMEZONE || 'Africa/Casablanca', hour: '2-digit', minute: '2-digit'
    });
    for (const { Member } of session.Members) {
      const user = Member.User;
      if (!user.fcmToken || !user.notificationsEnabled) continue;
      try {
        await sendPushNotification(user.fcmToken, {
          title: '⏰ Séance bientôt',
          body: `${session.title || 'Séance'} à ${time} (${session.Gym.name})`,
          data: { type: 'session', sessionId: String(session.id), action: 'reminder' }
        }, user.id);
        sent++;
      } catch (error) {
        console.error(`❌ Rappel séance ${session.id} non envoyé à ${user.id}:`, error.message);
      }
    }
    await prisma.trainingSession.update({ where: { id: session.id }, data: { reminderSentAt: new Date() } });
  }
  return { sessions: sessions.length, sent };
}

async function closePastSessions(now = new Date()) {
  const past = await prisma.trainingSession.findMany({
    where: { status: 'scheduled', endAt: { lte: now } },
    select: { id: true }
  });
  const ids = past.map(s => s.id);
  if (ids.length === 0) return { closed: 0, absent: 0 };
  const [absent] = await prisma.$transaction([
    prisma.trainingSessionMember.updateMany({
      where: { sessionId: { in: ids }, status: 'booked' },
      data: { status: 'absent' }
    }),
    prisma.trainingSession.updateMany({ where: { id: { in: ids } }, data: { status: 'done' } })
  ]);
  return { closed: ids.length, absent: absent.count };
}

module.exports = { sendSessionReminders, closePastSessions };
