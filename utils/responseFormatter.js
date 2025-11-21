/**
 * Utilitaires pour formater les réponses API avec displayId
 */

/**
 * Transforme un objet user pour utiliser displayId comme identifiant principal
 * @param {Object} user - Objet utilisateur Prisma
 * @returns {Object} User formaté avec displayId
 */
function formatUser(user) {
  if (!user) return null;
  
  const formatted = {
    ...user,
    memberId: user.displayId, // Ajouter memberId/userId qui pointe vers displayId
    userId: user.displayId
  };
  
  return formatted;
}

/**
 * Transforme un tableau d'utilisateurs
 * @param {Array} users - Tableau d'utilisateurs
 * @returns {Array} Users formatés
 */
function formatUsers(users) {
  if (!Array.isArray(users)) return [];
  return users.map(formatUser);
}

/**
 * Transforme un objet avec des relations users/members
 * @param {Object} obj - Objet avec relations
 * @returns {Object} Objet formaté
 */
function formatWithUserRelations(obj) {
  if (!obj) return null;
  
  const formatted = { ...obj };
  
  // Formater user si présent
  if (formatted.user) {
    formatted.user = formatUser(formatted.user);
  }
  
  // Formater member si présent
  if (formatted.member) {
    if (formatted.member.User) {
      formatted.member.User = formatUser(formatted.member.User);
      formatted.member.userId = formatted.member.User.displayId;
      formatted.member.memberId = formatted.member.User.displayId;
    }
  }
  
  // Formater coach si présent
  if (formatted.coach) {
    formatted.coach = formatUser(formatted.coach);
    formatted.coachId = formatted.coach.displayId;
  }
  
  // Formater admin si présent
  if (formatted.admin) {
    formatted.admin = formatUser(formatted.admin);
  }
  
  // Formater owner si présent
  if (formatted.owner) {
    formatted.owner = formatUser(formatted.owner);
  }
  
  return formatted;
}

/**
 * Transforme un tableau d'objets avec relations
 * @param {Array} items - Tableau d'objets
 * @returns {Array} Objets formatés
 */
function formatArrayWithUserRelations(items) {
  if (!Array.isArray(items)) return [];
  return items.map(formatWithUserRelations);
}

/**
 * Transforme un planning avec toutes ses relations
 * @param {Object} planning - Planning Prisma
 * @returns {Object} Planning formaté
 */
function formatPlanning(planning) {
  if (!planning) return null;
  
  const formatted = { ...planning };
  
  // Formater member
  if (formatted.member?.User) {
    formatted.member.User = formatUser(formatted.member.User);
    formatted.memberId = formatted.member.User.displayId;
  }
  
  // Formater coach
  if (formatted.coach) {
    formatted.coach = formatUser(formatted.coach);
    formatted.coachId = formatted.coach.displayId;
  }
  
  return formatted;
}

/**
 * Transforme un abonnement avec relations
 * @param {Object} subscription - Subscription Prisma
 * @returns {Object} Subscription formaté
 */
function formatSubscription(subscription) {
  if (!subscription) return null;
  
  const formatted = { ...subscription };
  
  // Formater member
  if (formatted.member?.User) {
    formatted.member.User = formatUser(formatted.member.User);
    formatted.memberId = formatted.member.User.displayId;
  }
  
  return formatted;
}

/**
 * Transforme un paiement avec relations
 * @param {Object} payment - Payment Prisma
 * @returns {Object} Payment formaté
 */
function formatPayment(payment) {
  if (!payment) return null;
  
  const formatted = { ...payment };
  
  // Formater member
  if (formatted.member?.User) {
    formatted.member.User = formatUser(formatted.member.User);
    formatted.memberId = formatted.member.User.displayId;
  }
  
  // Formater subscription si présent
  if (formatted.subscription) {
    formatted.subscription = formatSubscription(formatted.subscription);
  }
  
  return formatted;
}

module.exports = {
  formatUser,
  formatUsers,
  formatWithUserRelations,
  formatArrayWithUserRelations,
  formatPlanning,
  formatSubscription,
  formatPayment
};
