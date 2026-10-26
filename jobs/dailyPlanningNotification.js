const cron = require('node-cron');
const prisma = require('../utils/prismaClient');
const { executeWithRetry } = require('../utils/prismaClient');
const { sendPushNotification } = require('../services/pushNotificationService');
const { getFullName } = require('../utils/nameUtils');

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

    // Rôles V2 : affectations de programme actives aujourd'hui (endDate null = sans fin)
    const activeAssignments = await executeWithRetry(async () => {
      return await prisma.programAssignment.findMany({
        where: {
          status: 'active',
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }]
        },
        include: {
          Member: {
            include: {
              User: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  fcmToken: true,
                  notificationsEnabled: true
                }
              }
            }
          },
          Program: {
            include: {
              ProgramDay: {
                where: { dayOfWeek: currentDayOfWeek },
                include: {
                  ProgramExercise: {
                    include: { Exercise: true },
                    orderBy: { order: 'asc' }
                  }
                }
              }
            }
          }
        }
      });
    });

    console.log(`✅ ${activeAssignments.length} programme(s) actif(s) trouvé(s)`);

    // Forme « planning » attendue par la boucle d'envoi (id = affectation)
    const planningsWithExercisesToday = activeAssignments
      .filter(a => a.Program.ProgramDay.length > 0 && a.Program.ProgramDay[0].ProgramExercise.length > 0)
      .map(a => ({
        id: a.id,
        title: a.Program.title,
        Member: a.Member,
        PlanningDay: [{ PlanningExercise: a.Program.ProgramDay[0].ProgramExercise }]
      }));

    console.log(`✅ ${planningsWithExercisesToday.length} planning(s) avec exercices aujourd'hui`);

    let successCount = 0;
    let failCount = 0;

    // Envoyer une notification à chaque membre
    for (const planning of planningsWithExercisesToday) {
      const member = planning.Member.User;
      const day = planning.PlanningDay[0];
      const exerciseCount = day.PlanningExercise.length;
      const memberFullName = getFullName(member);

      console.log(`📤 Envoi notification à ${memberFullName} - ${exerciseCount} exercice(s)`);

      // Vérifier que les notifications sont activées au niveau global (User)
      if (!member.notificationsEnabled) {
        console.log(`⚠️ ${memberFullName} a désactivé toutes les notifications`);
        continue;
      }

      // Vérifier que le membre a activé les notifications d'entraînement spécifiques
      if (!planning.Member.workoutNotificationsEnabled) {
        console.log(`⚠️ ${memberFullName} a désactivé les notifications d'entraînement`);
        continue;
      }

      // Vérifier que le membre a activé les notifications globales
      if (!member.notificationsEnabled) {
        console.log(`⚠️ ${memberFullName} a désactivé les notifications globales`);
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
        const exercisesList = day.PlanningExercise
          .slice(0, 3)
          .map(ex => ex.Exercise.name)
          .join(', ');
        
        const moreExercises = exerciseCount > 3 ? ` et ${exerciseCount - 3} autre${exerciseCount - 3 > 1 ? 's' : ''}` : '';

        const notificationBody = exerciseCount === 1
          ? `1 exercice prévu aujourd'hui : ${exercisesList}`
          : `${exerciseCount} exercices prévus aujourd'hui : ${exercisesList}${moreExercises}`;

        await sendPushNotification(member.fcmToken, {
          title: `🏋️ Entraînement du jour - ${dayNames[currentDayOfWeek]}`,
          body: notificationBody,
          data: {
            type: 'planning',
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
