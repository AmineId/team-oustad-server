/**
 * Utilitaires pour gérer firstName, lastName et fullName
 */

/**
 * Obtient le nom complet à partir d'un objet user
 * @param {Object} user - L'objet utilisateur
 * @returns {string} Le nom complet
 */
function getFullName(user) {
  if (!user) return '';
  
  // Si firstName et lastName existent, les utiliser
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  
  // Sinon, utiliser fullName (rétrocompatibilité)
  return user.fullName || '';
}

/**
 * Sépare un nom complet en firstName et lastName
 * @param {string} fullName - Le nom complet
 * @returns {Object} { firstName, lastName }
 */
function splitFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '' };
  }
  
  const parts = fullName.trim().split(' ');
  
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  
  // Premier mot = firstName, reste = lastName
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  
  return { firstName, lastName };
}

/**
 * Formate un objet user pour inclure fullName virtuel
 * @param {Object} user - L'objet utilisateur
 * @returns {Object} L'objet utilisateur avec fullName ajouté
 */
function formatUserWithFullName(user) {
  if (!user) return null;
  
  return {
    ...user,
    fullName: getFullName(user)
  };
}

module.exports = {
  getFullName,
  splitFullName,
  formatUserWithFullName
};
