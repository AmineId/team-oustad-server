const express = require('express');
const cors = require('cors');
const prisma = require('../utils/prismaClient');
const { getFullName } = require('../utils/nameUtils');
const logger = require('../utils/logger');

const router = express.Router();

// Open CORS for all public routes (consumed from team-oustad.com frontend)
router.use(cors({ origin: '*' }));

const PUBLIC_CACHE = 'public, max-age=300';

function memberCountDisplay(count) {
  if (count < 10) return String(count);
  if (count < 100) return `${Math.floor(count / 10) * 10}+`;
  return `${Math.floor(count / 50) * 50}+`;
}

function sendImageBuffer(res, base64Data) {
  const raw = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buf = Buffer.from(raw, 'base64');

  let mimeType = 'image/jpeg';
  if (buf.length > 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50) mimeType = 'image/png';
    else if (buf[0] === 0x47 && buf[1] === 0x49) mimeType = 'image/gif';
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', buf.length);
  res.setHeader('Cache-Control', PUBLIC_CACHE);
  res.send(buf);
}

// GET /public/gyms
router.get('/gyms', async (req, res) => {
  try {
    const gyms = await prisma.gym.findMany({
      where: { isPublished: true },
      include: {
        GymPhoto: {
          where: { isCover: true },
          take: 1,
          select: { id: true }
        },
        _count: {
          select: {
            User: { where: { role: 'member' } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const apiBase = process.env.API_URL || '';

    const result = gyms.map(gym => {
      const cover = gym.GymPhoto[0];
      return {
        id: gym.id,
        slug: gym.slug,
        name: gym.name,
        address: gym.address,
        phone: gym.phone,
        memberCountDisplay: memberCountDisplay(gym._count.User),
        coverPhotoUrl: cover ? `${apiBase}/public/gyms/${gym.id}/photos/${cover.id}/image` : null
      };
    });

    res.setHeader('Cache-Control', PUBLIC_CACHE);
    res.json({ gyms: result });
  } catch (e) {
    logger.error('💥 Erreur GET /public/gyms:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /public/gyms/:slugOrId
router.get('/gyms/:slugOrId', async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const isNumeric = /^\d+$/.test(slugOrId);

    const gym = await prisma.gym.findFirst({
      where: isNumeric
        ? { id: Number(slugOrId), isPublished: true }
        : { slug: slugOrId, isPublished: true },
      include: {
        OpeningHour: { orderBy: { dayOfWeek: 'asc' } },
        GymPhoto: {
          orderBy: { position: 'asc' },
          select: { id: true, isCover: true }
        },
        User: {
          where: { role: { in: ['admin', 'owner'] } },
          select: { id: true, firstName: true, lastName: true, role: true }
        },
        _count: {
          select: {
            User: { where: { role: 'member' } }
          }
        }
      }
    });

    if (!gym) return res.status(404).json({ error: 'Gym not found' });

    const apiBase = process.env.API_URL || '';

    const result = {
      id: gym.id,
      slug: gym.slug,
      name: gym.name,
      address: gym.address,
      phone: gym.phone,
      memberCountDisplay: memberCountDisplay(gym._count.User),
      openingHours: gym.OpeningHour.map(h => ({
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime,
        closeTime: h.closeTime,
        isClosed: h.isClosed
      })),
      photos: gym.GymPhoto.map(p => ({
        id: p.id,
        url: `${apiBase}/public/gyms/${gym.id}/photos/${p.id}/image`,
        isCover: p.isCover
      })),
      team: gym.User.map(u => ({
        id: u.id,
        fullName: getFullName(u),
        role: u.role,
        photoUrl: `${apiBase}/public/gyms/${gym.id}/team/${u.id}/image`
      }))
    };

    res.setHeader('Cache-Control', PUBLIC_CACHE);
    res.json({ gym: result });
  } catch (e) {
    logger.error('💥 Erreur GET /public/gyms/:slugOrId:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /public/gyms/:gymId/photos/:photoId/image
router.get('/gyms/:gymId/photos/:photoId/image', async (req, res) => {
  try {
    const gymId = Number(req.params.gymId);
    const photoId = Number(req.params.photoId);

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { isPublished: true }
    });
    if (!gym || !gym.isPublished) return res.status(404).json({ error: 'Not found' });

    const photo = await prisma.gymPhoto.findFirst({
      where: { id: photoId, gymId }
    });
    if (!photo) return res.status(404).json({ error: 'Not found' });

    sendImageBuffer(res, photo.imageData);
  } catch (e) {
    logger.error('💥 Erreur GET /public/gyms/:gymId/photos/:photoId/image:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /public/gyms/:gymId/team/:userId/image
router.get('/gyms/:gymId/team/:userId/image', async (req, res) => {
  try {
    const gymId = Number(req.params.gymId);
    const userId = Number(req.params.userId);

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { isPublished: true }
    });
    if (!gym || !gym.isPublished) return res.status(404).json({ error: 'Not found' });

    const user = await prisma.user.findFirst({
      where: { id: userId, gymId, role: { in: ['admin', 'owner'] } },
      select: { profileImage: true, firstName: true, lastName: true }
    });
    if (!user) return res.status(404).json({ error: 'Not found' });

    if (!user.profileImage) {
      const initials = getFullName(user).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      const svg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="100" fill="#10b981"/><text x="100" y="130" font-family="Arial" font-size="80" font-weight="bold" text-anchor="middle" fill="white">${initials}</text></svg>`;
      const buf = Buffer.from(svg, 'utf8');
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Cache-Control', PUBLIC_CACHE);
      return res.send(buf);
    }

    let mimeType = 'image/jpeg';
    if (user.profileImage.length > 4) {
      if (user.profileImage[0] === 0x89 && user.profileImage[1] === 0x50) mimeType = 'image/png';
      else if (user.profileImage[0] === 0x47 && user.profileImage[1] === 0x49) mimeType = 'image/gif';
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', user.profileImage.length);
    res.setHeader('Cache-Control', PUBLIC_CACHE);
    res.send(user.profileImage);
  } catch (e) {
    logger.error('💥 Erreur GET /public/gyms/:gymId/team/:userId/image:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
