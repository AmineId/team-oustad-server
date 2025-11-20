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
  
  const resetUrl = isSetup 
    ? `${process.env.API_URL || 'http://localhost:3000'}/setup-password?token=${resetToken}`
    : `${process.env.API_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  console.log(`🔗 URL générée: ${resetUrl}`);

  const mobileAppLink = process.env.MOBILE_APP_LINK || '';
  
  const mailOptions = isSetup ? {
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Bienvenue sur Team Fitness - Créez votre mot de passe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Bienvenue sur Team Fitness ! 🎉</h2>
        <p>Votre compte a été créé avec succès. Pour finaliser votre inscription, vous devez créer votre mot de passe.</p>
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #333; font-weight: bold;">🔐 Votre code d'activation :</p>
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #28a745; letter-spacing: 2px;">${resetToken}</p>
        </div>
        
        ${mobileAppLink ? `
        <div style="background-color: #e8f5e9; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 15px 0; color: #2e7d32; font-size: 16px; font-weight: bold;">📱 Pour créer votre mot de passe :</p>
          <a href="${mobileAppLink}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; font-weight: bold;">Ouvrir l'application Team Fitness</a>
          <p style="margin: 15px 0 0 0; font-size: 13px; color: #666;">Cliquez sur le bouton ci-dessus, puis entrez votre code d'activation dans l'app</p>
        </div>
        ` : `
        <div style="text-align: center; margin: 20px 0;">
          <p style="margin: 0 0 15px 0; color: #333; font-weight: bold;">Pour créer votre mot de passe, entrez ce code dans l'application mobile Team Fitness</p>
        </div>
        `}
        
        <p style="margin-top: 25px; font-size: 13px; color: #999;">⏱️ Ce code expire dans 24 heures.</p>
        <p style="font-size: 13px; color: #999;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
      </div>
    `,
  } : {
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Réinitialisation de votre mot de passe - Team Fitness',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Réinitialisation de mot de passe</h2>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p>Votre code de vérification est : <strong style="font-size: 18px; color: #007bff;">${resetToken}</strong></p>
        <p>Ou cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
        <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">Réinitialiser le mot de passe</a>
        <p><small>Ce lien expire dans 1 heure.</small></p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      </div>
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

  console.log(`🔗 URL de configuration: ${setupUrl}`);
  console.log(`📱 Lien app mobile: ${mobileAppLink || 'Non configuré'}`);

  const mailOptions = {
    from: `"Team Fitness" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '🎉 Bienvenue sur Team Fitness - Configurez votre compte',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏋️ Team Fitness</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; margin-top: 0; font-size: 24px;">Bienvenue ${fullName} ! 🎉</h2>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                      Votre compte Team Fitness a été créé avec succès. Pour commencer à utiliser votre compte, 
                      vous devez créer votre mot de passe.
                    </p>
                    
                    <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 25px 0;">
                      <p style="margin: 0; color: #333333; font-size: 14px;">
                        <strong>Votre code de configuration :</strong>
                      </p>
                      <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 3px;">
                        ${setupToken}
                      </p>
                    </div>
                    
                    ${mobileAppLink ? `
                    <div style="background-color: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                      <p style="margin: 0 0 15px 0; color: #2e7d32; font-size: 18px; font-weight: bold;">
                        📱 Pour créer votre mot de passe
                      </p>
                      <a href="${mobileAppLink}" 
                         style="background-color: #4caf50; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; font-weight: bold; margin: 10px 0;">
                        🚀 Ouvrir l'application Team Fitness
                      </a>
                      <p style="margin: 15px 0 0 0; color: #666666; font-size: 14px;">
                        Cliquez sur le bouton ci-dessus, puis entrez votre code de configuration dans l'app
                      </p>
                    </div>
                    ` : `
                    <div style="text-align: center; margin: 25px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                      <p style="margin: 0; color: #333333; font-size: 16px; font-weight: bold;">
                        Pour créer votre mot de passe, entrez ce code dans l'application mobile Team Fitness
                      </p>
                    </div>
                    `}
                    
                    <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin-top: 25px;">
                      <p style="margin: 0; color: #856404; font-size: 14px;">
                        ⏱️ <strong>Important :</strong> Ce lien expire dans 24 heures pour des raisons de sécurité.
                      </p>
                    </div>
                    
                    <p style="color: #999999; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                      Si vous n'avez pas créé de compte sur Team Fitness, ignorez simplement cet email.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="margin: 0; color: #6c757d; font-size: 12px;">
                      © ${new Date().getFullYear()} Team Fitness. Tous droits réservés.
                    </p>
                    <p style="margin: 10px 0 0 0; color: #6c757d; font-size: 12px;">
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

module.exports = {
  sendPasswordResetEmail,
  sendAccountSetupEmail,
};