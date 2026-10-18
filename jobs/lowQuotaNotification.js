const prisma = require('../utils/prismaClient');
const notificationService = require('../services/notificationService');
const pushNotificationService = require('../services/pushNotificationService');

/**
 * Vérifie les quotas de sessions et envoie des notifications pour ceux < 25%
 */
async function checkLowQuotaSubscriptions() {
  console.log('🔍 Vérification des quotas de sessions bas...');

  try {
    // Récupérer tous les abonnements actifs avec quotas limités
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        sessionQuota: {
          not: null // Exclure les abonnements illimités
        }
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                email: true,
                phoneNumber: true,
                firstName: true,
                lastName: true,
                notificationsEnabled: true,
                fcmToken: true
              }
            }
          }
        },
        subscriptionType: {
          select: {
            name: true,
            displayId: true
          }
        }
      }
    });

    console.log(`📊 ${subscriptions.length} abonnement(s) actif(s) avec quotas trouvé(s)`);

    let notificationsSent = 0;
    let emailsSent = 0;

    for (const subscription of subscriptions) {
      const { sessionQuota, sessionsUsed } = subscription;
      
      // Calculer le pourcentage restant
      const percentageUsed = (sessionsUsed / sessionQuota) * 100;
      const percentageRemaining = 100 - percentageUsed;
      const sessionsRemaining = sessionQuota - sessionsUsed;

      // Si quota restant < 25% et n'a pas déjà été notifié récemment
      if (percentageRemaining < 25 && percentageRemaining >= 0 && sessionsRemaining > 0) {
        console.log(`⚠️  Quota bas détecté:`);
        console.log(`   - Membre: ${subscription.member.user.firstName} ${subscription.member.user.lastName}`);
        console.log(`   - Type: ${subscription.subscriptionType.name}`);
        console.log(`   - Restant: ${sessionsRemaining}/${sessionQuota} (${percentageRemaining.toFixed(1)}%)`);

        // Vérifier si une notification a déjà été envoyée dans les dernières 48h
        const recentNotification = await checkRecentNotification(subscription.id);
        if (recentNotification) {
          console.log(`   ℹ️  Notification déjà envoyée récemment, skip`);
          continue;
        }

        // Envoyer notification push
        if (subscription.member.user.notificationsEnabled && subscription.member.user.fcmToken) {
          try {
            await pushNotificationService.sendPushNotification(
              subscription.member.user.fcmToken,
              {
                title: '⚠️ Quota de séances faible',
                body: `Il vous reste ${sessionsRemaining} séance(s) sur ${sessionQuota}. Pensez à renouveler votre abonnement !`,
                data: {
                  type: 'low_quota',
                  subscriptionId: subscription.displayId,
                  sessionsRemaining: sessionsRemaining.toString()
                }
              },
              subscription.member.userId
            );
            notificationsSent++;
            console.log(`   ✅ Notification push envoyée`);
          } catch (error) {
            console.error(`   ❌ Erreur notification push:`, error.message);
          }
        }

        // Envoyer notification (WhatsApp ou email)
        try {
          await notificationService.sendLowQuotaNotification(
            subscription.member.user,
            {
              firstName: subscription.member.user.firstName,
              lastName: subscription.member.user.lastName,
              subscriptionType: subscription.subscriptionType.name,
              sessionsRemaining,
              sessionQuota,
              percentageRemaining: percentageRemaining.toFixed(1),
              endDate: subscription.endDate
            }
          );
          emailsSent++;
          console.log(`   ✅ Notification envoyée`);
        } catch (error) {
          console.error(`   ❌ Erreur envoi notification:`, error.message);
        }

        // Enregistrer la notification envoyée
        await recordNotification(subscription.id);
      }
    }

    console.log(`\n✅ Vérification terminée:`);
    console.log(`   - ${notificationsSent} notification(s) push envoyée(s)`);
    console.log(`   - ${emailsSent} email(s) envoyé(s)`);

    return { notificationsSent, emailsSent };

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des quotas:', error);
    throw error;
  }
}

/**
 * Vérifie si une notification a été envoyée dans les dernières 48h
 */
async function checkRecentNotification(subscriptionId) {
  const twoDaysAgo = new Date();
  twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

  // Utiliser une table simple pour tracker les notifications
  // On va créer une table QuotaNotification si elle n'existe pas
  try {
    const recent = await prisma.$queryRaw`
      SELECT 1 FROM "QuotaNotification"
      WHERE "subscriptionId" = ${subscriptionId}
      AND "sentAt" > ${twoDaysAgo}
      LIMIT 1
    `;
    return recent && recent.length > 0;
  } catch (error) {
    // Si la table n'existe pas, on continue sans vérification
    if (error.code === 'P2021' || error.code === '42P01') {
      console.log('   ℹ️  Table QuotaNotification non trouvée, skip vérification');
      return false;
    }
    throw error;
  }
}

/**
 * Enregistre qu'une notification a été envoyée
 */
async function recordNotification(subscriptionId) {
  try {
    await prisma.$executeRaw`
      INSERT INTO "QuotaNotification" ("subscriptionId", "sentAt")
      VALUES (${subscriptionId}, NOW())
      ON CONFLICT ("subscriptionId") 
      DO UPDATE SET "sentAt" = NOW()
    `;
  } catch (error) {
    // Si la table n'existe pas, on continue sans enregistrement
    if (error.code === 'P2021' || error.code === '42P01') {
      console.log('   ℹ️  Table QuotaNotification non trouvée, skip enregistrement');
      return;
    }
    console.error('   ⚠️ Erreur enregistrement notification:', error.message);
  }
}

module.exports = { checkLowQuotaSubscriptions };
