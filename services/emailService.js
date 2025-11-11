const nodemailer = require('nodemailer');

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true pour 465, false pour autres ports
  auth: {
    user: process.env.SMTP_USER, // email
    pass: process.env.SMTP_PASS, // mot de passe ou app password
  },
});

// Fonction pour envoyer un email de réinitialisation ou d'activation
async function sendPasswordResetEmail(email, resetToken, isSetup = false) {
  const resetUrl = isSetup 
    ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/setup-password?token=${resetToken}`
    : `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const mailOptions = isSetup ? {
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Bienvenue sur Team Fitness - Créez votre mot de passe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Bienvenue sur Team Fitness ! 🎉</h2>
        <p>Votre compte a été créé avec succès. Pour finaliser votre inscription, veuillez créer votre mot de passe.</p>
        <p>Votre code d'activation est : <strong style="font-size: 18px; color: #28a745;">${resetToken}</strong></p>
        <p>Ou cliquez sur le lien ci-dessous pour créer votre mot de passe :</p>
        <a href="${resetUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">Créer mon mot de passe</a>
        <p><small>Ce lien expire dans 24 heures.</small></p>
        <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
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

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email ${isSetup ? "d'activation" : "de réinitialisation"} envoyé à:`, email);
  } catch (error) {
    console.error('Erreur envoi email:', error);
    throw new Error('Erreur lors de l\'envoi de l\'email');
  }
}

module.exports = {
  sendPasswordResetEmail,
};