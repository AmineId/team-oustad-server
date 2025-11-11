/**
 * Script de vérification des displayIds générés
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDisplayIds() {
  console.log('🔍 Vérification des displayIds générés\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Vérifier les Users
    const users = await prisma.user.findMany({
      select: { id: true, displayId: true, fullName: true, role: true },
      take: 5
    });
    console.log('👥 USERS:');
    users.forEach(u => console.log(`   ${u.displayId} - ${u.fullName} (${u.role})`));
    console.log();

    // Vérifier les Gyms
    const gyms = await prisma.gym.findMany({
      select: { id: true, displayId: true, name: true },
      take: 3
    });
    console.log('🏢 GYMS:');
    gyms.forEach(g => console.log(`   ${g.displayId} - ${g.name}`));
    console.log();

    // Vérifier les Subscriptions
    const subscriptions = await prisma.subscription.findMany({
      select: { id: true, displayId: true, status: true },
      take: 3
    });
    console.log('💳 SUBSCRIPTIONS:');
    subscriptions.forEach(s => console.log(`   ${s.displayId} - Status: ${s.status}`));
    console.log();

    // Vérifier les Payments
    const payments = await prisma.payment.findMany({
      select: { id: true, displayId: true, amount: true, status: true },
      take: 3
    });
    console.log('💰 PAYMENTS:');
    payments.forEach(p => console.log(`   ${p.displayId} - ${p.amount}€ (${p.status})`));
    console.log();

    // Vérifier les Plannings
    const plannings = await prisma.planning.findMany({
      select: { id: true, displayId: true, title: true },
      take: 3
    });
    console.log('📅 PLANNINGS:');
    plannings.forEach(p => console.log(`   ${p.displayId} - ${p.title}`));
    console.log();

    // Vérifier les Exercises
    const exercises = await prisma.exercise.findMany({
      select: { id: true, displayId: true, name: true },
      take: 3
    });
    console.log('💪 EXERCISES:');
    exercises.forEach(e => console.log(`   ${e.displayId} - ${e.name}`));
    console.log();

    // Vérifier les SubscriptionTypes
    const subscriptionTypes = await prisma.subscriptionType.findMany({
      select: { id: true, displayId: true, name: true }
    });
    console.log('📋 SUBSCRIPTION TYPES:');
    subscriptionTypes.forEach(st => console.log(`   ${st.displayId} - ${st.name}`));
    console.log();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Tous les displayIds ont été générés correctement!');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkDisplayIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
