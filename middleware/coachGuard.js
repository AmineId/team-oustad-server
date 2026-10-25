/**
 * Rôles V2 : le coach est refusé par défaut.
 *
 * Beaucoup de routes historiques refusent seulement `member` puis laissent
 * passer tout le reste (pensé pour owner/admin). Pour qu'un coach n'hérite pas
 * de ces droits, il n'accède qu'aux routes listées ici ; chaque route listée
 * applique ensuite sa propre portée (ses salles, ses membres, ses séances).
 */

// [méthode, motif sur le chemin complet sans query string]
const COACH_ROUTES = [
  // Profil et session
  ['GET', /^\/auth\/me$/],
  ['GET', /^\/users\/me$/],
  ['PUT', /^\/users\/fcm-token$/],
  ['DELETE', /^\/users\/fcm-token$/],
  // Coach : ses membres
  ['GET', /^\/coaches\/me\/members$/],
  // Salles : lecture
  ['GET', /^\/gyms$/],
  ['GET', /^\/gyms\/\d+$/],
  ['GET', /^\/gyms\/\d+\/opening-hours$/],
  ['GET', /^\/gyms\/\d+\/image$/],
];

/** Routes de profil où `:id` doit être le coach lui-même. */
const SELF_ROUTES = [
  ['GET', /^\/users\/(\d+)$/],
  ['PUT', /^\/users\/(\d+)$/],
  ['POST', /^\/users\/(\d+)\/change-password$/],
  ['GET', /^\/users\/(\d+)\/qr$/],
  ['GET', /^\/users\/(\d+)\/profile-image$/],
  ['PUT', /^\/users\/(\d+)\/profile-image$/],
  ['DELETE', /^\/users\/(\d+)\/profile-image$/],
];

function isCoachAllowed(method, path, userId) {
  const clean = path.replace(/\/+$/, '') || '/';
  if (COACH_ROUTES.some(([m, re]) => m === method && re.test(clean))) return true;
  return SELF_ROUTES.some(([m, re]) => {
    if (m !== method) return false;
    const match = clean.match(re);
    return Boolean(match) && Number(match[1]) === userId;
  });
}

module.exports = { isCoachAllowed, COACH_ROUTES, SELF_ROUTES };
