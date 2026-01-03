const nodemailer = require('nodemailer');

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour autres ports
  auth: {
    user: process.env.SMTP_USER, // email
    pass: process.env.SMTP_PASS, // mot de passe ou app password
  },
  tls: {
    rejectUnauthorized: false // Pour éviter les erreurs de certificat en dev
  },
  // Configuration additionnelle pour debug
  debug: process.env.NODE_ENV !== 'production', // Active le debug en dev/preprod
  logger: process.env.NODE_ENV !== 'production', // Active les logs en dev/preprod
});

// Vérifier la connexion SMTP au démarrage
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Erreur de configuration SMTP:', error);
    console.error('   Vérifiez vos variables SMTP_HOST, SMTP_USER, SMTP_PASS');
  } else {
    console.log('✅ Serveur SMTP prêt à envoyer des emails');
  }
});

// Fonction pour envoyer un email de réinitialisation ou d'activation
async function sendPasswordResetEmail(email, resetToken, isSetup = false) {
  console.log(`\n📧 SERVICE: Envoi email ${isSetup ? 'activation' : 'réinitialisation'}`);
  console.log(`   Destinataire: ${email}`);
  console.log(`   Token: ${resetToken}`);
  console.log(`   Type: ${isSetup ? 'Activation compte' : 'Réinitialisation mot de passe'}`);
  
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  const resetUrl = isSetup 
    ? `${baseUrl}/setup-password?token=${resetToken}`
    : `${baseUrl}/reset-password?token=${resetToken}`;
  const logoUrl = `${baseUrl}/android/assets/logo.png`;

  console.log(`🔗 URL générée: ${resetUrl}`);

  const mobileAppLink = process.env.MOBILE_APP_LINK || '';
  
  const mailOptions = isSetup ? {
    from: process.env.NO_REPLY_EMAIL,
    to: email,
    subject: '🎉 Bienvenue sur Team Fitness - Créez votre mot de passe',
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #374151 0%, #1a202c 100%);">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #374151 0%, #1a202c 100%); padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid rgba(255, 255, 255, 0.1);">
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(232, 149, 71, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);">
                    <img src="${logoUrl}" alt="Team Fitness" style="width: 80px; height: 80px; margin-bottom: 20px;">
                    <h1 style="color: #e89547; margin: 0; font-size: 32px; font-weight: 700;">Team Fitness</h1>
                    <p style="color: #f4a261; margin: 10px 0 0 0; font-size: 14px;">Bienvenue ! 🎉</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px; color: #e5e7eb;">
                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.8; margin: 20px 0;">Votre compte a été créé avec succès. Pour finaliser votre inscription, vous devez créer votre mot de passe.</p>
                    <div style="background: rgba(232, 149, 71, 0.1); border-left: 4px solid #e89547; padding: 20px; margin: 30px 0; border-radius: 8px;">
                      <p style="margin: 0; color: #e89547; font-size: 16px; font-weight: 600; margin-bottom: 10px;">🔐 Votre code d'activation :</p>
                      <p style="margin: 0; font-size: 32px; font-weight: bold; color: #f4a261; letter-spacing: 3px;">${resetToken}</p>
                    </div>
                    ${mobileAppLink ? `
                    <div style="background: linear-gradient(135deg, rgba(232, 149, 71, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%); border: 2px solid rgba(232, 149, 71, 0.3); border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                      <p style="margin: 0 0 20px 0; color: #f4a261; font-size: 18px; font-weight: 600;">📱 Pour créer votre mot de passe</p>
                      <a href="${mobileAppLink}" style="background: linear-gradient(135deg, #e89547 0%, #f59e0b 100%); color: #1a202c; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(232, 149, 71, 0.3);">Ouvrir l'application →</a>
                      <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 14px;">Cliquez sur le bouton, puis entrez votre code</p>
                    </div>
                    ` : `
                    <div style="text-align: center; margin: 25px 0; padding: 20px; background-color: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                      <p style="margin: 0; color: #d1d5db; font-size: 16px; font-weight: bold;">Pour créer votre mot de passe, entrez ce code dans l'application mobile Team Fitness</p>
                    </div>
                    `}
                    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 16px; margin-top: 30px;">
                      <p style="margin: 0; color: #fcd34d; font-size: 14px;">⏱️ <strong>Important :</strong> Ce code expire dans 24 heures.</p>
                    </div>
                    <p style="color: #9ca3af; font-size: 14px; margin-top: 30px; text-align: center;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: rgba(0, 0, 0, 0.2); padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <p style="margin: 0; color: #9ca3af; font-size: 13px;">© ${new Date().getFullYear()} Team Fitness. Tous droits réservés.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  } : {
    from: process.env.NO_REPLY_EMAIL,
    to: email,
    subject: '🔐 Réinitialisation de votre mot de passe - Team Fitness',
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #374151 0%, #1a202c 100%);">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #374151 0%, #1a202c 100%); padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid rgba(255, 255, 255, 0.1);">
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(232, 149, 71, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);">
                    <img src="${logoUrl}" alt="Team Fitness" style="width: 80px; height: 80px; margin-bottom: 20px;">
                    <h1 style="color: #e89547; margin: 0; font-size: 32px; font-weight: 700;">Team Fitness</h1>
                    <p style="color: #f4a261; margin: 10px 0 0 0; font-size: 14px;">Réinitialisation mot de passe</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px; color: #e5e7eb;">
                    <h2 style="color: #e89547; margin-top: 0; font-size: 24px;">Réinitialisation de mot de passe</h2>
                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.8;">Vous avez demandé la réinitialisation de votre mot de passe.</p>
                    <div style="background: rgba(232, 149, 71, 0.1); border-left: 4px solid #e89547; padding: 20px; margin: 30px 0; border-radius: 8px;">
                      <p style="margin: 0; color: #e89547; font-size: 16px; font-weight: 600; margin-bottom: 10px;">🔑 Votre code de vérification :</p>
                      <p style="margin: 0; font-size: 32px; font-weight: bold; color: #f4a261; letter-spacing: 3px;">${resetToken}</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                      <p style="margin: 0 0 15px 0; color: #d1d5db; font-size: 15px;">Ou cliquez sur le lien ci-dessous :</p>
                      <a href="${resetUrl}" style="background: linear-gradient(135deg, #e89547 0%, #f59e0b 100%); color: #1a202c; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(232, 149, 71, 0.3);">Réinitialiser le mot de passe →</a>
                    </div>
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 16px; margin-top: 30px;">
                      <p style="margin: 0; color: #fca5a5; font-size: 14px;">⏱️ <strong style="color: #ef4444;">Important :</strong> Ce lien expire dans 1 heure.</p>
                    </div>
                    <p style="color: #9ca3af; font-size: 14px; margin-top: 30px; text-align: center;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: rgba(0, 0, 0, 0.2); padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <p style="margin: 0; color: #9ca3af; font-size: 13px;">© ${new Date().getFullYear()} Team Fitness. Tous droits réservés.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  console.log(`📬 Configuration email:`);
  console.log(`   From: ${mailOptions.from}`);
  console.log(`   To: ${mailOptions.to}`);
  console.log(`   Subject: ${mailOptions.subject}`);

  try {
    console.log(`🔄 Envoi email en cours...`);
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email ${isSetup ? "d'activation" : "de réinitialisation"} envoyé avec succès à: ${email}`);
    console.log(`📤 Retour service: email envoyé\n`);
  } catch (error) {
    console.error('💥 Erreur envoi email:', error);
    console.error(`   Code erreur: ${error.code}`);
    console.error(`   Message: ${error.message}`);
    throw new Error('Erreur lors de l\'envoi de l\'email');
  }
}

// Fonction pour envoyer un email de bienvenue avec lien de configuration
async function sendAccountSetupEmail(email, fullName, setupToken) {
  console.log(`\n📧 SERVICE: Envoi email de configuration de compte`);
  console.log(`   Destinataire: ${email}`);
  console.log(`   Nom: ${fullName}`);
  console.log(`   Token: ${setupToken}`);
  
  // Utiliser API_URL pour pointer vers le backend qui sert setup-password.html
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  const setupUrl = `${baseUrl}/setup-password.html?email=${encodeURIComponent(email)}&token=${setupToken}`;
  const mobileAppLink = process.env.MOBILE_APP_LINK || '';
  const logoUrl = `${baseUrl}/android/assets/logo.png`;

  console.log(`🔗 URL de configuration: ${setupUrl}`);
  console.log(`📱 Lien app mobile: ${mobileAppLink || 'Non configuré'}`);

  const mailOptions = {
    from: `"Team Fitness" <no-reply@team-oustad.com>`,
    to: email,
    subject: '🎉 Bienvenue sur Team Fitness - Configurez votre compte',
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #374151 0%, #1a202c 100%);">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #374151 0%, #1a202c 100%); padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid rgba(255, 255, 255, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(232, 149, 71, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);">
                    <img src="${logoUrl}" alt="Team Fitness" style="width: 80px; height: 80px; margin-bottom: 20px;">
                    <h1 style="color: #e89547; margin: 0; font-size: 32px; font-weight: 700;">Team Fitness</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px; color: #e5e7eb;">
                    <h2 style="color: #e89547; margin-top: 0; font-size: 26px; font-weight: 600;">Bienvenue ${fullName} ! 🎉</h2>
                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.8; margin: 20px 0;">
                      Votre compte Team Fitness a été créé avec succès. Pour commencer à utiliser votre compte, 
                      vous devez créer votre mot de passe.
                    </p>
                    
                    <div style="background: rgba(232, 149, 71, 0.1); border-left: 4px solid #e89547; padding: 20px; margin: 30px 0; border-radius: 8px;">
                      <p style="margin: 0; color: #e89547; font-size: 16px; font-weight: 600; margin-bottom: 10px;">
                        <strong>Votre code de configuration :</strong>
                      </p>
                      <p style="margin: 0; font-size: 32px; font-weight: bold; color: #f4a261; letter-spacing: 3px;">
                        ${setupToken}
                      </p>
                    </div>
                    
                    ${mobileAppLink ? `
                    <div style="background: linear-gradient(135deg, rgba(232, 149, 71, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%); border: 2px solid rgba(232, 149, 71, 0.3); border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                      <p style="margin: 0 0 20px 0; color: #f4a261; font-size: 18px; font-weight: 600;">
                        📱 Pour créer votre mot de passe
                      </p>
                      <a href="${mobileAppLink}" 
                         style="background: linear-gradient(135deg, #e89547 0%, #f59e0b 100%); color: #1a202c; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(232, 149, 71, 0.3);">
                        🚀 Ouvrir l'application Team Fitness
                      </a>
                      <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 14px;">
                        Cliquez sur le bouton ci-dessus, puis entrez votre code de configuration dans l'app
                      </p>
                    </div>
                    ` : `
                    <div style="text-align: center; margin: 25px 0; padding: 20px; background-color: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                      <p style="margin: 0; color: #d1d5db; font-size: 16px; font-weight: bold;">
                        Pour créer votre mot de passe, entrez ce code dans l'application mobile Team Fitness
                      </p>
                    </div>
                    `}
                    
                    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 16px; margin-top: 30px;">
                      <p style="margin: 0; color: #fcd34d; font-size: 14px;">
                        ⏱️ <strong>Important :</strong> Ce lien expire dans 24 heures pour des raisons de sécurité.
                      </p>
                    </div>
                    
                    <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin-top: 30px; text-align: center;">
                      Si vous n'avez pas créé de compte sur Team Fitness, ignorez simplement cet email.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: rgba(0, 0, 0, 0.2); padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                      © ${new Date().getFullYear()} Team Fitness. Tous droits réservés.
                    </p>
                    <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 12px;">
                      Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
Bienvenue sur Team Fitness, ${fullName} !

Votre compte a été créé avec succès. Pour finaliser votre inscription, veuillez créer votre mot de passe.

Votre code de configuration : ${setupToken}

Ou visitez ce lien : ${setupUrl}

Ce lien expire dans 24 heures.

Si vous n'avez pas créé de compte, ignorez cet email.

---
Team Fitness
© ${new Date().getFullYear()}
    `.trim(),
  };

  console.log(`📬 Configuration email:`);
  console.log(`   From: ${mailOptions.from}`);
  console.log(`   To: ${mailOptions.to}`);
  console.log(`   Subject: ${mailOptions.subject}`);

  try {
    console.log(`🔄 Envoi email en cours...`);
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de configuration envoyé avec succès à: ${email}`);
    console.log(`📤 Retour service: email envoyé\n`);
    return { success: true };
  } catch (error) {
    console.error('💥 Erreur envoi email:', error);
    console.error(`   Code erreur: ${error.code}`);
    console.error(`   Message: ${error.message}`);
    throw new Error('Erreur lors de l\'envoi de l\'email');
  }
}

// Fonction pour envoyer un email d'invitation à l'accès anticipé bêta
async function sendBetaAccessEmail(email, fullName) {
  console.log(`\n📧 SERVICE: Envoi email d'accès bêta`);
  console.log(`   Destinataire: ${email}`);
  console.log(`   Nom: ${fullName}`);
  
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  const betaUrl = `${baseUrl}/android/beta/`;
  const logoUrl = `${baseUrl}/android/assets/logo.png`;

  console.log(`🔗 URL bêta: ${betaUrl}`);

  const mailOptions = {
    from: `"Team Fitness" <no-reply@team-oustad.com>`,
    to: email,
    subject: '🎉 Vous êtes invité(e) à la Bêta Team Fitness !',
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #374151 0%, #1a202c 100%);">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #374151 0%, #1a202c 100%); padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid rgba(255, 255, 255, 0.1);">
                
                <!-- Header avec logo -->
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);">
                    <img src="${logoUrl}" alt="Team Fitness" style="width: 80px; height: 80px; margin-bottom: 20px;">
                    <h1 style="color: #fbbf24; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                      Team Fitness
                    </h1>
                    <p style="color: #fcd34d; margin: 10px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">
                      Accès Anticipé Bêta
                    </p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px; color: #e5e7eb;">
                    <h2 style="color: #fbbf24; margin-top: 0; font-size: 26px; font-weight: 600;">
                      Bonjour ${fullName} ! 🎉
                    </h2>
                    
                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.8; margin: 20px 0;">
                      Félicitations ! Vous avez été sélectionné(e) pour rejoindre le programme d'<strong style="color: #fbbf24;">accès anticipé bêta</strong> de l'application Team Fitness.
                    </p>
                    
                    <div style="background: rgba(251, 191, 36, 0.1); border-left: 4px solid #fbbf24; padding: 20px; margin: 30px 0; border-radius: 8px;">
                      <p style="margin: 0; color: #fbbf24; font-size: 16px; font-weight: 600; margin-bottom: 10px;">
                        🚀 Pourquoi vous ?
                      </p>
                      <p style="margin: 0; color: #d1d5db; font-size: 15px; line-height: 1.6;">
                        Vous faites partie des premiers à découvrir nos dernières fonctionnalités en avant-première. Votre feedback sera essentiel pour façonner l'avenir de Team Fitness.
                      </p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%); border: 2px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                      <p style="margin: 0 0 20px 0; color: #fcd34d; font-size: 18px; font-weight: 600;">
                        📱 Téléchargez la version bêta
                      </p>
                      <a href="${betaUrl}" 
                         style="background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%); color: #1a202c; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3); transition: all 0.3s;">
                        Rejoindre la Bêta →
                      </a>
                      <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 14px;">
                        Testez en exclusivité les nouvelles fonctionnalités
                      </p>
                    </div>
                    
                    <div style="background: rgba(245, 158, 11, 0.08); border-radius: 8px; padding: 20px; margin: 30px 0;">
                      <p style="margin: 0 0 15px 0; color: #fbbf24; font-size: 16px; font-weight: 600;">
                        ⭐ Ce que vous allez découvrir :
                      </p>
                      <ul style="margin: 0; padding-left: 20px; color: #d1d5db; font-size: 15px; line-height: 1.8;">
                        <li style="margin-bottom: 8px;">Nouvelles fonctionnalités avant tout le monde</li>
                        <li style="margin-bottom: 8px;">Interface améliorée et optimisée</li>
                        <li style="margin-bottom: 8px;">Impact direct sur le développement</li>
                        <li style="margin-bottom: 0;">Support prioritaire de l'équipe</li>
                      </ul>
                    </div>
                    
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 16px; margin-top: 30px;">
                      <p style="margin: 0; color: #fca5a5; font-size: 14px; line-height: 1.6;">
                        <strong style="color: #ef4444;">⚠️ Note importante :</strong> Cette version bêta peut contenir des bugs. Votre feedback nous aidera à créer une expérience parfaite !
                      </p>
                    </div>
                    
                    <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin-top: 30px; text-align: center;">
                      Merci de faire partie de l'aventure Team Fitness ! 💪
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: rgba(0, 0, 0, 0.2); padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                      © ${new Date().getFullYear()} Team Fitness. Tous droits réservés.
                    </p>
                    <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 12px;">
                      Cet email a été envoyé car vous avez été sélectionné(e) pour l'accès bêta.
                    </p>
                    <div style="margin-top: 20px;">
                      <span style="display: inline-block; width: 8px; height: 8px; background-color: #fbbf24; border-radius: 50%; margin: 0 5px; box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);"></span>
                      <span style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Canal Bêta</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
🎉 Vous êtes invité(e) à la Bêta Team Fitness !

Bonjour ${fullName},

Félicitations ! Vous avez été sélectionné(e) pour rejoindre le programme d'accès anticipé bêta de l'application Team Fitness.

🚀 Pourquoi vous ?
Vous faites partie des premiers à découvrir nos dernières fonctionnalités en avant-première. Votre feedback sera essentiel pour façonner l'avenir de Team Fitness.

📱 Téléchargez la version bêta :
${betaUrl}

⭐ Ce que vous allez découvrir :
• Nouvelles fonctionnalités avant tout le monde
• Interface améliorée et optimisée
• Impact direct sur le développement
• Support prioritaire de l'équipe

⚠️ Note importante : Cette version bêta peut contenir des bugs. Votre feedback nous aidera à créer une expérience parfaite !

Merci de faire partie de l'aventure Team Fitness ! 💪

---
Team Fitness
© ${new Date().getFullYear()}
    `.trim(),
  };

  console.log(`📬 Configuration email:`);
  console.log(`   From: ${mailOptions.from}`);
  console.log(`   To: ${mailOptions.to}`);
  console.log(`   Subject: ${mailOptions.subject}`);

  try {
    console.log(`🔄 Envoi email en cours...`);
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email d'accès bêta envoyé avec succès à: ${email}`);
    console.log(`📤 Retour service: email envoyé\n`);
    return { success: true };
  } catch (error) {
    console.error('💥 Erreur envoi email:', error);
    console.error(`   Code erreur: ${error.code}`);
    console.error(`   Message: ${error.message}`);
    throw new Error('Erreur lors de l\'envoi de l\'email');
  }
}

