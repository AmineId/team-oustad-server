#!/usr/bin/env node

/**
 * SMTP Connection Test Script
 * 
 * Ce script teste la connexion SMTP sans envoyer d'email réel.
 * Utile pour vérifier la configuration avant de redémarrer le serveur.
 * 
 * Usage:
 *   node scripts/test-smtp.js
 *   node scripts/test-smtp.js preprod  # Teste avec .env.preprod
 *   node scripts/test-smtp.js prod     # Teste avec .env.prod
 */

const nodemailer = require('nodemailer');
const path = require('path');

// Déterminer quel fichier .env utiliser
const envArg = process.argv[2];
const envFile = envArg ? `.env.${envArg}` : '.env';

console.log(`\n🔍 Test de la configuration SMTP`);
console.log(`📄 Fichier de configuration: ${envFile}\n`);

// Charger les variables d'environnement
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

// Vérifier que les variables sont définies
const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('❌ Variables d\'environnement manquantes:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error(`\n💡 Vérifiez votre fichier ${envFile}\n`);
  process.exit(1);
}

// Afficher la configuration (masquer le mot de passe)
console.log('📋 Configuration SMTP:');
console.log(`   Host: ${process.env.SMTP_HOST}`);
console.log(`   Port: ${process.env.SMTP_PORT}`);
console.log(`   Secure: ${process.env.SMTP_SECURE || 'false'}`);
console.log(`   User: ${process.env.SMTP_USER}`);
console.log(`   Pass: ${process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-8) : 'NON DÉFINI'}`);
console.log('');

// Créer le transporteur
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  },
  debug: true,
  logger: true,
});

// Tester la connexion
console.log('🔄 Test de connexion au serveur SMTP...\n');

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ ÉCHEC DE LA CONNEXION SMTP\n');
    console.error('Détails de l\'erreur:');
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error(`   Message: ${error.message}`);
    console.error(`   Response: ${error.response || 'N/A'}`);
    
    console.error('\n📚 Solutions possibles:\n');
    
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      console.error('🔐 Erreur d\'authentification (EAUTH):');
      console.error('   1. Vérifiez que SMTP_USER et SMTP_PASS sont corrects');
      console.error('   2. Pour Brevo: générez une nouvelle clé SMTP sur https://app.brevo.com/settings/keys/smtp');
      console.error('   3. Pour Gmail: utilisez un mot de passe d\'application (https://myaccount.google.com/apppasswords)');
      console.error('   4. Vérifiez que l\'email expéditeur est validé sur la plateforme SMTP');
    } else if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
      console.error('🌐 Erreur de connexion réseau:');
      console.error('   1. Vérifiez que SMTP_HOST et SMTP_PORT sont corrects');
      console.error('   2. Vérifiez votre connexion internet');
      console.error('   3. Vérifiez les règles de pare-feu');
    } else if (error.code === 'ECONNECTION') {
      console.error('🔌 Impossible de se connecter:');
      console.error('   1. Le serveur SMTP est peut-être indisponible');
      console.error('   2. Vérifiez SMTP_HOST et SMTP_PORT');
      console.error('   3. Essayez avec SMTP_SECURE=true si port 465, false si 587');
    }
    
    console.error('\n💡 Pour plus d\'aide, consultez:');
    console.error('   docs/bugfix/SMTP_AUTH_FAILURE_FIX.md\n');
    
    process.exit(1);
  } else {
    console.log('✅ CONNEXION SMTP RÉUSSIE!\n');
    console.log('Le serveur SMTP est correctement configuré et prêt à envoyer des emails.');
    console.log('Vous pouvez maintenant:');
    console.log('   - Redémarrer votre application avec: pm2 restart teamfitness-preprod');
    console.log('   - Ou tester un envoi d\'email avec: node scripts/test-smtp.js --send\n');
    
    // Si l'utilisateur veut tester un envoi réel
    if (process.argv.includes('--send')) {
      console.log('📧 Envoi d\'un email de test...\n');
      
      const testEmail = process.argv[process.argv.indexOf('--send') + 1] || process.env.SMTP_USER;
      
      const mailOptions = {
        from: `"Team Fitness Test" <${process.env.SMTP_USER}>`,
        to: testEmail,
        subject: '✅ Test SMTP - Team Fitness',
        text: 'Si vous recevez cet email, la configuration SMTP fonctionne correctement!',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #28a745;">✅ Test SMTP Réussi!</h2>
            <p>Si vous recevez cet email, cela signifie que votre configuration SMTP fonctionne correctement.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              <strong>Configuration testée:</strong><br>
              Host: ${process.env.SMTP_HOST}<br>
              Port: ${process.env.SMTP_PORT}<br>
              User: ${process.env.SMTP_USER}<br>
              Environment: ${envFile}
            </p>
          </div>
        `,
      };
      
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('❌ Erreur lors de l\'envoi de l\'email de test:');
          console.error(error);
          process.exit(1);
        } else {
          console.log('✅ Email de test envoyé avec succès!');
          console.log(`   MessageId: ${info.messageId}`);
          console.log(`   Destinataire: ${testEmail}\n`);
          process.exit(0);
        }
      });
    } else {
      process.exit(0);
    }
  }
});

// Timeout de sécurité (30 secondes)
setTimeout(() => {
  console.error('\n⏱️  Timeout: Le test a pris trop de temps (30s)');
  console.error('Le serveur SMTP ne répond pas ou est très lent.\n');
  process.exit(1);
}, 30000);
