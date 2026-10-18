const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

if (process.env.NODE_ENV === 'test') {
  module.exports = {
    getStatus: () => ({ connected: false, phone: null }),
    getQrBase64: async () => null,
    getPairingCode: async () => { throw new Error('WhatsApp indisponible'); },
    logout: async () => {},
    sendPasswordResetWhatsApp: async () => {},
    sendLowQuotaWhatsApp: async () => {},
  };
} else {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  let isReady = false;
  let initFailed = false;
  let connectedPhone = null;
  let currentQr = null;
  const readyCallbacks = [];

  client.on('qr', (qr) => {
    currentQr = qr;
  });

  client.on('ready', () => {
    isReady = true;
    currentQr = null;
    connectedPhone = client.info?.wid?.user ?? null;
    console.log(`✅ WhatsApp client prêt (${connectedPhone})`);
    readyCallbacks.splice(0).forEach(cb => cb(null));
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp auth failure:', msg);
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    connectedPhone = null;
    console.warn('⚠️ WhatsApp déconnecté:', reason);
  });

  client.initialize().catch((err) => {
    initFailed = true;
    readyCallbacks.splice(0).forEach(cb => cb(new Error(err.message)));
    console.error('⚠️ WhatsApp: impossible de démarrer le client (Puppeteer/Chrome manquant ?):', err.message);
  });

  function waitReady(timeoutMs = 60000) {
    if (isReady) return Promise.resolve();
    if (initFailed) return Promise.reject(new Error('WhatsApp client indisponible'));
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('WhatsApp client pas prêt (timeout)')), timeoutMs);
      readyCallbacks.push((err) => {
        clearTimeout(t);
        err ? reject(err) : resolve();
      });
    });
  }

  function toChatId(phone) {
    return `${phone.replace(/[\s+\-().]/g, '')}@c.us`;
  }

  function getStatus() {
    return { connected: isReady, phone: connectedPhone };
  }

  async function getQrBase64() {
    if (!currentQr) return null;
    return QRCode.toDataURL(currentQr);
  }

  async function logout() {
    await client.logout();
    isReady = false;
    connectedPhone = null;
    currentQr = null;
  }

  async function sendPasswordResetWhatsApp(phoneNumber, token, isSetup = false) {
    await waitReady();
    const message = isSetup
      ? `🎉 *Bienvenue sur Team Fitness !*\n\nVotre code d'activation : *${token}*\n\n⏱️ Ce code expire dans 24 heures.`
      : `🔐 *Réinitialisation de mot de passe - Team Fitness*\n\nVotre code : *${token}*\n\n⏱️ Ce code expire dans 1 heure.`;

    console.log(`📱 WhatsApp: envoi code ${isSetup ? 'activation' : 'reset'} à ${phoneNumber}`);
    await client.sendMessage(toChatId(phoneNumber), message);
    console.log(`✅ WhatsApp: message envoyé`);
  }

  async function sendLowQuotaWhatsApp(phoneNumber, data) {
    await waitReady();
    const endDate = new Date(data.endDate).toLocaleDateString('fr-FR');
    const message = `⚠️ *Alerte quota - Team Fitness*\n\nBonjour *${data.firstName} ${data.lastName}*,\n\nIl vous reste *${data.sessionsRemaining} / ${data.sessionQuota}* séances (${data.percentageRemaining}%).\n\n📋 Abonnement : ${data.subscriptionType}\n📅 Date de fin : ${endDate}\n\nPensez à renouveler votre abonnement ! 💪`;

    console.log(`📱 WhatsApp: envoi alerte quota à ${phoneNumber}`);
    await client.sendMessage(toChatId(phoneNumber), message);
    console.log(`✅ WhatsApp: message envoyé`);
  }

  async function getPairingCode(phoneNumber) {
    if (isReady) throw new Error('WhatsApp déjà connecté');
    const normalized = phoneNumber.replace(/[\s+\-().]/g, '');
    return await client.authenticateWithPairingCode(normalized);
  }

  module.exports = { getStatus, getQrBase64, getPairingCode, logout, sendPasswordResetWhatsApp, sendLowQuotaWhatsApp };
}
