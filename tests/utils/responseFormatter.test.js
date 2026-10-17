const {
  formatUser,
  formatUsers,
  formatWithUserRelations,
  formatArrayWithUserRelations,
  formatPlanning,
  formatSubscription,
  formatPayment
} = require('../../utils/responseFormatter');

describe('responseFormatter', () => {

  describe('formatUser', () => {
    it('should return null for null input', () => {
      expect(formatUser(null)).toBeNull();
    });

    it('should add memberId and userId pointing to displayId', () => {
      const user = { id: 1, displayId: 'USR-abc123', email: 'a@b.com' };
      const result = formatUser(user);
      expect(result.memberId).toBe('USR-abc123');
      expect(result.userId).toBe('USR-abc123');
    });

    it('should preserve all original fields', () => {
      const user = { id: 5, displayId: 'USR-xyz', email: 'x@y.com', role: 'admin' };
      const result = formatUser(user);
      expect(result.id).toBe(5);
      expect(result.email).toBe('x@y.com');
      expect(result.role).toBe('admin');
    });
  });

  describe('formatUsers', () => {
    it('should return empty array for non-array input', () => {
      expect(formatUsers(null)).toEqual([]);
      expect(formatUsers(undefined)).toEqual([]);
      expect(formatUsers('string')).toEqual([]);
    });

    it('should format each user in array', () => {
      const users = [
        { id: 1, displayId: 'U1' },
        { id: 2, displayId: 'U2' }
      ];
      const result = formatUsers(users);
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('U1');
      expect(result[1].userId).toBe('U2');
    });

    it('should return empty array for empty input', () => {
      expect(formatUsers([])).toEqual([]);
    });
  });

  describe('formatWithUserRelations', () => {
    it('should return null for null input', () => {
      expect(formatWithUserRelations(null)).toBeNull();
    });

    it('should format nested user', () => {
      const obj = { id: 10, user: { id: 1, displayId: 'USR-1' } };
      const result = formatWithUserRelations(obj);
      expect(result.user.userId).toBe('USR-1');
    });

    it('should format nested member.User', () => {
      const obj = {
        id: 10,
        member: { User: { id: 1, displayId: 'USR-M' } }
      };
      const result = formatWithUserRelations(obj);
      expect(result.member.User.userId).toBe('USR-M');
      expect(result.member.userId).toBe('USR-M');
      expect(result.member.memberId).toBe('USR-M');
    });

    it('should format nested coach', () => {
      const obj = { id: 10, coach: { id: 2, displayId: 'USR-C' } };
      const result = formatWithUserRelations(obj);
      expect(result.coach.userId).toBe('USR-C');
      expect(result.coachId).toBe('USR-C');
    });

    it('should format nested admin', () => {
      const obj = { id: 10, admin: { id: 3, displayId: 'USR-A' } };
      const result = formatWithUserRelations(obj);
      expect(result.admin.userId).toBe('USR-A');
    });

    it('should format nested owner', () => {
      const obj = { id: 10, owner: { id: 4, displayId: 'USR-O' } };
      const result = formatWithUserRelations(obj);
      expect(result.owner.userId).toBe('USR-O');
    });

    it('should handle object with no nested relations', () => {
      const obj = { id: 10, name: 'test' };
      const result = formatWithUserRelations(obj);
      expect(result).toEqual({ id: 10, name: 'test' });
    });
  });

  describe('formatArrayWithUserRelations', () => {
    it('should return empty array for non-array input', () => {
      expect(formatArrayWithUserRelations(null)).toEqual([]);
      expect(formatArrayWithUserRelations(undefined)).toEqual([]);
    });

    it('should format each item in array', () => {
      const items = [
        { id: 1, coach: { id: 2, displayId: 'C1' } },
        { id: 2, coach: { id: 3, displayId: 'C2' } }
      ];
      const result = formatArrayWithUserRelations(items);
      expect(result[0].coachId).toBe('C1');
      expect(result[1].coachId).toBe('C2');
    });
  });

  describe('formatPlanning', () => {
    it('should return null for null input', () => {
      expect(formatPlanning(null)).toBeNull();
    });

    it('should format member.User and set memberId', () => {
      const planning = {
        id: 1,
        member: { User: { id: 5, displayId: 'USR-P' } }
      };
      const result = formatPlanning(planning);
      expect(result.member.User.userId).toBe('USR-P');
      expect(result.memberId).toBe('USR-P');
    });

    it('should format coach and set coachId', () => {
      const planning = {
        id: 1,
        coach: { id: 3, displayId: 'USR-C' }
      };
      const result = formatPlanning(planning);
      expect(result.coach.userId).toBe('USR-C');
      expect(result.coachId).toBe('USR-C');
    });

    it('should handle planning without relations', () => {
      const planning = { id: 1, title: 'Plan A' };
      const result = formatPlanning(planning);
      expect(result.title).toBe('Plan A');
    });
  });

  describe('formatSubscription', () => {
    it('should return null for null input', () => {
      expect(formatSubscription(null)).toBeNull();
    });

    it('should format member.User and set memberId', () => {
      const sub = {
        id: 1,
        member: { User: { id: 5, displayId: 'USR-S' } }
      };
      const result = formatSubscription(sub);
      expect(result.member.User.userId).toBe('USR-S');
      expect(result.memberId).toBe('USR-S');
    });

    it('should handle subscription without member', () => {
      const sub = { id: 1, status: 'active' };
      const result = formatSubscription(sub);
      expect(result.status).toBe('active');
    });
  });

  describe('formatPayment', () => {
    it('should return null for null input', () => {
      expect(formatPayment(null)).toBeNull();
    });

    it('should format member.User and set memberId', () => {
      const payment = {
        id: 1,
        member: { User: { id: 5, displayId: 'USR-PAY' } }
      };
      const result = formatPayment(payment);
      expect(result.member.User.userId).toBe('USR-PAY');
      expect(result.memberId).toBe('USR-PAY');
    });

    it('should format nested subscription', () => {
      const payment = {
        id: 1,
        subscription: {
          id: 2,
          member: { User: { id: 5, displayId: 'USR-X' } }
        }
      };
      const result = formatPayment(payment);
      expect(result.subscription.memberId).toBe('USR-X');
    });

    it('should handle payment without member or subscription', () => {
      const payment = { id: 1, amount: 100 };
      const result = formatPayment(payment);
      expect(result.amount).toBe(100);
    });
  });

});
