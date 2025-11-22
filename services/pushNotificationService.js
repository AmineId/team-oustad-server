// Service pour gérer l'envoi de notifications push via Firebase Cloud Messaging (FCM)

const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin SDK (à configurer avec vos credentials)
// Pour initialiser Firebase, vous devez:
// 1. Créer un projet Firebase sur https://console.firebase.google.com
// 2. Générer une clé privée (Service Account) dans Project Settings > Service Accounts
// 3. Télécharger le fichier JSON et le placer dans le projet (ex: firebase-service-account.json)
// 4. Ajouter le chemin dans .env: FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    return true;
  }

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (!serviceAccountPath) {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_PATH non défini dans .env - Les notifications push sont désactivées');
      return false;
    }

    // Résoudre le chemin par rapport au dossier racine du projet
    const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
    const serviceAccount = require(absolutePath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialisé');
    return true;
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase Admin SDK:', error.message);
    console.error('   Chemin recherché:', path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'non défini'));
    return false;
  }
}

/**
 * Envoyer une notification push à un utilisateur
 * @param {string} fcmToken - Token FCM de l'utilisateur
 * @param {Object} notification - Contenu de la notification
 * @param {string} notification.title - Titre de la notification
 * @param {string} notification.body - Corps de la notification
 * @param {Object} notification.data - Données additionnelles (optionnel)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendPushNotification(fcmToken, notification) {
  // Vérifier que le token FCM existe et n'est pas vide
  if (!fcmToken || fcmToken.trim() === '') {
    console.log('⚠️ Token FCM manquant ou vide - Notification non envoyée');
    return { success: false, error: 'Token FCM manquant' };
  }

  console.log(`📲 Envoi notification push - Token: ${fcmToken.substring(0, 20)}...`);

  if (!initializeFirebase()) {
    console.log('⚠️ Firebase non initialisé - Notification non envoyée');
    return { success: false, error: 'Firebase non configuré' };
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      token: fcmToken
    };

    // Ajouter des données custom si présentes
    if (notification.data) {
      message.data = notification.data;
    }

    // Ajouter des options Android/iOS si spécifiées
    if (notification.android) {
      message.android = notification.android;
    }
    if (notification.apns) {
      message.apns = notification.apns;
    }

    const response = await admin.messaging().send(message);
    console.log(`✅ Notification envoyée avec succès - Message ID: ${response}`);
    
    return { success: true, messageId: response };
  } catch (error) {
    // Gérer spécifiquement les tokens invalides ou non enregistrés
    if (error.code === 'messaging/registration-token-not-registered' || 
        error.code === 'messaging/invalid-registration-token') {
      console.warn(`⚠️ Token FCM invalide ou non enregistré - Token: ${fcmToken.substring(0, 20)}...`);
      return { success: false, error: 'Token FCM invalide', tokenInvalid: true };
    }
    
    console.error('❌ Erreur envoi notification push:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoyer une notification push à plusieurs utilisateurs
 * @param {string[]} fcmTokens - Liste des tokens FCM
 * @param {Object} notification - Contenu de la notification
 * @returns {Promise<Object>} Résultat de l'envoi groupé
 */
