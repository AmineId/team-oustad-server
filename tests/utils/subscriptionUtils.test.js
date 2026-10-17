const {
  isSubscriptionActive,
  getActiveSubscription,
  getSubscriptionsWithStatus
} = require('../../utils/subscriptionUtils');

const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

function makePayment(status = 'completed', createdAt = recent) {
  return { status, createdAt };
}

function makeSub(overrides = {}) {
  return {
    status: 'active',
    endDate: future,
    billingCycle: 'monthly',
    Payment: [makePayment()],
    ...overrides
  };
}

describe('subscriptionUtils', () => {

  describe('isSubscriptionActive', () => {
    it('returns false when status is not active', () => {
      const result = isSubscriptionActive(makeSub({ status: 'paused' }));
      expect(result.isActive).toBe(false);
      expect(result.reason).toBe('subscription_inactive');
    });

    it('returns false when subscription is expired', () => {
      const result = isSubscriptionActive(makeSub({ endDate: past }));
      expect(result.isActive).toBe(false);
      expect(result.reason).toBe('subscription_expired');
      expect(result.details.daysExpired).toBeGreaterThan(0);
    });

    it('returns false when no payments exist', () => {
      const result = isSubscriptionActive(makeSub({ Payment: [] }));
      expect(result.isActive).toBe(false);
      expect(result.reason).toBe('no_payments');
    });

    it('returns false when payments field is undefined', () => {
      const result = isSubscriptionActive(makeSub({ Payment: undefined }));
      expect(result.isActive).toBe(false);
      expect(result.reason).toBe('no_payments');
    });

    it('uses lowercase payments field as fallback', () => {
      const sub = { status: 'active', endDate: future, billingCycle: 'monthly', payments: [] };
      const result = isSubscriptionActive(sub);
      expect(result.isActive).toBe(false);
      expect(result.reason).toBe('no_payments');
    });

    it('returns false when last payment is not completed', () => {
      const result = isSubscriptionActive(makeSub({ Payment: [makePayment('pending')] }));
      expect(result.isActive).toBe(false);
      expect(result.reason).toBe('last_payment_not_completed');
    });

    it('returns false when payment is overdue beyond grace period', () => {
      const veryOld = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const result = isSubscriptionActive(makeSub({ Payment: [makePayment('completed', veryOld)] }));
      expect(result.isActive).toBe(false);
      expect(result.reason).toBe('payment_overdue');
      expect(result.details.daysOverdue).toBeGreaterThan(0);
    });

    it('returns true for a healthy active subscription', () => {
      const result = isSubscriptionActive(makeSub());
      expect(result.isActive).toBe(true);
      expect(result.details.nextPaymentDue).toBeDefined();
    });

    it('handles yearly billing cycle', () => {
      const result = isSubscriptionActive(makeSub({ billingCycle: 'yearly' }));
      expect(result.isActive).toBe(true);
    });

    it('handles null endDate (no expiry)', () => {
      const result = isSubscriptionActive(makeSub({ endDate: null }));
      expect(result.isActive).toBe(true);
    });
  });

  describe('getActiveSubscription', () => {
    it('returns null for null member', () => {
      expect(getActiveSubscription(null)).toBeNull();
    });

    it('returns null when no subscriptions', () => {
      expect(getActiveSubscription({ Subscription: [] })).toBeNull();
    });

    it('returns null when subscriptions is undefined', () => {
      expect(getActiveSubscription({})).toBeNull();
    });

    it('uses lowercase subscriptions field as fallback', () => {
      const result = getActiveSubscription({ subscriptions: [makeSub()] });
      expect(result).not.toBeNull();
      expect(result.isActive).toBeUndefined(); // spread, not in original
    });

    it('returns null when no active status subscriptions', () => {
      const member = { Subscription: [makeSub({ status: 'expired' })] };
      expect(getActiveSubscription(member)).toBeNull();
    });

    it('returns null when active sub fails isSubscriptionActive check', () => {
      const member = { Subscription: [makeSub({ Payment: [] })] };
      expect(getActiveSubscription(member)).toBeNull();
    });

    it('returns active subscription with activeCheck', () => {
      const member = { Subscription: [makeSub()] };
      const result = getActiveSubscription(member);
      expect(result).not.toBeNull();
      expect(result.activeCheck.isActive).toBe(true);
    });

    it('returns first valid active sub when multiple exist', () => {
      const member = {
        Subscription: [
          makeSub({ Payment: [] }),
          makeSub()
        ]
      };
      const result = getActiveSubscription(member);
      expect(result).not.toBeNull();
    });
  });

  describe('getSubscriptionsWithStatus', () => {
    it('returns empty array for null member', () => {
      expect(getSubscriptionsWithStatus(null)).toEqual([]);
    });

    it('returns empty array when no subscriptions', () => {
      expect(getSubscriptionsWithStatus({ Subscription: [] })).toEqual([]);
    });

    it('returns subscriptions with activeCheck added', () => {
      const member = { Subscription: [makeSub(), makeSub({ status: 'expired' })] };
      const result = getSubscriptionsWithStatus(member);
      expect(result).toHaveLength(2);
      expect(result[0].activeCheck).toBeDefined();
      expect(result[1].activeCheck.isActive).toBe(false);
    });
  });

});
