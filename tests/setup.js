/**
 * Global test setup file
 * This file is run once before all tests
 */
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock email service to prevent actual email sending during tests
jest.mock('../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendAccountSetupEmail: jest.fn().mockResolvedValue(true),
  sendPaymentConfirmationEmail: jest.fn().mockResolvedValue(true),
  sendPaymentReminderEmail: jest.fn().mockResolvedValue(true)
}));

// Mock push notification service to prevent actual notifications during tests
jest.mock('../services/pushNotificationService', () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
  notifyNewTrainingPlan: jest.fn().mockResolvedValue(true),
  notifyPlanningModified: jest.fn().mockResolvedValue(true),
  notifyPlanningDeleted: jest.fn().mockResolvedValue(true),
  sendDailyPlanningNotifications: jest.fn().mockResolvedValue([])
}));

// Mock QRCode generation
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-qr-buffer'))
}));

// Suppress console logs during tests (optional, comment out for debugging)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error
};

// Global timeout for async operations
jest.setTimeout(30000);