async function sendMulticastPushNotification(fcmTokens, notification) {
  // Filtrer les tokens valides (non vides)
  const validTokens = fcmTokens.filter(token => token && token.trim() !== '');
  
  if (validTokens.length === 0) {
    console.log('⚠️ Aucun token FCM valide - Notifications non envoyées');
    return { success: false, error: 'Aucun token FCM valide' };
  }
  
  if (validTokens.length < fcmTokens.length) {
    console.warn(`⚠️ ${fcmTokens.length - validTokens.length} token(s) invalide(s) ignoré(s)`);
  }

  console.log(`📲 Envoi notification multicast - ${validTokens.length} destinataires`);

  if (!initializeFirebase()) {
    console.log('⚠️ Firebase non initialisé - Notifications non envoyées');
    return { success: false, error: 'Firebase non configuré' };
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      tokens: validTokens
    };

    if (notification.data) {
      message.data = notification.data;
    }
    if (notification.android) {
      message.android = notification.android;
    }
    if (notification.apns) {
      message.apns = notification.apns;
    }

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ ${response.successCount}/${validTokens.length} notifications envoyées avec succès`);
    
    if (response.failureCount > 0) {
      console.warn(`⚠️ ${response.failureCount} notifications ont échoué`);
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (errorCode === 'messaging/registration-token-not-registered' || 
              errorCode === 'messaging/invalid-registration-token') {
            console.warn(`⚠️ Token FCM invalide ignoré: ${validTokens[idx].substring(0, 20)}...`);
          } else {
            console.error(`❌ Échec pour token ${validTokens[idx].substring(0, 20)}... : ${resp.error}`);
          }
        }
      });
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses
    };
  } catch (error) {
    console.error('❌ Erreur envoi notification multicast:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notifier un membre d'un paiement dû
 * @param {string} fcmToken - Token FCM du membre
 * @param {Object} payment - Informations du paiement
 */
async function notifyPaymentDue(fcmToken, payment) {
  return sendPushNotification(fcmToken, {
    title: '💳 Paiement à effectuer',
    body: `Votre paiement de ${payment.amount}€ est dû le ${new Date(payment.dueDate).toLocaleDateString('fr-FR')}`,
    data: {
      type: 'payment_due',
      paymentId: payment.id.toString(),
      amount: payment.amount.toString(),
      dueDate: payment.dueDate.toISOString()
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    }
  });
}

/**
 * Notifier un membre d'un paiement en retard
 * @param {string} fcmToken - Token FCM du membre
 * @param {Object} payment - Informations du paiement
 */
async function notifyPaymentOverdue(fcmToken, payment) {
  const daysOverdue = Math.floor((new Date() - new Date(payment.dueDate)) / (1000 * 60 * 60 * 24));
  
  return sendPushNotification(fcmToken, {
    title: '⚠️ Paiement en retard',
    body: `Votre paiement de ${payment.amount}€ est en retard de ${daysOverdue} jour(s)`,
    data: {
      type: 'payment_overdue',
      paymentId: payment.id.toString(),
      amount: payment.amount.toString(),
      dueDate: payment.dueDate.toISOString(),
      daysOverdue: daysOverdue.toString()
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        color: '#FF0000'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1
        }
      }
    }
  });
}

/**
 * Notifier un membre que son paiement a été confirmé
 * @param {string} fcmToken - Token FCM du membre
 * @param {Object} payment - Informations du paiement
 */
async function notifyPaymentConfirmed(fcmToken, payment) {
  return sendPushNotification(fcmToken, {
    title: '✅ Paiement confirmé',
    body: `Votre paiement de ${payment.amount}€ a été confirmé avec succès`,
    data: {
      type: 'payment_confirmed',
      paymentId: payment.id.toString(),
      amount: payment.amount.toString()
    },
    android: {
      priority: 'normal',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    }
  });
}

/**
 * Notifier un membre d'un nouveau planning d'entraînement
 * @param {string} fcmToken - Token FCM du membre
 * @param {Object} planning - Informations du planning
 */
async function notifyNewTrainingPlan(fcmToken, planning) {
  return sendPushNotification(fcmToken, {
    title: '💪 Nouveau planning d\'entraînement',
    body: `${planning.title} - Du ${new Date(planning.startDate).toLocaleDateString('fr-FR')} au ${new Date(planning.endDate).toLocaleDateString('fr-FR')}`,
    data: {
      type: 'new_training_plan',
      planningId: planning.id.toString(),
      title: planning.title
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    }
  });
}

/**
 * Notifier un membre d'un nouvel abonnement créé
 * @param {string} fcmToken - Token FCM du membre
 * @param {Object} subscription - Informations de l'abonnement
 */
async function notifyNewSubscription(fcmToken, subscription) {
  const totalAmount = subscription.subscriptionType?.price || 0;
  const frequencyLabels = {
    1: 'paiement unique',
    3: 'trimestriel',
    6: 'semestriel',
    12: 'mensuel'
  };
  const frequency = subscription.paymentFrequency || 12;
  
  return sendPushNotification(fcmToken, {
    title: '📋 Nouvel abonnement créé',
    body: `${subscription.subscriptionType?.name || 'Abonnement'} - ${totalAmount}€ en ${frequencyLabels[frequency]}`,
    data: {
      type: 'new_subscription',
      subscriptionId: subscription.id.toString(),
      subscriptionType: subscription.subscriptionType?.name || '',
      amount: totalAmount.toString(),
      frequency: frequency.toString()
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    }
  });
}

/**
 * Notifier un membre d'un nouveau paiement créé
 * @param {string} fcmToken - Token FCM du membre
 * @param {Object} payment - Informations du paiement
 */
async function notifyNewPayment(fcmToken, payment) {
  return sendPushNotification(fcmToken, {
    title: '💳 Nouveau paiement enregistré',
    body: `Paiement ${payment.monthNumber ? `#${payment.monthNumber}` : ''} de ${payment.amount}€ - Échéance: ${new Date(payment.dueDate).toLocaleDateString('fr-FR')}`,
    data: {
      type: 'new_payment',
      paymentId: payment.id.toString(),
      amount: payment.amount.toString(),
      dueDate: payment.dueDate.toISOString(),
      monthNumber: payment.monthNumber?.toString() || ''
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    }
  });
}

/**
 * Notifier un membre d'un changement de statut de paiement
 * @param {string} fcmToken - Token FCM du membre
 * @param {Object} payment - Informations du paiement
 * @param {string} oldStatus - Ancien statut
 * @param {string} newStatus - Nouveau statut
 */
async function notifyPaymentStatusChange(fcmToken, payment, oldStatus, newStatus) {
  const statusLabels = {
    pending: 'En attente',
    completed: 'Complété',
    overdue: 'En retard',
    cancelled: 'Annulé'
  };
  
  let title = '🔄 Statut de paiement mis à jour';
  let body = `Paiement de ${payment.amount}€ : ${statusLabels[oldStatus] || oldStatus} → ${statusLabels[newStatus] || newStatus}`;
  
  // Messages personnalisés selon le nouveau statut
  if (newStatus === 'completed') {
    title = '✅ Paiement confirmé';
    body = `Votre paiement de ${payment.amount}€ a été confirmé avec succès`;
  } else if (newStatus === 'overdue') {
    title = '⚠️ Paiement en retard';
    body = `Votre paiement de ${payment.amount}€ est maintenant en retard`;
  }
  
  return sendPushNotification(fcmToken, {
    title,
    body,
    data: {
      type: 'payment_status_change',
      paymentId: payment.id.toString(),
      amount: payment.amount.toString(),
      oldStatus,
      newStatus
    },
    android: {
      priority: newStatus === 'overdue' ? 'high' : 'normal',
      notification: {
        sound: 'default',
        color: newStatus === 'overdue' ? '#FF0000' : undefined
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: newStatus === 'overdue' ? 1 : undefined
        }
      }
    }
  });
}

/**
 * Notifier un membre de la modification d'un planning
 * @param {string} fcmToken - Token FCM du membre
 * @param {Object} planning - Informations du planning
 * @param {string} modificationType - Type de modification (exercise_added, exercise_removed, exercise_updated)
 */
async function notifyPlanningModified(fcmToken, planning, modificationType = 'updated') {
  const modificationLabels = {
    exercise_added: 'Nouvel exercice ajouté',
    exercise_removed: 'Exercice supprimé',
    exercise_updated: 'Exercice mis à jour',
    updated: 'Planning mis à jour'
  };
  
  return sendPushNotification(fcmToken, {
    title: '📝 Planning modifié',
    body: `${planning.title} - ${modificationLabels[modificationType] || 'Modification effectuée'}`,
    data: {
      type: 'planning_modified',
      planningId: planning.id.toString(),
      modificationType,
      title: planning.title
    },
    android: {
      priority: 'normal',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    }
  });
}

/**
 * Notifier un membre de la suppression d'un planning
 * @param {string} fcmToken - Token FCM du membre
 * @param {Object} planning - Informations du planning
 */
async function notifyPlanningDeleted(fcmToken, planning) {
  return sendPushNotification(fcmToken, {
    title: '🗑️ Planning supprimé',
    body: `Le planning "${planning.title}" a été supprimé`,
    data: {
      type: 'planning_deleted',
      planningId: planning.id.toString(),
      title: planning.title
    },
    android: {
      priority: 'normal',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    }
  });
}

/**
 * Notifier tous les membres d'une salle
 * @param {number} gymId - ID de la salle
 * @param {Object} notification - Contenu de la notification
 */
async function notifyGymMembers(gymId, notification) {
  const prisma = require('../utils/prismaClient');

  try {
    console.log(`📢 Notification pour tous les membres de la salle ${gymId}`);

    // Récupérer tous les tokens FCM des membres de cette salle
    const users = await prisma.user.findMany({
      where: {
        gymId: gymId,
        fcmToken: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fcmToken: true
      }
    });

    if (users.length === 0) {
      console.log('⚠️ Aucun membre avec FCM token dans cette salle');
      return { success: false, error: 'Aucun destinataire' };
    }

    const fcmTokens = users.map(u => u.fcmToken);
    console.log(`📲 Envoi à ${fcmTokens.length} membres`);

    return await sendMulticastPushNotification(fcmTokens, notification);
  } catch (error) {
    console.error('❌ Erreur notification membres salle:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  sendMulticastPushNotification,
  notifyPaymentDue,
  notifyPaymentOverdue,
  notifyPaymentConfirmed,
  notifyPaymentStatusChange,
  notifyNewTrainingPlan,
  notifyNewSubscription,
  notifyNewPayment,
  notifyPlanningModified,
  notifyPlanningDeleted,
  notifyGymMembers
};
