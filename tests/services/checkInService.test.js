jest.mock('../../utils/prismaClient', () => ({
  subscription: { findUnique: jest.fn(), update: jest.fn() },
  gymCheckIn: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn()
  },
  user: { findFirst: jest.fn() }
}));

const prisma = require('../../utils/prismaClient');
const checkInService = require('../../services/checkInService');

const mockActiveSub = {
  id: 10,
  status: 'active',
  endDate: new Date(Date.now() + 30 * 86400 * 1000),
  sessionQuota: null,
  sessionsUsed: 0,
  SubscriptionType: { name: 'Premium', sessionQuota: null },
  Member: { User: { firstName: 'Alice', lastName: 'T' } }
};

const mockCheckIn = {
  id: 1,
  displayId: 'CHECKIN-abc',
  memberId: 5,
  subscriptionId: 10,
  gymId: 1,
  checkInTime: new Date(),
  Member: { User: { firstName: 'Alice', lastName: 'T' } },
  Subscription: { SubscriptionType: { name: 'Premium' } }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CheckInService', () => {

  describe('createCheckIn', () => {
    it('should throw when subscription not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      await expect(checkInService.createCheckIn({ memberId: 1, subscriptionId: 999, gymId: 1 }))
        .rejects.toThrow('Subscription not found');
    });

    it('should throw when subscription is not active', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ ...mockActiveSub, status: 'paused' });
      await expect(checkInService.createCheckIn({ memberId: 1, subscriptionId: 10, gymId: 1 }))
        .rejects.toThrow('Subscription is paused');
    });

    it('should throw when subscription is expired', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...mockActiveSub,
        endDate: new Date(Date.now() - 86400 * 1000)
      });
      await expect(checkInService.createCheckIn({ memberId: 1, subscriptionId: 10, gymId: 1 }))
        .rejects.toThrow('expired');
    });

    it('should throw when session quota exhausted', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...mockActiveSub,
        sessionQuota: 5,
        sessionsUsed: 5
      });
      await expect(checkInService.createCheckIn({ memberId: 1, subscriptionId: 10, gymId: 1 }))
        .rejects.toThrow('quota exhausted');
    });

    it('should throw when already checked in today', async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockActiveSub);
      prisma.gymCheckIn.findFirst.mockResolvedValue(mockCheckIn);
      await expect(checkInService.createCheckIn({ memberId: 5, subscriptionId: 10, gymId: 1 }))
        .rejects.toThrow('already scanned today');
    });

    it('should create check-in successfully (unlimited)', async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockActiveSub);
      prisma.gymCheckIn.findFirst.mockResolvedValue(null);
      prisma.gymCheckIn.create.mockResolvedValue(mockCheckIn);

      const result = await checkInService.createCheckIn({ memberId: 5, subscriptionId: 10, gymId: 1 });
      expect(prisma.gymCheckIn.create).toHaveBeenCalledTimes(1);
      expect(result.sessionsRemaining).toBeNull();
    });

    it('should increment sessionsUsed when quota is set', async () => {
      const sub = { ...mockActiveSub, sessionQuota: 10, sessionsUsed: 3 };
      prisma.subscription.findUnique.mockResolvedValue(sub);
      prisma.gymCheckIn.findFirst.mockResolvedValue(null);
      prisma.gymCheckIn.create.mockResolvedValue(mockCheckIn);
      prisma.subscription.update.mockResolvedValue({});

      const result = await checkInService.createCheckIn({ memberId: 5, subscriptionId: 10, gymId: 1 });
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { sessionsUsed: { increment: 1 } } })
      );
      expect(result.sessionsRemaining).toBe(6); // 10 - 3 - 1
    });
  });

  describe('checkInByQR', () => {
    it('should throw when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(checkInService.checkInByQR('UNKNOWN-ID', 1)).rejects.toThrow('Member not found');
    });

    it('should throw when user has no Member profile', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 1, firstName: 'A', lastName: 'B', Member: null });
      await expect(checkInService.checkInByQR('USR-123', 1)).rejects.toThrow('Member not found');
    });

    it('should throw when no active subscription', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 1, firstName: 'A', lastName: 'B',
        displayId: 'USR-123',
        Member: { Subscription: [] }
      });
      await expect(checkInService.checkInByQR('USR-123', 1)).rejects.toThrow('No active subscription');
    });

    it('should parse JSON QR code and check in', async () => {
      const user = {
        id: 5, displayId: 'USR-123', firstName: 'Alice', lastName: 'T', profileImage: null,
        Member: {
          Subscription: [{
            id: 10,
            status: 'active',
            sessionsUsed: 0,
            sessionQuota: null,
            SubscriptionType: { name: 'Premium', sessionQuota: null }
          }]
        }
      };
      prisma.user.findFirst.mockResolvedValue(user);
      prisma.subscription.findUnique
        .mockResolvedValueOnce({ // createCheckIn call
          ...mockActiveSub, id: 10
        })
        .mockResolvedValueOnce({ // getSubscriptionQuota call
          id: 10, displayId: 'SUB-x', sessionQuota: null, sessionsUsed: 1,
          status: 'active',
          SubscriptionType: { name: 'Premium' },
          Member: { User: { firstName: 'Alice', lastName: 'T' } }
        });
      prisma.gymCheckIn.findFirst.mockResolvedValue(null);
      prisma.gymCheckIn.create.mockResolvedValue({ ...mockCheckIn, displayId: 'CHECKIN-new' });

      const qrJson = JSON.stringify({ displayId: 'USR-123' });
      const result = await checkInService.checkInByQR(qrJson, 1);
      expect(result.success).toBe(true);
      expect(result.member.displayId).toBe('USR-123');
    });
  });

  describe('getSubscriptionQuota', () => {
    it('should throw when subscription not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      await expect(checkInService.getSubscriptionQuota(999)).rejects.toThrow('Subscription not found');
    });

    it('should return unlimited info when sessionQuota is null', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 10, displayId: 'SUB-x', sessionQuota: null, sessionsUsed: 0,
        status: 'active', startDate: new Date(), endDate: new Date(),
        SubscriptionType: { name: 'P' },
        Member: { User: { firstName: 'A', lastName: 'B' } }
      });
      const result = await checkInService.getSubscriptionQuota(10);
      expect(result.isUnlimited).toBe(true);
      expect(result.sessionsRemaining).toBeNull();
      expect(result.percentageUsed).toBe(0);
      expect(result.canCheckIn).toBe(true);
    });

    it('should return quota info for limited subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 10, displayId: 'SUB-x', sessionQuota: 10, sessionsUsed: 6,
        status: 'active', startDate: new Date(), endDate: new Date(),
        SubscriptionType: { name: 'P' },
        Member: { User: { firstName: 'A', lastName: 'B' } }
      });
      const result = await checkInService.getSubscriptionQuota(10);
      expect(result.sessionsRemaining).toBe(4);
      expect(result.percentageUsed).toBe(60);
      expect(result.canCheckIn).toBe(true);
    });

    it('should set canCheckIn false when quota exhausted', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 10, displayId: 'SUB-x', sessionQuota: 5, sessionsUsed: 5,
        status: 'active', startDate: new Date(), endDate: new Date(),
        SubscriptionType: { name: 'P' },
        Member: { User: { firstName: 'A', lastName: 'B' } }
      });
      const result = await checkInService.getSubscriptionQuota(10);
      expect(result.canCheckIn).toBe(false);
    });
  });

  describe('getMemberCheckIns', () => {
    it('should return check-ins for a member', async () => {
      prisma.gymCheckIn.findMany.mockResolvedValue([mockCheckIn]);
      const result = await checkInService.getMemberCheckIns(5);
      expect(result).toHaveLength(1);
    });

    it('should apply date filters when provided', async () => {
      prisma.gymCheckIn.findMany.mockResolvedValue([]);
      await checkInService.getMemberCheckIns(5, {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31')
      });
      const call = prisma.gymCheckIn.findMany.mock.calls[0][0];
      expect(call.where.checkInTime).toBeDefined();
    });
  });

  describe('getPresentMembers', () => {
    it('should return present members with hoursAgo', async () => {
      const checkIn = { ...mockCheckIn, checkInTime: new Date(Date.now() - 2 * 3600 * 1000), checkOutTime: null };
      prisma.gymCheckIn.findMany.mockResolvedValue([checkIn]);
      const result = await checkInService.getPresentMembers(1);
      expect(result[0].hoursAgo).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getGymStats', () => {
    it('should return stats object', async () => {
      prisma.gymCheckIn.count.mockResolvedValue(20);
      prisma.gymCheckIn.groupBy.mockResolvedValue([{ memberId: 1 }, { memberId: 2 }]);
      prisma.gymCheckIn.findMany.mockResolvedValue([
        { checkInTime: new Date('2025-01-06') }, // Monday
        { checkInTime: new Date('2025-01-07') }  // Tuesday
      ]);
      const result = await checkInService.getGymStats(1);
      expect(result.totalCheckIns).toBe(20);
      expect(result.uniqueMembers).toBe(2);
      expect(result.avgCheckInsPerMember).toBe(10);
      expect(result.byDayOfWeek).toBeDefined();
    });

    it('should handle empty gym with 0 avgCheckIns', async () => {
      prisma.gymCheckIn.count.mockResolvedValue(0);
      prisma.gymCheckIn.groupBy.mockResolvedValue([]);
      prisma.gymCheckIn.findMany.mockResolvedValue([]);
      const result = await checkInService.getGymStats(1);
      expect(result.avgCheckInsPerMember).toBe(0);
    });
  });

  describe('autoCheckOutYesterday', () => {
    it('should checkout yesterday check-ins and return count', async () => {
      const yesterday = [
        { id: 1, checkInTime: new Date(Date.now() - 86400 * 1000) },
        { id: 2, checkInTime: new Date(Date.now() - 86400 * 1000) }
      ];
      prisma.gymCheckIn.findMany.mockResolvedValue(yesterday);
      prisma.gymCheckIn.update.mockResolvedValue({});

      const count = await checkInService.autoCheckOutYesterday();
      expect(count).toBe(2);
      expect(prisma.gymCheckIn.update).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no check-ins to process', async () => {
      prisma.gymCheckIn.findMany.mockResolvedValue([]);
      const count = await checkInService.autoCheckOutYesterday();
      expect(count).toBe(0);
    });
  });

});
