const prisma = require('./prismaClient');

/**
 * Pages CMS du site vitrine (voir docs/features/GYM_SHOWCASE_PUBLIC_API.md §8
 * côté app). Le serveur stocke la page telle quelle après validation : il ne
 * connaît pas la liste exhaustive des types de section (l'app ignore ceux
 * qu'elle ne sait pas afficher).
 */

const HOME_KEY = 'home';
const gymKey = (gymId) => `gym:${gymId}`;

const LIMITS = Object.freeze({
  maxBodyBytes: 100 * 1024,
  maxSections: 40,
  maxIdLength: 40,
  maxTypeLength: 40,
  maxString: 5000,
  maxArray: 20,
  maxDepth: 4
});

class ShowcaseValidationError extends Error {}

function fail(message) {
  throw new ShowcaseValidationError(message);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Lien de bouton : http(s) uniquement (jamais javascript:, data:, …). */
function isSafeUrl(value) {
  if (value === '') return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch (_) {
    return false;
  }
}

/** Valide récursivement les valeurs de `data` (chaînes, nombres, booléens). */
function validateValue(value, path, depth) {
  if (depth > LIMITS.maxDepth) fail(`${path} : imbrication trop profonde`);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return;
  if (typeof value === 'string') {
    if (value.length > LIMITS.maxString) {
      fail(`${path} : ${LIMITS.maxString} caractères maximum`);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > LIMITS.maxArray) fail(`${path} : ${LIMITS.maxArray} éléments maximum`);
    value.forEach((v, i) => validateValue(v, `${path}[${i}]`, depth + 1));
    return;
  }
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) validateValue(v, `${path}.${k}`, depth + 1);
    return;
  }
  fail(`${path} : type non autorisé`);
}

/**
 * Valide le body d'un PUT et renvoie la page normalisée (clés connues
 * uniquement). Lève ShowcaseValidationError (→ 400).
 */
function validatePage(body, { allowHero }) {
  if (!isPlainObject(body)) fail('Le body doit être un objet');
  if (Buffer.byteLength(JSON.stringify(body)) > LIMITS.maxBodyBytes) {
    fail('Page trop volumineuse (100 Ko maximum)');
  }

  const page = {};

  if (body.hero !== undefined) {
    if (!allowHero) fail('hero n\'est accepté que pour la page d\'accueil');
    if (!isPlainObject(body.hero)) fail('hero doit être un objet');
    page.hero = {};
    for (const key of ['eyebrow', 'tagline']) {
      const v = body.hero[key];
      if (v === undefined) continue;
      if (typeof v !== 'string' || v.length > 200) fail(`hero.${key} : chaîne de 200 caractères maximum`);
      page.hero[key] = v;
    }
  }

  if (!Array.isArray(body.sections)) fail('sections doit être un tableau');
  if (body.sections.length > LIMITS.maxSections) {
    fail(`${LIMITS.maxSections} sections maximum`);
  }

  const ids = new Set();
  page.sections = body.sections.map((section, i) => {
    const path = `sections[${i}]`;
    if (!isPlainObject(section)) fail(`${path} doit être un objet`);
    const { id, type, visible, data } = section;
    if (typeof id !== 'string' || !id || id.length > LIMITS.maxIdLength) {
      fail(`${path}.id : chaîne de ${LIMITS.maxIdLength} caractères maximum`);
    }
    if (ids.has(id)) fail(`${path}.id : "${id}" est en double`);
    ids.add(id);
    if (typeof type !== 'string' || !type || type.length > LIMITS.maxTypeLength) {
      fail(`${path}.type : chaîne de ${LIMITS.maxTypeLength} caractères maximum`);
    }
    if (visible !== undefined && typeof visible !== 'boolean') fail(`${path}.visible doit être un booléen`);

    const normalized = { id, type, visible: visible !== false };
    if (data !== undefined) {
      if (!isPlainObject(data)) fail(`${path}.data doit être un objet`);
      validateValue(data, `${path}.data`, 1);
      if (data.url !== undefined && (typeof data.url !== 'string' || !isSafeUrl(data.url))) {
        fail(`${path}.data.url : lien http(s) uniquement`);
      }
      normalized.data = data;
    }
    return normalized;
  });

  return page;
}

/** Page enregistrée, ou {} si rien n'a encore été saisi. */
async function readPage(key) {
  const row = await prisma.showcasePage.findUnique({ where: { key } });
  return row ? row.content : {};
}

/** Variante publique : sans les sections masquées. */
function publicView(content) {
  if (!content || !Array.isArray(content.sections)) return content || {};
  return { ...content, sections: content.sections.filter((s) => s.visible !== false) };
}

async function writePage(key, content, { gymId = null, userId = null } = {}) {
  return prisma.showcasePage.upsert({
    where: { key },
    create: { key, gymId, content, updatedBy: userId },
    update: { content, updatedBy: userId }
  });
}

module.exports = {
  HOME_KEY,
  gymKey,
  LIMITS,
  ShowcaseValidationError,
  validatePage,
  readPage,
  writePage,
  publicView
};
