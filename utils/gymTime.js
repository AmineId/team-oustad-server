/**
 * Heure locale des salles (Maroc). Les dates sont stockées en UTC ; les
 * horaires d'ouverture ("HH:mm") et la récurrence hebdomadaire s'expriment
 * en heure locale de la salle.
 */

const GYM_TIMEZONE = process.env.GYM_TIMEZONE || 'Africa/Casablanca';

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: GYM_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23'
});

/** { ymd: "2026-10-26", time: "09:30", weekday: 1, offsetMinutes } en heure locale. */
function localParts(date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: WEEKDAYS[parts.weekday],
    offsetMinutes: Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000)
  };
}

/** Ajoute `weeks` semaines en gardant la même heure locale (changements d'heure inclus). */
function addWeeksLocal(date, weeks) {
  const shifted = new Date(date.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  const drift = localParts(shifted).offsetMinutes - localParts(date).offsetMinutes;
  return new Date(shifted.getTime() - drift * 60 * 1000);
}

/**
 * Vérifie qu'une plage tient dans les horaires du jour local. `openingHours`
 * = lignes OpeningHour de la salle. Sans horaire défini pour ce jour, pas de
 * contrôle. Renvoie null si c'est valide, sinon un code d'erreur.
 */
function openingHoursViolation(startAt, endAt, openingHours) {
  const start = localParts(startAt);
  const end = localParts(endAt);
  const hours = openingHours.find(h => h.dayOfWeek === start.weekday);
  if (!hours) return null;
  if (hours.isClosed) return 'gym_closed';
  // Une fin à minuit pile appartient encore au jour de début
  const endsAtMidnight = end.time === '00:00' && endAt - startAt <= 24 * 60 * 60 * 1000;
  if (start.ymd !== end.ymd && !endsAtMidnight) return 'outside_opening_hours';
  if (start.time < hours.openTime) return 'outside_opening_hours';
  // "00:00" en fermeture = minuit
  const closeTime = hours.closeTime === '00:00' ? '24:00' : hours.closeTime;
  const endTime = endsAtMidnight ? '24:00' : end.time;
  if (endTime > closeTime) return 'outside_opening_hours';
  return null;
}

module.exports = { GYM_TIMEZONE, localParts, addWeeksLocal, openingHoursViolation };
