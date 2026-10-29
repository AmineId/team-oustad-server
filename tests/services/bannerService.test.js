jest.mock('../../utils/prismaClient', () => ({
  banner: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn()
  },
  bannerVariant: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  bannerStats: {
    create: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    findFirst: jest.fn()
  },
  user: {
    findMany: jest.fn()
  }
}));

const prisma = require('../../utils/prismaClient');
const bannerService = require('../../services/bannerService');
const { sendMulticastPushNotification } = require('../../services/pushNotificationService');

const mockBanner = {
  id: 1,
  displayId: 'BANNER-abc',
  title: 'Test Banner',
  titleEn: 'Test Banner EN',
  titleAr: 'Test Banner AR',
  description: 'Desc FR',
  descriptionEn: 'Desc EN',
  descriptionAr: 'Desc AR',
  isActive: true,
  startDate: new Date(Date.now() - 1000),
  endDate: new Date(Date.now() + 100000),
  type: 'promotion',
  priority: 1,
  subscriptionTypes: [],
  BannerVariant: [],
  Gym: null
};

const pushBanner = {
  id: 9,
  displayId: 'BANNER-push',
  title: 'Tournoi',
  description: 'Inscrivez-vous',
  type: 'event',
  mediaType: 'image',
  imageUrl: 'https://cdn.example.com/tournoi.jpg',
  isActive: true,
  notifyMembers: true,
  notifiedAt: null,
  startDate: new Date(Date.now() - 1000),
  endDate: new Date(Date.now() + 100000),
  gymId: 7,
  subscriptionTypes: []
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BannerService', () => {

  describe('_parsePriority', () => {
    it('should return number as-is', () => {
      expect(bannerService._parsePriority(3)).toBe(3);
    });

    it('should map string priority names', () => {
      expect(bannerService._parsePriority('low')).toBe(0);
      expect(bannerService._parsePriority('normal')).toBe(1);
      expect(bannerService._parsePriority('medium')).toBe(1);
      expect(bannerService._parsePriority('high')).toBe(2);
      expect(bannerService._parsePriority('urgent')).toBe(3);
    });

    it('should return 0 for unknown string', () => {
      expect(bannerService._parsePriority('unknown')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(bannerService._parsePriority(null)).toBe(0);
      expect(bannerService._parsePriority(undefined)).toBe(0);
    });
  });

  describe('_applyLocale', () => {
    it('should return french by default', () => {
      const result = bannerService._applyLocale(mockBanner, 'fr');
      expect(result.title).toBe('Test Banner');
    });

    it('should apply english translation when locale is en', () => {
      const result = bannerService._applyLocale(mockBanner, 'en');
      expect(result.title).toBe('Test Banner EN');
      expect(result.description).toBe('Desc EN');
    });

    it('should apply arabic translation when locale is ar', () => {
      const result = bannerService._applyLocale(mockBanner, 'ar');
      expect(result.title).toBe('Test Banner AR');
      expect(result.description).toBe('Desc AR');
    });

    it('should fall back to french description if no localized description', () => {
      const banner = { ...mockBanner, descriptionEn: null };
      const result = bannerService._applyLocale(banner, 'en');
      expect(result.description).toBe('Desc FR');
    });

    it('should apply locale to BannerVariant children', () => {
      const banner = {
        ...mockBanner,
        BannerVariant: [{
          id: 1,
          title: 'Var FR',
          titleEn: 'Var EN',
          titleAr: 'Var AR',
          description: 'VDesc FR',
          descriptionEn: 'VDesc EN',
          descriptionAr: 'VDesc AR',
          isActive: true,
          weight: 50
        }]
      };
      const result = bannerService._applyLocale(banner, 'en');
      expect(result.BannerVariant[0].title).toBe('Var EN');
    });
  });

  describe('_selectVariant', () => {
    it('should return null when no active variants', () => {
      expect(bannerService._selectVariant([])).toBeNull();
      expect(bannerService._selectVariant([{ isActive: false, weight: 50 }])).toBeNull();
    });

    it('should return a variant from active variants', () => {
      const variants = [
        { id: 1, isActive: true, weight: 50 },
        { id: 2, isActive: true, weight: 50 }
      ];
      const result = bannerService._selectVariant(variants);
      expect([1, 2]).toContain(result.id);
    });

    it('should return the only active variant', () => {
      const variants = [{ id: 5, isActive: true, weight: 100 }];
      expect(bannerService._selectVariant(variants).id).toBe(5);
    });
  });

  describe('getActiveBanners', () => {
    it('should call prisma.banner.findMany and return banners', async () => {
      prisma.banner.findMany.mockResolvedValue([mockBanner]);
      const result = await bannerService.getActiveBanners({});
      expect(prisma.banner.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].hasVariants).toBe(false);
    });

    it('should filter by type when provided', async () => {
      prisma.banner.findMany.mockResolvedValue([]);
      await bannerService.getActiveBanners({ type: 'promotion' });
      expect(prisma.banner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: 'promotion' }) })
      );
    });

    it('should filter by gymId with OR clause', async () => {
      prisma.banner.findMany.mockResolvedValue([]);
      await bannerService.getActiveBanners({ gymId: 42 });
      const call = prisma.banner.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
    });

    it('should add date filter when activeOnly is true', async () => {
      prisma.banner.findMany.mockResolvedValue([]);
      await bannerService.getActiveBanners({ activeOnly: true });
      const call = prisma.banner.findMany.mock.calls[0][0];
      expect(call.where.startDate).toBeDefined();
      expect(call.where.endDate).toBeDefined();
    });

    it('should filter by subscriptionTypeId', async () => {
      const banner = { ...mockBanner, subscriptionTypes: ['TYPE-1', 'TYPE-2'] };
      prisma.banner.findMany.mockResolvedValue([banner]);
      const result = await bannerService.getActiveBanners({ subscriptionTypeId: 'TYPE-99' });
      expect(result).toHaveLength(0);
    });

    it('should include banner when subscriptionTypes is empty (global)', async () => {
      prisma.banner.findMany.mockResolvedValue([mockBanner]);
      const result = await bannerService.getActiveBanners({ subscriptionTypeId: 'TYPE-99' });
      expect(result).toHaveLength(1);
    });

    it('should mark banner hasVariants when variants present', async () => {
      const banner = {
        ...mockBanner,
        BannerVariant: [{ id: 1, isActive: true, weight: 100 }]
      };
      prisma.banner.findMany.mockResolvedValue([banner]);
      const result = await bannerService.getActiveBanners({});
      expect(result[0].hasVariants).toBe(true);
      expect(result[0].selectedVariant).toBeDefined();
    });
  });

  describe('getBannerById', () => {
    it('should return null when banner not found', async () => {
      prisma.banner.findUnique.mockResolvedValue(null);
      const result = await bannerService.getBannerById(999);
      expect(result).toBeNull();
    });

    it('should return formatted banner when found', async () => {
      prisma.banner.findUnique.mockResolvedValue(mockBanner);
      const result = await bannerService.getBannerById(1);
      expect(result.title).toBe('Test Banner');
    });
  });

  describe('createBanner', () => {
    it('should create banner with correct data', async () => {
      prisma.banner.create.mockResolvedValue({ id: 2, ...mockBanner });
      const data = {
        title: 'New Banner',
        type: 'event',
        action: { type: 'url', data: 'https://example.com', params: {} }
      };
      const result = await bannerService.createBanner(data);
      expect(prisma.banner.create).toHaveBeenCalledTimes(1);
      const createdData = prisma.banner.create.mock.calls[0][0].data;
      expect(createdData.actionType).toBe('url');
      expect(createdData.actionData).toBe('https://example.com');
    });

    it('should default actionType to none when no action', async () => {
      prisma.banner.create.mockResolvedValue({ id: 2, ...mockBanner });
      await bannerService.createBanner({ title: 'T', type: 'promo' });
      const createdData = prisma.banner.create.mock.calls[0][0].data;
      expect(createdData.actionType).toBe('none');
    });
  });

  describe('updateBanner', () => {
    it('should update banner fields', async () => {
      prisma.banner.update.mockResolvedValue({ ...mockBanner, title: 'Updated' });
      const result = await bannerService.updateBanner(1, { title: 'Updated' });
      expect(prisma.banner.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } })
      );
    });

    it('should handle action object in update', async () => {
      prisma.banner.update.mockResolvedValue(mockBanner);
      await bannerService.updateBanner(1, { action: { type: 'screen', data: 'home', params: { x: 1 } } });
      const updatedData = prisma.banner.update.mock.calls[0][0].data;
      expect(updatedData.actionType).toBe('screen');
      expect(updatedData.actionData).toBe('home');
      expect(updatedData.actionParams).toEqual({ x: 1 });
    });

    it('should convert date strings to Date objects', async () => {
      prisma.banner.update.mockResolvedValue(mockBanner);
      await bannerService.updateBanner(1, {
        startDate: '2025-01-01',
        endDate: '2025-12-31'
      });
      const updatedData = prisma.banner.update.mock.calls[0][0].data;
      expect(updatedData.startDate).toBeInstanceOf(Date);
      expect(updatedData.endDate).toBeInstanceOf(Date);
    });
  });

  describe('deleteBanner', () => {
    it('should call prisma.banner.delete', async () => {
      prisma.banner.delete.mockResolvedValue(mockBanner);
      await bannerService.deleteBanner(1);
      expect(prisma.banner.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('createVariant', () => {
    it('should create variant with correct data', async () => {
      const mockVariant = { id: 1, displayId: 'VARIANT-abc', bannerId: 1 };
      prisma.bannerVariant.create.mockResolvedValue(mockVariant);
      const result = await bannerService.createVariant(1, {
        variantName: 'A',
        title: 'Variant A',
        weight: 60
      });
      expect(prisma.bannerVariant.create).toHaveBeenCalledTimes(1);
      const data = prisma.bannerVariant.create.mock.calls[0][0].data;
      expect(data.bannerId).toBe(1);
      expect(data.weight).toBe(60);
    });

    it('should default weight to 50', async () => {
      prisma.bannerVariant.create.mockResolvedValue({});
      await bannerService.createVariant(1, { variantName: 'B', title: 'B' });
      const data = prisma.bannerVariant.create.mock.calls[0][0].data;
      expect(data.weight).toBe(50);
    });
  });

  describe('trackView', () => {
    it('should track view without limit', async () => {
      prisma.bannerStats.create.mockResolvedValue({});
      const result = await bannerService.trackView({ bannerId: 1 });
      expect(result.tracked).toBe(true);
      expect(result.limitReached).toBe(false);
    });

    it('should check limit for userId and return limitReached when exceeded', async () => {
      prisma.banner.findUnique.mockResolvedValue({ maxViewsPerUser: 3 });
      prisma.bannerStats.count.mockResolvedValue(3);
      const result = await bannerService.trackView({ bannerId: 1, userId: 99 });
      expect(result.limitReached).toBe(true);
      expect(result.tracked).toBe(false);
    });

    it('should track view within limit and return remaining views', async () => {
      prisma.banner.findUnique.mockResolvedValue({ maxViewsPerUser: 5 });
      prisma.bannerStats.count.mockResolvedValue(2);
      prisma.bannerStats.create.mockResolvedValue({});
      const result = await bannerService.trackView({ bannerId: 1, userId: 99 });
      expect(result.tracked).toBe(true);
      expect(result.remainingViews).toBe(2);
    });

    it('should track view when banner has no maxViewsPerUser', async () => {
      prisma.banner.findUnique.mockResolvedValue({ maxViewsPerUser: null });
      prisma.bannerStats.create.mockResolvedValue({});
      const result = await bannerService.trackView({ bannerId: 1, userId: 99 });
      expect(result.tracked).toBe(true);
    });
  });

  describe('trackClick', () => {
    it('should create a click stat', async () => {
      prisma.bannerStats.create.mockResolvedValue({});
      const result = await bannerService.trackClick({ bannerId: 1, userId: 2 });
      expect(result.tracked).toBe(true);
      expect(prisma.bannerStats.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBannerStats', () => {
    it('should return null when banner not found', async () => {
      prisma.banner.findUnique.mockResolvedValue(null);
      const result = await bannerService.getBannerStats(999);
      expect(result).toBeNull();
    });

    it('should return stats object when banner exists', async () => {
      prisma.banner.findUnique.mockResolvedValue(mockBanner);
      prisma.bannerStats.count.mockResolvedValue(10);
      prisma.bannerStats.groupBy.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
      prisma.bannerStats.findFirst.mockResolvedValue({ viewedAt: new Date(), clickedAt: new Date() });
      prisma.bannerVariant.findMany.mockResolvedValue([]);
      const result = await bannerService.getBannerStats(1);
      expect(result.bannerId).toBe(1);
      expect(result.viewCount).toBe(10);
      expect(result.uniqueViewers).toBe(2);
    });

    it('should calculate CTR correctly', async () => {
      prisma.banner.findUnique.mockResolvedValue(mockBanner);
      prisma.bannerStats.count
        .mockResolvedValueOnce(100) // views
        .mockResolvedValueOnce(25); // clicks
      prisma.bannerStats.groupBy.mockResolvedValue([]);
      prisma.bannerStats.findFirst.mockResolvedValue(null);
      prisma.bannerVariant.findMany.mockResolvedValue([]);
      const result = await bannerService.getBannerStats(1);
      expect(result.clickThroughRate).toBe(25);
    });
  });

  describe('updateScheduledBanners', () => {
    it('should activate and deactivate banners', async () => {
      prisma.banner.updateMany.mockResolvedValue({ count: 2 });
      prisma.banner.findMany.mockResolvedValue([]);
      await bannerService.updateScheduledBanners();
      expect(prisma.banner.updateMany).toHaveBeenCalledTimes(2);
    });

    it('should push banners that became visible and were not notified yet', async () => {
      prisma.banner.updateMany.mockResolvedValue({ count: 1 });
      prisma.banner.findMany.mockResolvedValue([{ ...pushBanner }]);
      prisma.user.findMany.mockResolvedValue([{ fcmToken: 'tok-1' }]);

      await bannerService.updateScheduledBanners();

      expect(prisma.banner.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ notifyMembers: true, notifiedAt: null, isActive: true })
      });
      expect(sendMulticastPushNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendBannerPush', () => {
    beforeEach(() => {
      prisma.banner.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findMany.mockResolvedValue([{ fcmToken: 'tok-1' }, { fcmToken: 'tok-2' }]);
      sendMulticastPushNotification.mockResolvedValue({ success: true, successCount: 2, failureCount: 0 });
    });

    it('should send title, description and image to the gym members', async () => {
      const result = await bannerService.sendBannerPush({ ...pushBanner });

      expect(prisma.banner.updateMany).toHaveBeenCalledWith({
        where: { id: pushBanner.id, notifiedAt: null },
        data: { notifiedAt: expect.any(Date) }
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'member', fcmToken: { not: null }, notificationsEnabled: true, gymId: 7 },
        select: { fcmToken: true }
      });
      expect(sendMulticastPushNotification).toHaveBeenCalledWith(['tok-1', 'tok-2'], expect.objectContaining({
        title: 'Tournoi',
        body: 'Inscrivez-vous',
        imageUrl: 'https://cdn.example.com/tournoi.jpg',
        data: { type: 'banner', bannerId: 'BANNER-push', bannerType: 'event' }
      }));
      expect(result.successCount).toBe(2);
    });

    it('should target every gym and filter by active subscription type', async () => {
      await bannerService.sendBannerPush({ ...pushBanner, gymId: null, subscriptionTypes: [3, 4] });

      const { where } = prisma.user.findMany.mock.calls[0][0];
      expect(where.gymId).toBeUndefined();
      expect(where.Member).toEqual({
        Subscription: { some: { status: 'active', subscriptionTypeId: { in: [3, 4] } } }
      });
    });

    it('should not attach a video or a non-URL image', async () => {
      await bannerService.sendBannerPush({ ...pushBanner, mediaType: 'video' });
      await bannerService.sendBannerPush({ ...pushBanner, imageUrl: null, imageBase64: 'abc' });

      for (const [, notification] of sendMulticastPushNotification.mock.calls) {
        expect(notification.imageUrl).toBeUndefined();
        expect(notification.apns).toBeUndefined();
      }
    });

    it.each([
      ['notifyMembers is off', { notifyMembers: false }],
      ['it was already sent', { notifiedAt: new Date() }],
      ['the banner is inactive', { isActive: false }],
      ['the banner has not started', { startDate: new Date(Date.now() + 3600000) }],
      ['the banner has ended', { endDate: new Date(Date.now() - 1000) }]
    ])('should not send when %s', async (_, override) => {
      const result = await bannerService.sendBannerPush({ ...pushBanner, ...override });

      expect(result).toBeNull();
      expect(prisma.banner.updateMany).not.toHaveBeenCalled();
      expect(sendMulticastPushNotification).not.toHaveBeenCalled();
    });

    it('should not send twice when another call already claimed the banner', async () => {
      prisma.banner.updateMany.mockResolvedValue({ count: 0 });

      const result = await bannerService.sendBannerPush({ ...pushBanner });

      expect(result).toBeNull();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(sendMulticastPushNotification).not.toHaveBeenCalled();
    });

    it('should not call FCM when nobody can receive it', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await bannerService.sendBannerPush({ ...pushBanner });

      expect(result).toEqual({ success: true, successCount: 0, failureCount: 0 });
      expect(sendMulticastPushNotification).not.toHaveBeenCalled();
    });
  });

});
