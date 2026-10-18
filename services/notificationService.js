const emailService = require('./emailService');
const whatsappService = require('./whatsappService');

// Envoie le code de réinitialisation/activation via WhatsApp si phoneNumber dispo, sinon email
async function sendPasswordResetNotification(user, token, isSetup = false) {
  if (user.phoneNumber) {
    try {
      await whatsappService.sendPasswordResetWhatsApp(user.phoneNumber, token, isSetup);
      console.log(`✅ WhatsApp ${isSetup ? 'activation' : 'réinitialisation'} envoyé à ${user.phoneNumber}`);
      return;
    } catch (err) {
      console.error(`⚠️ WhatsApp échoué (${err.message}), fallback email`);
    }
  }
  await emailService.sendPasswordResetEmail(user.email, token, isSetup);
}

// Envoie l'alerte quota bas via WhatsApp si phoneNumber dispo, sinon email
async function sendLowQuotaNotification(user, data) {
  if (user.phoneNumber) {
    try {
      await whatsappService.sendLowQuotaWhatsApp(user.phoneNumber, data);
      console.log(`✅ WhatsApp quota bas envoyé à ${user.phoneNumber}`);
      return;
    } catch (err) {
      console.error(`⚠️ WhatsApp échoué (${err.message}), fallback email`);
    }
  }
  await emailService.sendLowQuotaEmail(user.email, data);
}

module.exports = { sendPasswordResetNotification, sendLowQuotaNotification };
