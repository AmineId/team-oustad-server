const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendPushNotification } = require('../services/pushNotificationService');
const { getFullName } = require('../utils/nameUtils');

const prisma = new PrismaClient();

/**
 * Job qui s'exécute tous les matins à 6h pour notifier les membres
 * qui ont un planning prévu pour aujourd'hui
 */
const dailyPlanningNotification = cron.schedule('0 6 * * *', async () => {
  console.log('📅 [DAILY PLANNING NOTIFICATION] Démarrage du job à', new Date().toISOString());

  try {
    // Obtenir la date actuelle et le jour de la semaine
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDayOfWeek = now.getDay();

    console.log(`📅 Date: ${today.toISOString().split('T')[0]}, Jour de la semaine: ${currentDayOfWeek}`);

    // Trouver tous les plannings actifs pour aujourd'hui
    const activePlannings = await prisma.planning.findMany({
      where: {
        status: 'active',
        startDate: { lte: today },
        endDate: { gte: today }
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                fcmToken: true
              }
            }
          }
        },
        coach: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        days: {
          where: {
            dayOfWeek: currentDayOfWeek
          },
          include: {
            exercises: {
              include: {
                exercise: true
              },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    console.log(`✅ ${activePlannings.length} planning(s) actif(s) trouvé(s)`);

    // Filtrer les plannings qui ont des exercices aujourd'hui
    const planningsWithExercisesToday = activePlannings.filter(
      planning => planning.days.length > 0 && planning.days[0].exercises.length > 0
    );

    console.log(`✅ ${planningsWithExercisesToday.length} planning(s) avec exercices aujourd'hui`);

    let successCount = 0;
    let failCount = 0;

    // Envoyer une notification à chaque membre
    for (const planning of planningsWithExercisesToday) {
      const member = planning.member.user;
      const day = planning.days[0];
      const exerciseCount = day.exercises.length;
      const memberFullName = getFullName(member);

      console.log(`📤 Envoi notification à ${memberFullName} - ${exerciseCount} exercice(s)`);

      // Vérifier que les notifications sont activées au niveau global (User)
      if (!member.notificationsEnabled) {
        console.log(`⚠️ ${memberFullName} a désactivé toutes les notifications`);
        continue;
      }

      // Vérifier que le membre a activé les notifications d'entraînement spécifiques
      if (!planning.member.workoutNotificationsEnabled) {
        console.log(`⚠️ ${memberFullName} a désactivé les notifications d'entraînement`);
        continue;
      }

      // Vérifier que le membre a un token FCM
      if (!member.fcmToken) {
        console.log(`⚠️ ${memberFullName} n'a pas de FCM token, notification ignorée`);
        failCount++;
        continue;
      }

      try {
        // Créer le message de notification
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const exercisesList = day.exercises
          .slice(0, 3)
          .map(ex => ex.exercise.name)
          .join(', ');
        
        const moreExercises = exerciseCount > 3 ? ` et ${exerciseCount - 3} autre${exerciseCount - 3 > 1 ? 's' : ''}` : '';

        const notificationBody = exerciseCount === 1
          ? `1 exercice prévu aujourd'hui : ${exercisesList}`
          : `${exerciseCount} exercices prévus aujourd'hui : ${exercisesList}${moreExercises}`;

        await sendPushNotification(member.fcmToken, {
          title: `🏋️ Entraînement du jour - ${dayNames[currentDayOfWeek]}`,
          body: notificationBody,
          data: {
            type: 'daily_planning',
            planningId: planning.id.toString(),
            memberId: member.id.toString(),
            dayOfWeek: currentDayOfWeek.toString(),
            exerciseCount: exerciseCount.toString(),
            planningTitle: planning.title
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              color: '#4CAF50',
              channelId: 'daily_planning'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                category: 'DAILY_PLANNING'
              }
            }
          }
        });

        console.log(`✅ Notification envoyée à ${memberFullName}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Erreur envoi notification à ${memberFullName}:`, error);
        failCount++;
      }
    }

    console.log(`✅ [DAILY PLANNING NOTIFICATION] Job terminé - ${successCount} succès, ${failCount} échecs`);
  } catch (error) {
    console.error('💥 [DAILY PLANNING NOTIFICATION] Erreur critique:', error);
  }
}, {
  scheduled: false, // Le job ne démarre pas automatiquement
  timezone: "Europe/Paris" // Timezone pour le cron
});

module.exports = { dailyPlanningNotification };
