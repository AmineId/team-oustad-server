const prisma = require('../utils/prismaClient');
const { generateBannerId, generateBannerVariantId } = require('../utils/idGenerator');
const { sendMulticastPushNotification } = require('./pushNotificationService');

/**
 * Service pour la gestion des bannières et événements
 */
class BannerService {
  
  /**
   * Convert priority string/number to Int
   */
  _parsePriority(priority) {
    if (typeof priority === 'number') return priority;
    if (typeof priority === 'string') {
      const map = { low: 0, normal: 1, medium: 1, high: 2, urgent: 3 };
      return map[priority.toLowerCase()] ?? 0;
    }
    return 0;
  }

  /**
   * Récupère les bannières actives avec filtrage
   */
  async getActiveBanners(filters = {}) {
    const { type, gymId, subscriptionTypeId, activeOnly, locale = 'fr' } = filters;
    
    const now = new Date();
    
    const where = {};
    
    // Filtrage par type
    if (type) {
      where.type = type;
    }
    
    // Filtrage par salle
    if (gymId) {
      where.OR = [
        { gymId: gymId },
        { gymId: null } // Bannières globales
      ];
    }
    
    // Filtrage par statut actif (toujours filtrer isActive, dates seulement si activeOnly)
    where.isActive = true;
    
    if (activeOnly) {
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    }
    
    let banners = await prisma.banner.findMany({
      where,
      include: {
        BannerVariant: {
          where: { isActive: true }
        },
        Gym: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });
    
    // Filtrage par type d'abonnement
    if (subscriptionTypeId) {
      banners = banners.filter(banner => {
        return banner.subscriptionTypes.length === 0 || 
               banner.subscriptionTypes.includes(subscriptionTypeId);
      });
    }
    
    // Appliquer la traduction selon la locale
    banners = banners.map(banner => this._applyLocale(banner, locale));
    
    // Sélectionner une variante aléatoire pour A/B testing
    banners = banners.map(banner => {
      if (banner.BannerVariant && banner.BannerVariant.length > 0) {
        const selectedVariant = this._selectVariant(banner.BannerVariant);
        return {
          ...banner,
          selectedVariant,
          hasVariants: true
        };
      }
      return { ...banner, hasVariants: false };
    });
    
    return banners;
  }

  /**
   * Récupère une bannière par ID
   */
  async getBannerById(id, locale = 'fr') {
    const banner = await prisma.banner.findUnique({
      where: { id },
      include: {
        BannerVariant: true,
        Gym: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    if (!banner) {
      return null;
    }
    
    return this._applyLocale(banner, locale);
  }

  /**
   * Crée une nouvelle bannière
   */
  async createBanner(data) {
    const displayId = generateBannerId();
    
    // Extraire action.type et action.data si présents
    const actionType = data.action?.type || data.actionType || 'none';
    const actionData = data.action?.data || data.actionData;
    const actionParams = data.action?.params || data.actionParams || {};
    
    const banner = await prisma.banner.create({
      data: {
        displayId,
        title: data.title,
        titleEn: data.titleEn,
        titleAr: data.titleAr,
        description: data.description,
        descriptionEn: data.descriptionEn,
        descriptionAr: data.descriptionAr,
        imageUrl: data.imageUrl,
        imageBase64: data.imageBase64,
        videoUrl: data.videoUrl,
        mediaType: data.mediaType || 'image',
        type: data.type,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        actionType,
        actionData,
        actionParams,
        priority: this._parsePriority(data.priority),
        isActive: data.isActive !== undefined ? data.isActive : true,
        gymId: data.gymId,
        backgroundColor: data.backgroundColor,
        textColor: data.textColor,
        maxViewsPerUser: data.maxViewsPerUser,
        isScheduled: data.isScheduled !== undefined ? data.isScheduled : true,
        notifyMembers: data.notifyMembers === true,
        subscriptionTypes: data.subscriptionTypeIds || []
      }
    });
    
    return banner;
  }

  /**
   * Met à jour une bannière
   */
  async updateBanner(id, data) {
    const updateData = {};
    
    // Gérer l'objet action si présent
    if (data.action) {
      if (data.action.type) updateData.actionType = data.action.type;
      if (data.action.data !== undefined) updateData.actionData = data.action.data;
      if (data.action.params) updateData.actionParams = data.action.params;
    }
    
    // Champs simples
    const fields = [
      'title', 'titleEn', 'titleAr',
      'description', 'descriptionEn', 'descriptionAr',
      'imageUrl', 'imageBase64', 'videoUrl', 'mediaType',
      'type', 'actionType', 'actionData', 'actionParams',
      'priority', 'isActive', 'gymId',
      'backgroundColor', 'textColor', 'maxViewsPerUser', 'isScheduled',
      'notifyMembers'
    ];
    
    fields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });
    
    // Dates
    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = new Date(data.endDate);
    }
    
    // Types d'abonnement
    if (data.subscriptionTypeIds !== undefined) {
      updateData.subscriptionTypes = data.subscriptionTypeIds;
    }
    
    const banner = await prisma.banner.update({
      where: { id },
      data: updateData
    });
    
    return banner;
  }

  /**
   * Supprime une bannière et ses variantes
   */
  async deleteBanner(id) {
    const banner = await prisma.banner.delete({
      where: { id }
    });
    
    return banner;
  }

  /**
   * Récupère les variantes d'une bannière
   */
  async getVariants(bannerId) {
    const variants = await prisma.bannerVariant.findMany({
      where: { bannerId },
      orderBy: { variantName: 'asc' }
    });
    
    return variants;
  }

  /**
   * Crée une variante A/B
   */
  async createVariant(bannerId, data) {
    const displayId = generateBannerVariantId();
    
    const variant = await prisma.bannerVariant.create({
      data: {
        displayId,
        bannerId,
        variantName: data.variantName,
        title: data.title,
        titleEn: data.titleEn,
        titleAr: data.titleAr,
        description: data.description,
        descriptionEn: data.descriptionEn,
        descriptionAr: data.descriptionAr,
        imageUrl: data.imageUrl,
        imageBase64: data.imageBase64,
        videoUrl: data.videoUrl,
        backgroundColor: data.backgroundColor,
        textColor: data.textColor,
        isActive: data.isActive !== undefined ? data.isActive : true,
        weight: data.weight || 50
      }
    });
    
    return variant;
  }

  /**
   * Met à jour une variante
   */
  async updateVariant(bannerId, variantId, data) {
    const updateData = {};
    
    const fields = [
      'title', 'titleEn', 'titleAr',
      'description', 'descriptionEn', 'descriptionAr',
      'imageUrl', 'imageBase64', 'videoUrl',
      'backgroundColor', 'textColor', 'isActive', 'weight'
    ];
    
    fields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });
    
