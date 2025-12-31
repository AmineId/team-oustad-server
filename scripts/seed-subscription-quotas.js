const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateSubscriptionTypeId } = require('../utils/idGenerator');

async function seedSubscriptionTypesWithQuotas() {
  console.log('🌱 Ajout des types d\'abonnement avec quotas...');

  const subscriptionTypes = [
    {
      name: '12 Séances',
      description: 'Abonnement de 12 séances valable 1 mois',
      monthlyPrice: 150,
      sessionQuota: 12,
      sessionType: 'limited',
      durationMonths: 1,
      features: [
        '12 séances de fitness',
        'Accès à tous les équipements',
        'Valable 1 mois',
        'Suivi de progression'
      ]
    },
    {
      name: '18 Séances',
      description: 'Abonnement de 18 séances valable 1 mois',
      monthlyPrice: 200,
      sessionQuota: 18,
      sessionType: 'limited',
      durationMonths: 1,
      features: [
        '18 séances de fitness',
        'Accès à tous les équipements',
        'Valable 1 mois',
        'Suivi de progression',
        '1 séance de coaching offerte'
      ]
    },
    {
      name: '36 Séances',
      description: 'Abonnement de 36 séances valable 2 mois',
      monthlyPrice: 350,
      sessionQuota: 36,
      sessionType: 'limited',
      durationMonths: 2,
      features: [
        '36 séances de fitness',
        'Accès à tous les équipements',
        'Valable 2 mois',
        'Suivi de progression personnalisé',
        '2 séances de coaching offertes',
        'Programme d\'entraînement personnalisé'
      ]
    },
    {
      name: 'Annuel Illimité',
      description: 'Abonnement annuel avec accès illimité',
      monthlyPrice: 1500,
      sessionQuota: null, // null = illimité
      sessionType: 'unlimited',
      durationMonths: 12,
      features: [
        'Accès illimité 7j/7',
        'Tous les équipements',
        'Valable 1 an',
        'Coaching personnalisé mensuel',
        'Suivi nutritionnel',
        'Programme d\'entraînement sur mesure',
        'Accès aux cours collectifs',
        'Priorité sur les réservations'
      ]
    }
  ];

  for (const subType of subscriptionTypes) {
    const displayId = generateSubscriptionTypeId();
    
    const existing = await prisma.subscriptionType.findUnique({
      where: { name: subType.name }
    });

    if (existing) {
      console.log(`⚠️  Type d'abonnement "${subType.name}" existe déjà, mise à jour...`);
      await prisma.subscriptionType.update({
        where: { name: subType.name },
        data: {
          ...subType,
          displayId: existing.displayId
        }
      });
    } else {
      await prisma.subscriptionType.create({
        data: {
          ...subType,
          displayId
        }
      });
      console.log(`✅ Type d'abonnement "${subType.name}" créé`);
    }
  }

  console.log('✅ Types d\'abonnement avec quotas ajoutés/mis à jour');
}

// Exécuter si appelé directement
if (require.main === module) {
  seedSubscriptionTypesWithQuotas()
    .then(() => {
      console.log('✅ Seed terminé');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur lors du seed:', error);
      process.exit(1);
    });
}

module.exports = { seedSubscriptionTypesWithQuotas };
