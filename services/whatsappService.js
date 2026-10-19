const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

if (process.env.NODE_ENV === 'test') {
  module.exports = {
    getStatus: () => ({ connected: false, phone: null, displayName: null }),
    getQrBase64: async () => null,
    getPairingCode: async () => { throw new Error('WhatsApp indisponible'); },
    logout: async () => {},
    setCustomDisplayName: async () => false,
    setProfilePicture: async () => false,
    sendPasswordResetWhatsApp: async () => {},
    sendLowQuotaWhatsApp: async () => {},
  };
} else {
  let client = null;
  let isReady = false;
  let initFailed = false;
  let connectedPhone = null;
  let currentQr = null;
  let customDisplayName = null;
  const readyCallbacks = [];

  function createClient() {
    return new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    });
  }

  function attachEvents(c) {
    c.on('qr', (qr) => {
      currentQr = qr;
    });

    c.on('ready', async () => {
      isReady = true;
      currentQr = null;
      connectedPhone = c.info?.wid?.user ?? null;
      console.log(`✅ WhatsApp client prêt (${connectedPhone})`);
      if (customDisplayName) {
        const ok = await c.setDisplayName(customDisplayName).catch(() => false);
        if (ok) console.log(`✅ WhatsApp: nom d'affichage appliqué: ${customDisplayName}`);
      }
      readyCallbacks.splice(0).forEach(cb => cb(null));
    });

    c.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp auth failure:', msg);
    });

    c.on('disconnected', (reason) => {
      isReady = false;
      connectedPhone = null;
      console.warn('⚠️ WhatsApp déconnecté:', reason);
    });
  }

  client = createClient();
  attachEvents(client);

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
    return { connected: isReady, phone: connectedPhone, displayName: customDisplayName };
  }

  async function getQrBase64() {
    if (!currentQr) return null;
    return QRCode.toDataURL(currentQr);
  }

  async function logout() {
    await client.logout();
    isReady = false;
    initFailed = false;
    connectedPhone = null;
    currentQr = null;
    // Réinitialiser le client pour permettre une nouvelle connexion sans redémarrage
    client = createClient();
    attachEvents(client);
    client.initialize().catch((err) => {
      initFailed = true;
      console.error('⚠️ WhatsApp: erreur réinitialisation après logout:', err.message);
    });
  }

  async function setCustomDisplayName(name) {
    customDisplayName = name || null;
    if (isReady && name) {
      const ok = await client.setDisplayName(name).catch(() => false);
      console.log(ok ? `✅ WhatsApp: nom d'affichage mis à jour: ${name}` : `⚠️ WhatsApp: impossible de changer le nom`);
      return ok;
    }
    return true; // sera appliqué au prochain ready
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

  async function setProfilePicture(base64Image, mimeType = 'image/jpeg') {
    if (!isReady) throw new Error('WhatsApp non connecté');
    const media = new MessageMedia(mimeType, base64Image);
    const ok = await client.setProfilePicture(media).catch(() => false);
    console.log(ok ? `✅ WhatsApp: photo de profil mise à jour` : `⚠️ WhatsApp: impossible de changer la photo`);
    return ok;
  }

  module.exports = { getStatus, getQrBase64, getPairingCode, logout, setCustomDisplayName, setProfilePicture, sendPasswordResetWhatsApp, sendLowQuotaWhatsApp };
}
