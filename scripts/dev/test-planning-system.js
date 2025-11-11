// Script de test pour le système de planning d'entraînement
// Utilisation: node scripts/test-planning-system.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Fonction pour obtenir un token JWT d'admin
async function getAdminToken() {
  try {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@teamfitness.com',
        password: 'admin123'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Réponse login:', response.status, errorText);
      throw new Error('Échec de connexion admin');
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.log('❌ Impossible d\'obtenir le token admin:', error.message);
    return null;
  }
}

async function testPlanningSystem() {
  console.log('🧪 Test du système de planning d\'entraînement\n');

  // Obtenir un token admin pour les tests API
  const token = await getAdminToken();
  if (!token) {
    console.log('❌ Impossible de continuer sans token admin');
    return;
  }
  console.log('✅ Token admin obtenu\n');

  try {
    // 1. Créer un exercice de test
    console.log('1️⃣ Création d\'un exercice de test...');
    const exercise = await prisma.exercise.create({
      data: {
        name: 'Push-ups',
        description: 'Classic bodyweight exercise for chest and triceps',
        category: 'strength',
        muscleGroup: ['chest', 'triceps'],
        equipment: ['none'],
        difficulty: 'beginner',
        instructions: 'Start in plank position, lower your body until chest nearly touches floor, then push back up.'
      }
    });
    console.log(`✅ Exercice créé: ${exercise.name} (ID: ${exercise.id})\n`);

    // 2. Créer un planning de test
    console.log('2️⃣ Création d\'un planning de test...');

    // Récupérer un membre existant
    const member = await prisma.member.findFirst({
      include: { user: true }
    });

    if (!member) {
      console.log('❌ Aucun membre trouvé. Veuillez créer un membre d\'abord.');
      return;
    }

    const planningResponse = await fetch('http://localhost:3000/plannings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        memberId: member.userId,
        title: 'Test Planning - Upper Body',
        description: 'Test planning for upper body strength',
        startDate: '2025-11-15',
        endDate: '2025-11-30',
        status: 'active'
      })
    });

    if (!planningResponse.ok) {
      console.log('❌ Échec création planning:', await planningResponse.text());
      return;
    }

    const planningData = await planningResponse.json();
    const planning = planningData.planning;

    console.log(`✅ Planning créé: ${planning.title} (ID: ${planning.id})`);
    console.log(`   Pour membre: ${member.user.fullName}`);
    console.log(`   Par coach: Admin TeamFitness\n`);

    // 3. Ajouter des exercices au planning pour différents jours
    console.log('3️⃣ Ajout d\'exercices au planning...');

    const exercisesData = [
      { dayOfWeek: 1, sets: 3, reps: 12, notes: 'Monday - Chest focus' },
      { dayOfWeek: 3, sets: 4, reps: 10, notes: 'Wednesday - Back focus' },
      { dayOfWeek: 5, sets: 3, reps: 15, notes: 'Friday - Endurance' }
    ];

    for (const exData of exercisesData) {
      const response = await fetch(`http://localhost:3000/plannings/${planning.id}/days/${exData.dayOfWeek}/exercises`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exerciseId: exercise.id,
          sets: exData.sets,
          reps: exData.reps,
          notes: exData.notes,
          order: 1
        })
      });

      if (!response.ok) {
        console.log(`❌ Échec ajout exercice jour ${exData.dayOfWeek}:`, await response.text());
      } else {
        const result = await response.json();
        console.log(`✅ Exercice ajouté: ${result.planningExercise.exercise.name} le ${dayNames[exData.dayOfWeek]} (${exData.sets} séries x ${exData.reps} reps)`);
      }
    }
    console.log('');

    // 4. Récupérer le planning complet
    console.log('4️⃣ Récupération du planning complet...');

    const response = await fetch(`http://localhost:3000/plannings/${planning.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.log('❌ Échec récupération planning:', await response.text());
      return;
    }

    const fullPlanning = await response.json();
    console.log(`📋 Planning: ${fullPlanning.title}`);
    console.log(`👤 Membre: ${fullPlanning.member.user.fullName}`);
    console.log(`🏋️ Coach: ${fullPlanning.coach.fullName}`);
    console.log(`📅 Période: ${fullPlanning.startDate} - ${fullPlanning.endDate}`);
    console.log(`📝 Exercices par jour:`);

    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    if (fullPlanning.days && fullPlanning.days.length > 0) {
      fullPlanning.days.forEach(day => {
        console.log(`\n${dayNames[day.dayOfWeek]}:`);
        if (day.exercises && day.exercises.length > 0) {
          day.exercises.forEach(ex => {
            console.log(`   ${ex.exercise.name} - ${ex.sets} séries x ${ex.reps} reps`);
            if (ex.notes) console.log(`      📝 ${ex.notes}`);
          });
        } else {
          console.log(`   (Aucun exercice)`);
        }
      });
    } else {
      console.log(`   (Aucun jour défini)`);
    }

    console.log('\n🎉 Test du système de planning terminé avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testPlanningSystem();