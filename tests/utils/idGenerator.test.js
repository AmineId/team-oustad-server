const {
  generateUserId,
  generateMemberId,
  generateAdminId,
  generateOwnerId,
  generateGymId,
  generateSubscriptionId,
  generatePaymentId,
  generatePlanningId,
  generateExerciseId,
  generateSubscriptionTypeId,
  generateStoreProductId,
  generateStoreReservationId,
  generateBannerId,
  generateBannerVariantId,
  generateCheckInId,
  generateUserIdByRole,
  generateDisplayId,
  extractPrefix,
  isValidId
} = require('../../utils/idGenerator');

const HEX_16 = /^[a-f0-9]{16}$/;

describe('idGenerator', () => {

  describe('individual generators', () => {
    const cases = [
      ['generateUserId', generateUserId, 'USER'],
      ['generateMemberId', generateMemberId, 'MEMBER'],
      ['generateAdminId', generateAdminId, 'ADMIN'],
      ['generateOwnerId', generateOwnerId, 'OWNER'],
      ['generateGymId', generateGymId, 'GYM'],
      ['generateSubscriptionId', generateSubscriptionId, 'SUB'],
      ['generatePaymentId', generatePaymentId, 'PAY'],
      ['generatePlanningId', generatePlanningId, 'PLAN'],
      ['generateExerciseId', generateExerciseId, 'EXER'],
      ['generateSubscriptionTypeId', generateSubscriptionTypeId, 'SUBTYPE'],
      ['generateStoreProductId', generateStoreProductId, 'PROD'],
      ['generateStoreReservationId', generateStoreReservationId, 'RESV'],
      ['generateBannerId', generateBannerId, 'BANNER'],
      ['generateBannerVariantId', generateBannerVariantId, 'VARIANT'],
      ['generateCheckInId', generateCheckInId, 'CHECKIN']
    ];

    test.each(cases)('%s should have correct prefix and 16-char hex suffix', (name, fn, prefix) => {
      const id = fn();
      const parts = id.split('-');
      expect(parts[0]).toBe(prefix);
      expect(HEX_16.test(parts[parts.length - 1])).toBe(true);
    });

    test.each(cases)('%s should generate unique IDs', (name, fn) => {
      const ids = new Set(Array.from({ length: 20 }, fn));
      expect(ids.size).toBe(20);
    });
  });

  describe('generateUserIdByRole', () => {
    it('should generate MEMBER id for member role', () => {
      const id = generateUserIdByRole('member');
      expect(id.startsWith('MEMBER-')).toBe(true);
    });

    it('should generate ADMIN id for admin role', () => {
      const id = generateUserIdByRole('admin');
      expect(id.startsWith('ADMIN-')).toBe(true);
    });

    it('should generate OWNER id for owner role', () => {
      const id = generateUserIdByRole('owner');
      expect(id.startsWith('OWNER-')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(generateUserIdByRole('MEMBER').startsWith('MEMBER-')).toBe(true);
      expect(generateUserIdByRole('Admin').startsWith('ADMIN-')).toBe(true);
    });

    it('should throw for unknown role', () => {
      expect(() => generateUserIdByRole('superadmin')).toThrow('Unknown role: superadmin');
    });
  });

  describe('generateDisplayId', () => {
    it('should use given prefix', () => {
      const id = generateDisplayId('TEST');
      expect(id.startsWith('TEST-')).toBe(true);
    });

    it('should produce 16-char hex suffix', () => {
      const id = generateDisplayId('PREFIX');
      const hex = id.split('-')[1];
      expect(HEX_16.test(hex)).toBe(true);
    });
  });

  describe('extractPrefix', () => {
    it('should extract prefix from valid id', () => {
      expect(extractPrefix('MEMBER-a1b2c3d4e5f60708')).toBe('MEMBER');
    });

    it('should extract prefix from single-segment id', () => {
      expect(extractPrefix('GYM-abc123def456gh89')).toBe('GYM');
    });

    it('should return null for null input', () => {
      expect(extractPrefix(null)).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(extractPrefix(42)).toBeNull();
    });

    it('should return null for string without dash', () => {
      expect(extractPrefix('nodash')).toBeNull();
    });
  });

  describe('isValidId', () => {
    it('should return true for a valid generated id', () => {
      const id = generateMemberId();
      expect(isValidId(id)).toBe(true);
    });

    it('should return true with matching expectedPrefix', () => {
      const id = generateMemberId();
      expect(isValidId(id, 'MEMBER')).toBe(true);
    });

    it('should return false with wrong expectedPrefix', () => {
      const id = generateMemberId();
      expect(isValidId(id, 'ADMIN')).toBe(false);
    });

    it('should return false for null input', () => {
      expect(isValidId(null)).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isValidId(42)).toBe(false);
    });

    it('should return false for id with too short hex', () => {
      expect(isValidId('MEMBER-abc123')).toBe(false);
    });

    it('should return false for id with non-hex characters', () => {
      expect(isValidId('MEMBER-zzzzzzzzzzzzzzzz')).toBe(false);
    });

    it('should return false for id with multiple dashes (>2 parts)', () => {
      expect(isValidId('MEMBER-a1b2c3d4-e5f6g7h8')).toBe(false);
    });
  });

});
