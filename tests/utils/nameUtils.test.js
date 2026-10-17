const { getFullName, splitFullName, formatUserWithFullName } = require('../../utils/nameUtils');

describe('nameUtils', () => {

  describe('getFullName', () => {
    it('should return empty string for null input', () => {
      expect(getFullName(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(getFullName(undefined)).toBe('');
    });

    it('should combine firstName and lastName', () => {
      expect(getFullName({ firstName: 'Alice', lastName: 'Smith' })).toBe('Alice Smith');
    });

    it('should fall back to fullName when lastName is empty string (falsy)', () => {
      expect(getFullName({ firstName: 'Alice', lastName: '', fullName: 'Alice' })).toBe('Alice');
    });

    it('should fall back to fullName when no firstName/lastName', () => {
      expect(getFullName({ fullName: 'Bob Jones' })).toBe('Bob Jones');
    });

    it('should return empty string when no name fields', () => {
      expect(getFullName({})).toBe('');
    });

    it('should prefer firstName/lastName over fullName', () => {
      expect(getFullName({ firstName: 'Alice', lastName: 'Smith', fullName: 'Old Name' })).toBe('Alice Smith');
    });
  });

  describe('splitFullName', () => {
    it('should return empty strings for null input', () => {
      expect(splitFullName(null)).toEqual({ firstName: '', lastName: '' });
    });

    it('should return empty strings for undefined input', () => {
      expect(splitFullName(undefined)).toEqual({ firstName: '', lastName: '' });
    });

    it('should return empty strings for non-string input', () => {
      expect(splitFullName(42)).toEqual({ firstName: '', lastName: '' });
    });

    it('should return empty strings for empty string', () => {
      expect(splitFullName('')).toEqual({ firstName: '', lastName: '' });
    });

    it('should handle single name', () => {
      expect(splitFullName('Alice')).toEqual({ firstName: 'Alice', lastName: '' });
    });

    it('should split first and last name', () => {
      expect(splitFullName('Alice Smith')).toEqual({ firstName: 'Alice', lastName: 'Smith' });
    });

    it('should handle compound last name (3 words)', () => {
      expect(splitFullName('Jean Pierre Dupont')).toEqual({ firstName: 'Jean', lastName: 'Pierre Dupont' });
    });

    it('should trim leading/trailing spaces', () => {
      expect(splitFullName('  Alice Smith  ')).toEqual({ firstName: 'Alice', lastName: 'Smith' });
    });
  });

  describe('formatUserWithFullName', () => {
    it('should return null for null input', () => {
      expect(formatUserWithFullName(null)).toBeNull();
    });

    it('should add fullName field from firstName and lastName', () => {
      const user = { id: 1, firstName: 'Alice', lastName: 'Smith' };
      const result = formatUserWithFullName(user);
      expect(result.fullName).toBe('Alice Smith');
    });

    it('should preserve all original fields', () => {
      const user = { id: 1, firstName: 'Alice', lastName: 'Smith', email: 'a@b.com' };
      const result = formatUserWithFullName(user);
      expect(result.id).toBe(1);
      expect(result.email).toBe('a@b.com');
    });

    it('should add fullName from fallback fullName field', () => {
      const user = { id: 1, fullName: 'Bob Jones' };
      const result = formatUserWithFullName(user);
      expect(result.fullName).toBe('Bob Jones');
    });
  });

});