/**
 * Envoie un email d'alerte quota bas
 */
async function sendLowQuotaEmail(email, data) {
  console.log(`\n📧 SERVICE: Envoi email alerte quota bas`);
  console.log(`   Destinataire: ${email}`);
  console.log(`   Séances restantes: ${data.sessionsRemaining}/${data.sessionQuota}`);
  
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  const logoUrl = `${baseUrl}/android/assets/logo.png`;

  const mailOptions = {
    from: `"Team Fitness" <no-reply@team-oustad.com>`,
    to: email,
    subject: '⚠️ Quota de séances faible - Team Fitness',
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #374151 0%, #1a202c 100%);">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #374151 0%, #1a202c 100%); padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid rgba(255, 255, 255, 0.1);">
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(245, 101, 101, 0.1) 100%);">
                    <img src="${logoUrl}" alt="Team Fitness" style="width: 80px; height: 80px; margin-bottom: 20px;">
                    <h1 style="color: #e89547; margin: 0; font-size: 32px; font-weight: 700;">Team Fitness</h1>
                    <p style="color: #fca5a5; margin: 10px 0 0 0; font-size: 14px;">⚠️ Alerte Quota</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px; color: #e5e7eb;">
                    <h2 style="color: #ef4444; margin-top: 0; font-size: 24px;">Votre quota de séances est faible</h2>
                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.8;">Bonjour ${data.firstName} ${data.lastName},</p>
                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.8;">Nous vous informons que votre quota de séances arrive bientôt à épuisement.</p>
                    
                    <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 20px; margin: 30px 0; border-radius: 8px;">
                      <p style="margin: 0; color: #fca5a5; font-size: 16px; font-weight: 600; margin-bottom: 15px;">📊 État de votre abonnement :</p>
                      <table style="width: 100%; color: #e5e7eb;">
                        <tr>
                          <td style="padding: 8px 0; color: #9ca3af;">Type d'abonnement :</td>
                          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #e89547;">${data.subscriptionType}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #9ca3af;">Séances restantes :</td>
                          <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 20px; color: #ef4444;">${data.sessionsRemaining} / ${data.sessionQuota}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #9ca3af;">Pourcentage restant :</td>
                          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${data.percentageRemaining < 15 ? '#ef4444' : '#f97316'};">${data.percentageRemaining}%</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #9ca3af;">Date de fin :</td>
                          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #d1d5db;">${new Date(data.endDate).toLocaleDateString('fr-FR')}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="background: rgba(232, 149, 71, 0.1); border: 1px solid rgba(232, 149, 71, 0.3); border-radius: 8px; padding: 20px; margin: 30px 0;">
                      <p style="margin: 0; color: #f4a261; font-size: 15px; line-height: 1.6;">
                        💡 <strong style="color: #e89547;">Astuce :</strong> Pour continuer à profiter pleinement de nos installations, pensez à renouveler votre abonnement avant l'épuisement de votre quota !
                      </p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <p style="margin: 0 0 15px 0; color: #d1d5db; font-size: 15px;">Contactez-nous pour renouveler :</p>
                      <a href="mailto:${process.env.SMTP_USER}" style="background: linear-gradient(135deg, #e89547 0%, #f59e0b 100%); color: #1a202c; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(232, 149, 71, 0.3); margin-right: 10px;">📧 Nous contacter</a>
                    </div>

                    <p style="color: #9ca3af; font-size: 14px; margin-top: 30px; text-align: center; line-height: 1.6;">
                      Merci de votre confiance et à très bientôt à Team Fitness ! 💪
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: rgba(0, 0, 0, 0.2); padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <p style="margin: 0; color: #9ca3af; font-size: 13px;">© ${new Date().getFullYear()} Team Fitness. Tous droits réservés.</p>
                    <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">Cet email est un rappel automatique pour votre confort.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    console.log(`🔄 Envoi email en cours...`);
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email alerte quota envoyé avec succès à: ${email}`);
    return { success: true };
  } catch (error) {
    console.error('💥 Erreur envoi email:', error);
    throw new Error('Erreur lors de l\'envoi de l\'email');
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendAccountSetupEmail,
  sendBetaAccessEmail,
  sendLowQuotaEmail,
};