    const variant = await prisma.bannerVariant.update({
      where: { 
        id: variantId,
        bannerId: bannerId
      },
      data: updateData
    });
    
    return variant;
  }

  /**
   * Supprime une variante
   */
  async deleteVariant(bannerId, variantId) {
    const variant = await prisma.bannerVariant.delete({
      where: { 
        id: variantId,
        bannerId: bannerId
      }
    });
    
    return variant;
  }

  /**
   * Tracker la vue d'une bannière
   */
  async trackView(data) {
    const { bannerId, variantId, userId, userAgent, ipAddress } = data;
    
    // Vérifier la limite de vues par utilisateur
    if (userId) {
      const banner = await prisma.banner.findUnique({
        where: { id: bannerId },
        select: { maxViewsPerUser: true }
      });
      
      if (banner?.maxViewsPerUser) {
        const viewCount = await prisma.bannerStats.count({
          where: {
            bannerId,
            userId,
            eventType: 'view'
          }
        });
        
        if (viewCount >= banner.maxViewsPerUser) {
          return {
            tracked: false,
            limitReached: true,
            remainingViews: 0
          };
        }
        
        // Enregistrer la vue
        await prisma.bannerStats.create({
          data: {
            bannerId,
            variantId,
            userId,
            eventType: 'view',
            viewedAt: new Date(),
            userAgent,
            ipAddress
          }
        });
        
        return {
          tracked: true,
          limitReached: false,
          remainingViews: banner.maxViewsPerUser - viewCount - 1
        };
      }
    }
    
    // Enregistrer la vue sans limite
    await prisma.bannerStats.create({
      data: {
        bannerId,
        variantId,
        userId,
        eventType: 'view',
        viewedAt: new Date(),
        userAgent,
        ipAddress
      }
    });
    
    return {
      tracked: true,
      limitReached: false
    };
  }

  /**
   * Tracker le clic sur une bannière
   */
  async trackClick(data) {
    const { bannerId, variantId, userId, userAgent, ipAddress } = data;
    
    await prisma.bannerStats.create({
      data: {
        bannerId,
        variantId,
        userId,
        eventType: 'click',
        clickedAt: new Date(),
        userAgent,
        ipAddress
      }
    });
    
    return { tracked: true };
  }

  /**
   * Récupère les statistiques d'une bannière
   */
  async getBannerStats(bannerId, options = {}) {
    const { startDate, endDate } = options;
    
    const banner = await prisma.banner.findUnique({
      where: { id: bannerId }
    });
    
    if (!banner) {
      return null;
    }
    
    const where = {
      bannerId
    };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    
    // Statistiques globales
    const viewCount = await prisma.bannerStats.count({
      where: { ...where, eventType: 'view' }
    });
    
    const clickCount = await prisma.bannerStats.count({
      where: { ...where, eventType: 'click' }
    });
    
    const uniqueViewers = await prisma.bannerStats.groupBy({
      by: ['userId'],
      where: { ...where, eventType: 'view', userId: { not: null } }
    });
    
    const lastView = await prisma.bannerStats.findFirst({
      where: { ...where, eventType: 'view' },
      orderBy: { viewedAt: 'desc' },
      select: { viewedAt: true }
    });
    
    const lastClick = await prisma.bannerStats.findFirst({
      where: { ...where, eventType: 'click' },
      orderBy: { clickedAt: 'desc' },
      select: { clickedAt: true }
    });
    
    // Statistiques par variante
    const variants = await prisma.bannerVariant.findMany({
      where: { bannerId }
    });
    
    const variantStats = await Promise.all(
      variants.map(async (variant) => {
        const variantWhere = { ...where, variantId: variant.id };
        
        const vViewCount = await prisma.bannerStats.count({
          where: { ...variantWhere, eventType: 'view' }
        });
        
        const vClickCount = await prisma.bannerStats.count({
          where: { ...variantWhere, eventType: 'click' }
        });
        
        return {
          variantId: variant.id,
          variantName: variant.variantName,
          viewCount: vViewCount,
          clickCount: vClickCount,
          ctr: vViewCount > 0 ? (vClickCount / vViewCount) * 100 : 0
        };
      })
    );
    
    return {
      bannerId,
      viewCount,
      clickCount,
      uniqueViewers: uniqueViewers.length,
      clickThroughRate: viewCount > 0 ? (clickCount / viewCount) * 100 : 0,
      lastViewed: lastView?.viewedAt,
      lastClicked: lastClick?.clickedAt,
      variants: variantStats
    };
  }

  /**
   * Résumé des statistiques de toutes les bannières
   */
  async getStatsSummary(options = {}) {
    const { gymId, startDate, endDate } = options;
    
    const bannerWhere = {};
    if (gymId) {
      bannerWhere.OR = [
        { gymId },
        { gymId: null }
      ];
    }
    
    const totalBanners = await prisma.banner.count({ where: bannerWhere });
    
    const activeBanners = await prisma.banner.count({
      where: {
        ...bannerWhere,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      }
    });
    
    const banners = await prisma.banner.findMany({ where: bannerWhere });
    const bannerIds = banners.map(b => b.id);
    
    const statsWhere = {
      bannerId: { in: bannerIds }
    };
    
    if (startDate || endDate) {
      statsWhere.createdAt = {};
      if (startDate) statsWhere.createdAt.gte = startDate;
      if (endDate) statsWhere.createdAt.lte = endDate;
    }
    
    const totalViews = await prisma.bannerStats.count({
      where: { ...statsWhere, eventType: 'view' }
    });
    
    const totalClicks = await prisma.bannerStats.count({
      where: { ...statsWhere, eventType: 'click' }
    });
    
    const averageCTR = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
    
    // Top performers
    const topPerformers = await Promise.all(
      banners.slice(0, 10).map(async (banner) => {
        const views = await prisma.bannerStats.count({
          where: { bannerId: banner.id, eventType: 'view' }
        });
        
        const clicks = await prisma.bannerStats.count({
          where: { bannerId: banner.id, eventType: 'click' }
        });
        
        return {
          bannerId: banner.id,
          title: banner.title,
          views,
          clicks,
          ctr: views > 0 ? (clicks / views) * 100 : 0
        };
      })
    );
    
    topPerformers.sort((a, b) => b.ctr - a.ctr);
    
    return {
      totalBanners,
      activeBanners,
      totalViews,
      totalClicks,
      averageCTR,
      topPerformers: topPerformers.slice(0, 5)
    };
  }

  /**
   * Appliquer la locale aux traductions
   */
  _applyLocale(banner, locale) {
    const localized = { ...banner };
    
    if (locale === 'en' && banner.titleEn) {
      localized.title = banner.titleEn;
      localized.description = banner.descriptionEn || banner.description;
    } else if (locale === 'ar' && banner.titleAr) {
      localized.title = banner.titleAr;
      localized.description = banner.descriptionAr || banner.description;
    }
    
    // Appliquer également aux variantes
    if (banner.BannerVariant) {
      localized.BannerVariant = banner.BannerVariant.map(variant => {
        const localizedVariant = { ...variant };
        
        if (locale === 'en' && variant.titleEn) {
          localizedVariant.title = variant.titleEn;
          localizedVariant.description = variant.descriptionEn || variant.description;
        } else if (locale === 'ar' && variant.titleAr) {
          localizedVariant.title = variant.titleAr;
          localizedVariant.description = variant.descriptionAr || variant.description;
        }
        
        return localizedVariant;
      });
    }
    
    return localized;
  }

  /**
   * Sélectionner une variante aléatoire selon les poids
   */
  _selectVariant(variants) {
    const activeVariants = variants.filter(v => v.isActive);
    
    if (activeVariants.length === 0) {
      return null;
    }
    
    const totalWeight = activeVariants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const variant of activeVariants) {
      random -= variant.weight;
      if (random <= 0) {
        return variant;
      }
    }
    
    return activeVariants[0];
  }

  /**
   * Tâche cron pour activer/désactiver automatiquement les bannières selon les dates
   */
  async updateScheduledBanners() {
    const now = new Date();
    
    // Activer les bannières dont la date de début est passée
    await prisma.banner.updateMany({
      where: {
        isScheduled: true,
        isActive: false,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      data: {
        isActive: true
      }
    });
    
    // Désactiver les bannières expirées
    await prisma.banner.updateMany({
      where: {
        isScheduled: true,
        isActive: true,
        endDate: { lt: now }
      },
      data: {
        isActive: false
      }
    });
    
    console.log('Scheduled banners updated');

    // Bannières devenues visibles (activées ci-dessus ou dont la date de début est arrivée)
    const pending = await prisma.banner.findMany({
      where: {
        notifyMembers: true,
        notifiedAt: null,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now }
      }
    });
    for (const banner of pending) {
      await this.sendBannerPush(banner);
    }
  }

  /**
   * Push FCM (titre, description, image) aux membres ciblés par la bannière :
   * membres de sa salle (toutes les salles si gymId est null), filtrés par type
   * d'abonnement actif si subscriptionTypes est renseigné.
   * Envoyé une seule fois, et seulement si la bannière est visible maintenant.
   * @returns {Promise<Object|null>} Résultat de l'envoi, ou null si rien à envoyer
   */
  async sendBannerPush(banner) {
    const now = new Date();
    if (!banner.notifyMembers || banner.notifiedAt || !banner.isActive ||
        banner.startDate > now || banner.endDate < now) {
      return null;
    }

    // Réserve l'envoi : la route et le cron ne peuvent pas l'envoyer deux fois
    const { count } = await prisma.banner.updateMany({
      where: { id: banner.id, notifiedAt: null },
      data: { notifiedAt: now }
    });
    if (count === 0) {
      return null;
    }

    const where = {
      role: 'member',
      fcmToken: { not: null },
      notificationsEnabled: true
    };
    if (banner.gymId) {
      where.gymId = banner.gymId;
    }
    if (banner.subscriptionTypes?.length) {
      where.Member = {
        Subscription: {
          some: { status: 'active', subscriptionTypeId: { in: banner.subscriptionTypes } }
        }
      };
    }
    const users = await prisma.user.findMany({ where, select: { fcmToken: true } });
    if (users.length === 0) {
      return { success: true, successCount: 0, failureCount: 0 };
    }

    // FCM n'accepte qu'une URL publique (pas de base64 ni de vidéo)
    const imageUrl = ['image', 'gif'].includes(banner.mediaType) && /^https?:\/\//.test(banner.imageUrl || '')
      ? banner.imageUrl
      : undefined;

    return sendMulticastPushNotification(users.map(u => u.fcmToken), {
      title: banner.title,
      body: banner.description || 'Nouveauté dans votre salle',
      imageUrl,
      data: { type: 'banner', bannerId: banner.displayId, bannerType: banner.type },
      android: { priority: 'high' },
      apns: imageUrl ? { payload: { aps: { 'mutable-content': 1 } }, fcmOptions: { imageUrl } } : undefined
    });
  }
}

module.exports = new BannerService();
