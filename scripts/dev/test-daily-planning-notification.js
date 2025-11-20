/**
 * Script de test pour le job de notification quotidienne de planning
 * Usage: node scripts/dev/test-daily-planning-notification.js
 */

const { PrismaClient } = require('@prisma/client');
const { sendPushNotification } = require('../../services/pushNotificationService');
const { getFullName } = require('../../utils/nameUtils');

const prisma = new PrismaClient();

async function testDailyPlanningNotification() {
  console.log('🧪 TEST - Notification quotidienne de planning\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Obtenir la date actuelle et le jour de la semaine
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDayOfWeek = now.getDay();

    console.log(`📅 Date: ${today.toISOString().split('T')[0]}`);
    console.log(`📅 Jour de la semaine: ${currentDayOfWeek} (0=Dimanche, 1=Lundi, etc.)\n`);

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
                email: true,
                fcmToken: true,
                notificationsEnabled: true
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

    console.log(`📊 ${activePlannings.length} planning(s) actif(s) trouvé(s)\n`);

    // Filtrer les plannings qui ont des exercices aujourd'hui
    const planningsWithExercisesToday = activePlannings.filter(
      planning => planning.days.length > 0 && planning.days[0].exercises.length > 0
    );

    console.log(`✅ ${planningsWithExercisesToday.length} planning(s) avec exercices aujourd'hui\n`);

    if (planningsWithExercisesToday.length === 0) {
      console.log('ℹ️  Aucun planning avec exercices pour aujourd\'hui');
      console.log('💡 Pour tester, créez un planning avec des exercices pour le jour actuel\n');
      return;
    }

    console.log('📋 Détails des plannings:\n');

    let membersWithToken = 0;
    let membersWithoutToken = 0;

    for (const planning of planningsWithExercisesToday) {
      const member = planning.member.user;
      const day = planning.days[0];
      const exerciseCount = day.exercises.length;
      const memberFullName = getFullName(member);
      const coachFullName = getFullName(planning.coach);

      console.log(`👤 ${memberFullName}`);
      console.log(`   📧 ${member.email}`);
      console.log(`   📋 Planning: ${planning.title}`);
      console.log(`   👨‍🏫 Coach: ${coachFullName}`);
      console.log(`   💪 Exercices: ${exerciseCount}`);
      
      const exerciseNames = day.exercises
        .slice(0, 3)
        .map(ex => `"${ex.exercise.name}"`)
        .join(', ');
      console.log(`   📝 ${exerciseNames}${exerciseCount > 3 ? ' ...' : ''}`);

      if (member.fcmToken) {
        console.log(`   ✅ Token FCM présent`);
        membersWithToken++;
      } else {
        console.log(`   ⚠️  Pas de token FCM (notification ne sera pas envoyée)`);
        membersWithoutToken++;
      }
      console.log();
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ:');
    console.log(`   Plannings actifs: ${activePlannings.length}`);
    console.log(`   Avec exercices aujourd'hui: ${planningsWithExercisesToday.length}`);
    console.log(`   Membres avec token FCM: ${membersWithToken}`);
    console.log(`   Membres sans token FCM: ${membersWithoutToken}`);
    console.log(`   Notifications qui seraient envoyées: ${membersWithToken}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Demander confirmation pour l'envoi réel
    if (membersWithToken > 0) {
      console.log('⚠️  ATTENTION: Ce script peut envoyer de vraies notifications!');
      console.log('   Pour envoyer réellement les notifications, modifiez le code.\n');
      
      // Décommenter cette section pour envoyer réellement les notifications
      /*
      console.log('📤 Envoi des notifications...\n');
      
      const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      
      for (const planning of planningsWithExercisesToday) {
        const member = planning.member.user;
        
        if (!member.fcmToken) continue;
        
        const day = planning.days[0];
        const exerciseCount = day.exercises.length;
        const exercisesList = day.exercises
          .slice(0, 3)
          .map(ex => ex.exercise.name)
          .join(', ');
        
        const moreExercises = exerciseCount > 3 ? ` et ${exerciseCount - 3} autre${exerciseCount - 3 > 1 ? 's' : ''}` : '';

        const notificationBody = exerciseCount === 1
          ? `1 exercice prévu aujourd'hui : ${exercisesList}`
          : `${exerciseCount} exercices prévus aujourd'hui : ${exercisesList}${moreExercises}`;

        try {
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
        } catch (error) {
          console.error(`❌ Erreur pour ${memberFullName}:`, error.message);
        }
      }
      */
    }

    console.log('✅ Test terminé');

  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testDailyPlanningNotification()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
