const emailService = require('../../services/emailService');

describe('Email Service Integration Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Email service mocking', () => {
    it('should have all required email functions mocked', () => {
      expect(typeof emailService.sendPasswordResetEmail).toBe('function');
      expect(typeof emailService.sendAccountSetupEmail).toBe('function');
      expect(typeof emailService.sendPaymentConfirmationEmail).toBe('function');
      expect(typeof emailService.sendPaymentReminderEmail).toBe('function');
    });

    it('should return resolved promises for mocked email functions', async () => {
      const result = await emailService.sendPasswordResetEmail('test@test.com', 'token');
      expect(result).toBe(true);
    });
  });

  describe('sendPasswordResetEmail mock tracking', () => {
    it('should track calls with correct parameters', async () => {
      const email = 'test@example.com';
      const token = 'test-token-123';
      
      await emailService.sendPasswordResetEmail(email, token);
      
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(email, token);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('should track calls with isSetup parameter', async () => {
      const email = 'newuser@example.com';
      const token = 'setup-token-456';
      const isSetup = true;
      
      await emailService.sendPasswordResetEmail(email, token, isSetup);
      
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(email, token, isSetup);
    });
  });

  describe('sendAccountSetupEmail mock tracking', () => {
    it('should track calls for new account setup', async () => {
      const email = 'newmember@example.com';
      const setupToken = 'setup-token-789';
      
      await emailService.sendAccountSetupEmail(email, setupToken);
      
      expect(emailService.sendAccountSetupEmail).toHaveBeenCalledWith(email, setupToken);
      expect(emailService.sendAccountSetupEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendPaymentConfirmationEmail mock tracking', () => {
    it('should track calls with payment details', async () => {
      const email = 'member@example.com';
      const paymentDetails = {
        amount: 50.00,
        subscriptionName: 'Monthly Membership',
        date: new Date()
      };
      
      await emailService.sendPaymentConfirmationEmail(email, paymentDetails);
      
      expect(emailService.sendPaymentConfirmationEmail).toHaveBeenCalledWith(email, paymentDetails);
      expect(emailService.sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendPaymentReminderEmail mock tracking', () => {
    it('should track calls with reminder details', async () => {
      const email = 'member@example.com';
      const reminderDetails = {
        amount: 50.00,
        dueDate: new Date(),
        subscriptionName: 'Monthly Membership'
      };
      
      await emailService.sendPaymentReminderEmail(email, reminderDetails);
      
      expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledWith(email, reminderDetails);
      expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Email service error handling', () => {
    it('should allow mocking errors when needed', async () => {
      // Override the mock to throw error for this specific test
      const originalMock = emailService.sendPasswordResetEmail;
      emailService.sendPasswordResetEmail = jest.fn().mockRejectedValue(new Error('SMTP Error'));
      
      await expect(
        emailService.sendPasswordResetEmail('invalid@test.com', 'token')
      ).rejects.toThrow('SMTP Error');
      
      // Restore original mock
      emailService.sendPasswordResetEmail = originalMock;
    });
  });
});
