jest.mock('../../utils/prismaClient', () => ({
  subscriptionType: { findUnique: jest.fn() },
  subscription: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  payment: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
  }
}));

const prisma = require('../../utils/prismaClient');
const {
  createYearlySubscriptionWithPayments,
  checkOverduePayments,
  checkUpcomingPayments,
  markPaymentAsCompleted,
  acknowledgePayment,
  getSubscriptionStatus
} = require('../../services/subscriptionService');

const mockSubType = { id: 1, name: 'Premium', monthlyPrice: 50, isActive: true };
const mockSub = { id: 10, displayId: 'SUB-x', memberId: 5, subscriptionTypeId: 1, status: 'active' };
const mockPayment = {
  id: 100,
  amount: 50,
  status: 'pending',
  subscriptionId: 10,
  Subscription: { id: 10, status: 'active' },
  Member: { User: { id: 5, firstName: 'Alice', lastName: 'Test', fcmToken: null } }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscriptionService', () => {

  describe('createYearlySubscriptionWithPayments', () => {
    it('should throw when subscription type not found', async () => {
      prisma.subscriptionType.findUnique.mockResolvedValue(null);
      await expect(createYearlySubscriptionWithPayments(1, 999)).rejects.toThrow('non trouvé');
    });

    it('should throw when subscription type is inactive', async () => {
      prisma.subscriptionType.findUnique.mockResolvedValue({ ...mockSubType, isActive: false });
      await expect(createYearlySubscriptionWithPayments(1, 1)).rejects.toThrow('n\'est plus disponible');
    });

    it('should create subscription and payments (monthly, 12)', async () => {
      prisma.subscriptionType.findUnique.mockResolvedValue(mockSubType);
      prisma.subscription.create.mockResolvedValue({ ...mockSub, SubscriptionType: mockSubType });
      prisma.payment.create.mockResolvedValue({ id: 1 });

      const result = await createYearlySubscriptionWithPayments(5, 1, new Date(), 12);
      expect(prisma.subscription.create).toHaveBeenCalledTimes(1);
      expect(prisma.payment.create).toHaveBeenCalledTimes(12);
      expect(result.payments).toHaveLength(12);
    });

    it('should create 1 payment for one-shot frequency', async () => {
      prisma.subscriptionType.findUnique.mockResolvedValue(mockSubType);
      prisma.subscription.create.mockResolvedValue({ ...mockSub, SubscriptionType: mockSubType });
      prisma.payment.create.mockResolvedValue({ id: 1 });

      const result = await createYearlySubscriptionWithPayments(5, 1, new Date(), 1);
      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    });

    it('should set end date 1 year after start date', async () => {
      prisma.subscriptionType.findUnique.mockResolvedValue(mockSubType);
      prisma.subscription.create.mockResolvedValue({ ...mockSub, SubscriptionType: mockSubType });
      prisma.payment.create.mockResolvedValue({ id: 1 });

      const startDate = new Date('2025-01-01');
      await createYearlySubscriptionWithPayments(5, 1, startDate, 12);
      const subData = prisma.subscription.create.mock.calls[0][0].data;
      expect(subData.endDate.getFullYear()).toBe(2026);
    });

    it('should calculate correct amount per payment', async () => {
      prisma.subscriptionType.findUnique.mockResolvedValue(mockSubType); // 50€/month
      prisma.subscription.create.mockResolvedValue({ ...mockSub, SubscriptionType: mockSubType });
      prisma.payment.create.mockResolvedValue({ id: 1 });

      await createYearlySubscriptionWithPayments(5, 1, new Date(), 3);
      const payData = prisma.payment.create.mock.calls[0][0].data;
      // 12/3 = 4 months per payment; 50 * 4 = 200
      expect(payData.amount).toBe(200);
    });
  });

  describe('checkOverduePayments', () => {
    it('should return 0 when no overdue payments', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      const result = await checkOverduePayments();
      expect(result.overduePayments).toBe(0);
      expect(result.pausedSubscriptions).toBe(0);
    });

    it('should mark payments overdue and pause subscription', async () => {
      const overduePayment = {
        id: 200, amount: 50, dueDate: new Date('2020-01-01'),
        Subscription: { id: 10, status: 'active' },
        Member: { User: { firstName: 'Test', lastName: 'User', fcmToken: null } }
      };
      prisma.payment.findMany.mockResolvedValue([overduePayment]);
      prisma.payment.update.mockResolvedValue({ ...overduePayment, status: 'overdue' });
      prisma.subscription.update.mockResolvedValue({});

      const result = await checkOverduePayments();
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'overdue' } })
      );
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'paused' } })
      );
      expect(result.pausedSubscriptions).toBe(1);
    });

    it('should not pause subscription twice for same subscription', async () => {
      const overdue = (id) => ({
        id,
        amount: 50,
        dueDate: new Date('2020-01-01'),
        Subscription: { id: 10, status: 'active' },
        Member: { User: { firstName: 'T', lastName: 'U', fcmToken: null } }
      });
      prisma.payment.findMany.mockResolvedValue([overdue(1), overdue(2)]);
      prisma.payment.update.mockResolvedValue({});
      prisma.subscription.update.mockResolvedValue({});

      const result = await checkOverduePayments();
      expect(prisma.subscription.update).toHaveBeenCalledTimes(1);
      expect(result.pausedSubscriptions).toBe(1);
    });
  });

  describe('checkUpcomingPayments', () => {
    it('should return upcoming payments', async () => {
      const upcoming = [{
        id: 300,
        amount: 50,
        dueDate: new Date(Date.now() + 3 * 86400 * 1000),
        Subscription: {},
        Member: { User: { firstName: 'Bob', lastName: 'Smith' } }
      }];
      prisma.payment.findMany.mockResolvedValue(upcoming);
      const result = await checkUpcomingPayments();
      expect(result).toHaveLength(1);
    });
  });

  describe('markPaymentAsCompleted', () => {
    it('should mark payment as completed', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: 'pending',
        subscription: null,
        Subscription: null
      });
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'completed', Subscription: null });

      const result = await markPaymentAsCompleted(100, 'cash', 'TXN-123');
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', paymentMethod: 'cash' })
      }));
    });

    it('should reactivate paused subscription when no remaining overdue', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        Member: { User: { fcmToken: null } }
      });
      prisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        subscriptionId: 10,
        Subscription: { id: 10, status: 'paused' }
      });
      prisma.payment.count.mockResolvedValue(0);
      prisma.subscription.update.mockResolvedValue({});

      await markPaymentAsCompleted(100, 'cash');
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'active' } })
      );
    });

    it('should not reactivate subscription when overdue remain', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        Member: { User: { fcmToken: null } }
      });
      prisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        subscriptionId: 10,
        Subscription: { id: 10, status: 'paused' }
      });
      prisma.payment.count.mockResolvedValue(2);

      await markPaymentAsCompleted(100, 'cash');
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('acknowledgePayment', () => {
    it('should throw when payment not found', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(acknowledgePayment(999, 'cash')).rejects.toThrow('Paiement non trouvé');
    });

    it('should throw when payment already completed', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        Subscription: null
      });
      await expect(acknowledgePayment(100, 'cash')).rejects.toThrow('déjà été acquitté');
    });

    it('should activate pending subscription after acknowledge', async () => {
      const pendingPayment = {
        ...mockPayment,
        Subscription: {
          id: 10,
          status: 'pending',
          SubscriptionType: { name: 'Premium' },
          startDate: new Date(),
          endDate: new Date()
        }
      };
      prisma.payment.findUnique.mockResolvedValue(pendingPayment);
      prisma.payment.update.mockResolvedValue({ ...pendingPayment, status: 'completed', Subscription: pendingPayment.Subscription });
      prisma.subscription.update.mockResolvedValue({});

      await acknowledgePayment(100, 'cash');
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'active' } })
      );
    });

    it('should reactivate paused subscription when no overdue remain', async () => {
      const pausedPayment = {
        ...mockPayment,
        Subscription: { id: 10, status: 'paused', SubscriptionType: { name: 'P' } }
      };
      prisma.payment.findUnique.mockResolvedValue(pausedPayment);
      prisma.payment.update.mockResolvedValue({ ...pausedPayment, status: 'completed', Subscription: pausedPayment.Subscription });
      prisma.payment.count.mockResolvedValue(0);
      prisma.subscription.update.mockResolvedValue({});

      await acknowledgePayment(100, 'cash');
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'active' } })
      );
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should throw when subscription not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      await expect(getSubscriptionStatus(999)).rejects.toThrow('Abonnement non trouvé');
    });

    it('should return status with payment stats', async () => {
      const sub = {
        id: 10,
        SubscriptionType: mockSubType,
        Member: { User: { firstName: 'Alice', lastName: 'T' } },
        Payment: [
          { id: 1, status: 'completed', amount: 50 },
          { id: 2, status: 'pending', amount: 50, dueDate: new Date(), monthNumber: 2 },
          { id: 3, status: 'overdue', amount: 50 }
        ]
      };
      prisma.subscription.findUnique.mockResolvedValue(sub);

      const result = await getSubscriptionStatus(10);
      expect(result.stats.totalPayments).toBe(3);
      expect(result.stats.completedPayments).toBe(1);
      expect(result.stats.overduePayments).toBe(1);
      expect(result.stats.pendingPayments).toBe(1);
      expect(result.stats.percentComplete).toBe(33);
      expect(result.nextPayment.id).toBe(2);
    });

    it('should return null nextPayment when all completed', async () => {
      const sub = {
        id: 10,
        SubscriptionType: mockSubType,
        Member: { User: { firstName: 'Bob', lastName: 'T' } },
        Payment: [{ id: 1, status: 'completed', amount: 50 }]
      };
      prisma.subscription.findUnique.mockResolvedValue(sub);

      const result = await getSubscriptionStatus(10);
      expect(result.nextPayment).toBeNull();
    });
  });

});
