/**
 * Générateur d'identifiants uniques avec préfixes
 * Format: PREFIX-XXXXXXXXXXXXXXXX (16 caractères hexadécimaux aléatoires)
 * 
 * Exemples:
 * - MEMBER-a8f3d9e2b1c4f567
 * - ADMIN-9f2e1d3c4b5a6789
 * - OWNER-1a2b3c4d5e6f7890
 * - GYM-f1e2d3c4b5a69788
 * - SUB-7a8b9c0d1e2f3456
 * - PAY-3b4c5d6e7f8a9012
 * - PLAN-9d0e1f2a3b4c5678
 */

const crypto = require('crypto');

/**
 * Génère un ID aléatoire de 16 caractères hexadécimaux
 * @returns {string} 16 caractères hex aléatoires
 */
function generateRandomHex() {
  return crypto.randomBytes(8).toString('hex'); // 8 bytes = 16 caractères hex
}

/**
 * Génère un ID avec préfixe pour un utilisateur (générique)
 * @returns {string} Format: USER-XXXXXXXXXXXXXXXX
 */
function generateUserId() {
  return `USER-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un membre
 * @returns {string} Format: MEMBER-XXXXXXXXXXXXXXXX
 */
function generateMemberId() {
  return `MEMBER-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un admin
 * @returns {string} Format: ADMIN-XXXXXXXXXXXXXXXX
 */
function generateAdminId() {
  return `ADMIN-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un owner
 * @returns {string} Format: OWNER-XXXXXXXXXXXXXXXX
 */
function generateOwnerId() {
  return `OWNER-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour une salle de sport
 * @returns {string} Format: GYM-XXXXXXXXXXXXXXXX
 */
function generateGymId() {
  return `GYM-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un abonnement
 * @returns {string} Format: SUB-XXXXXXXXXXXXXXXX
 */
function generateSubscriptionId() {
  return `SUB-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un paiement
 * @returns {string} Format: PAY-XXXXXXXXXXXXXXXX
 */
function generatePaymentId() {
  return `PAY-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un planning
 * @returns {string} Format: PLAN-XXXXXXXXXXXXXXXX
 */
function generatePlanningId() {
  return `PLAN-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un exercice
 * @returns {string} Format: EXER-XXXXXXXXXXXXXXXX
 */
function generateExerciseId() {
  return `EXER-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un type d'abonnement
 * @returns {string} Format: SUBTYPE-XXXXXXXXXXXXXXXX
 */
function generateSubscriptionTypeId() {
  return `SUBTYPE-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un produit du store
 * @returns {string} Format: PROD-XXXXXXXXXXXXXXXX
 */
function generateStoreProductId() {
  return `PROD-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour une réservation du store
 * @returns {string} Format: RESV-XXXXXXXXXXXXXXXX
 */
function generateStoreReservationId() {
  return `RESV-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour une bannière
 * @returns {string} Format: BANNER-XXXXXXXXXXXXXXXX
 */
function generateBannerId() {
  return `BANNER-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour une variante de bannière
 * @returns {string} Format: VARIANT-XXXXXXXXXXXXXXXX
 */
function generateBannerVariantId() {
  return `VARIANT-${generateRandomHex()}`;
}

/**
 * Génère un ID avec préfixe pour un check-in
 * @returns {string} Format: CHECKIN-XXXXXXXXXXXXXXXX
 */
function generateCheckInId() {
  return `CHECKIN-${generateRandomHex()}`;
}

/**
 * Génère un ID utilisateur basé sur le rôle
 * @param {string} role - 'member', 'admin', 'owner'
 * @returns {string} ID formaté selon le rôle
 */
function generateUserIdByRole(role) {
  switch (role.toLowerCase()) {
    case 'member':
      return generateMemberId();
    case 'admin':
      return generateAdminId();
    case 'owner':
      return generateOwnerId();
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

/**
 * Extrait le préfixe d'un ID
 * @param {string} id - ID complet (ex: MEMBER-a8f3d9e2b1c4f567)
 * @returns {string} Préfixe (ex: MEMBER)
 */
function extractPrefix(id) {
  if (!id || typeof id !== 'string') return null;
  const parts = id.split('-');
  return parts.length >= 2 ? parts[0] : null;
}

/**
 * Vérifie si un ID a un format valide
 * @param {string} id - ID à vérifier
 * @param {string} expectedPrefix - Préfixe attendu (optionnel)
 * @returns {boolean} true si valide
 */
function isValidId(id, expectedPrefix = null) {
  if (!id || typeof id !== 'string') return false;
  
  const parts = id.split('-');
  if (parts.length !== 2) return false;
  
  const [prefix, hash] = parts;
  
  // Vérifier le préfixe si spécifié
  if (expectedPrefix && prefix !== expectedPrefix) return false;
  
  // Vérifier que le hash fait exactement 16 caractères hexadécimaux
  if (hash.length !== 16) return false;
  if (!/^[a-f0-9]{16}$/.test(hash)) return false;
  
  return true;
}

/**
 * Génère un ID générique avec un préfixe donné
 * @param {string} prefix - Le préfixe à utiliser
 * @returns {string} Format: PREFIX-XXXXXXXXXXXXXXXX
 */
function generateDisplayId(prefix) {
  return `${prefix}-${generateRandomHex()}`;
}

module.exports = {
  generateUserId,
  generateMemberId,
  generateAdminId,
  generateOwnerId,
  generateGymId,
  generateSubscriptionId,
  generatePaymentId,
  generatePlanningId,
  generateExerciseId,
  generateSubscriptionTypeId,
  generateStoreProductId,
  generateStoreReservationId,
  generateBannerId,
  generateBannerVariantId,
  generateCheckInId,
  generateUserIdByRole,
  generateDisplayId,
  extractPrefix,
  isValidId
};
