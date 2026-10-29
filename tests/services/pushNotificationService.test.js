// Le service réel (mocké globalement dans tests/setup.js), avec Firebase mocké
jest.unmock('../../services/pushNotificationService');

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(serviceAccount => ({ serviceAccount }))
}));

const mockMessaging = {
  send: jest.fn(),
  sendEachForMulticast: jest.fn()
};
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => mockMessaging
}));

jest.mock('../../utils/prismaClient', () => ({
  user: {
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn()
  }
}));

process.env.FIREBASE_SERVICE_ACCOUNT_PATH = './tests/fixtures/fake-service-account.json';

const { initializeApp, cert } = require('firebase-admin/app');
const {
  sendPushNotification,
  sendMulticastPushNotification
} = require('../../services/pushNotificationService');

describe('pushNotificationService', () => {
  beforeEach(() => {
    mockMessaging.send.mockResolvedValue('projects/p/messages/1');
    mockMessaging.sendEachForMulticast.mockImplementation(async ({ tokens }) => ({
      successCount: tokens.length,
      failureCount: 0,
      responses: tokens.map(() => ({ success: true }))
    }));
  });

  it('should initialize Firebase with the modular API and send', async () => {
    const result = await sendPushNotification('token-1', {
      title: 'Titre',
      body: 'Corps',
      data: { type: 'test' }
    });

    expect(cert).toHaveBeenCalledWith({ project_id: 'test-project' });
    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(mockMessaging.send).toHaveBeenCalledWith({
      notification: { title: 'Titre', body: 'Corps' },
      token: 'token-1',
      data: { type: 'test' }
    });
    expect(result).toEqual({ success: true, messageId: 'projects/p/messages/1' });
  });

  it('should send the image and split tokens in batches of 500', async () => {
    const tokens = Array.from({ length: 1201 }, (_, i) => `token-${i}`);

    const result = await sendMulticastPushNotification(tokens, {
      title: 'Tournoi',
      body: 'Inscrivez-vous',
      imageUrl: 'https://cdn.example.com/tournoi.jpg'
    });

    const batches = mockMessaging.sendEachForMulticast.mock.calls.map(([message]) => message);
    expect(batches.map(m => m.tokens.length)).toEqual([500, 500, 201]);
    expect(batches[2].tokens[200]).toBe('token-1200');
    expect(batches[0].notification).toEqual({
      title: 'Tournoi',
      body: 'Inscrivez-vous',
      imageUrl: 'https://cdn.example.com/tournoi.jpg'
    });
    expect(result).toMatchObject({ success: true, successCount: 1201, failureCount: 0 });
    expect(result.responses).toHaveLength(1201);
  });
});
