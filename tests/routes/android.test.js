const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock fs.promises before requiring the route
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn(),
      stat: jest.fn(),
      rename: jest.fn(),
      copyFile: jest.fn(),
      unlink: jest.fn()
    }
  };
});

const fs = require('fs').promises;
const androidRoutes = require('../../routes/android');

const app = express();
app.use(express.json());
app.use('/android', androidRoutes);

const versionData = {
  version_code: 5,
  version_name: '1.5.0',
  download_url: 'https://example.com/app.apk',
  changelog: 'Bug fixes',
  min_supported_version: 3,
  force_update: false,
  release_date: '2025-01-01',
  file_size: 10000000,
  checksum: 'abc123'
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Android Routes', () => {

  describe('GET /android/version', () => {
    it('should return version info when file exists', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(versionData));
      const res = await request(app).get('/android/version');
      expect(res.status).toBe(200);
      expect(res.body.version_code).toBe(5);
      expect(res.body.version_name).toBe('1.5.0');
    });

    it('should return 500 when version file is missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
      const res = await request(app).get('/android/version');
      expect(res.status).toBe(500);
    });

    it('should return beta version when channel=beta', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ ...versionData, channel: 'beta' }));
      const res = await request(app).get('/android/beta/version');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /android/check-update', () => {
    it('should return 400 when current_version is missing', async () => {
      const res = await request(app).get('/android/check-update');
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 when current_version is not a number', async () => {
      const res = await request(app).get('/android/check-update?current_version=abc');
      expect(res.status).toBe(400);
    });

    it('should return update_available true when newer version exists', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(versionData));
      const res = await request(app).get('/android/check-update?current_version=2');
      expect(res.status).toBe(200);
      expect(res.body.update_available).toBe(true);
      expect(res.body.latest_version).toBeDefined();
      expect(res.body.latest_version.version_code).toBe(5);
    });

    it('should return update_available false when up to date', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(versionData));
      const res = await request(app).get('/android/check-update?current_version=5');
      expect(res.status).toBe(200);
      expect(res.body.update_available).toBe(false);
      expect(res.body.latest_version).toBeNull();
    });

    it('should set force_update when below min version', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(versionData)); // min_supported_version: 3
      const res = await request(app).get('/android/check-update?current_version=2');
      expect(res.body.latest_version.force_update).toBe(true);
    });

    it('should return 500 when version file is missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      const res = await request(app).get('/android/check-update?current_version=1');
      expect(res.status).toBe(500);
    });

    it('should force update for beta channel', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(versionData));
      const res = await request(app).get('/android/beta/check-update?current_version=2');
      expect(res.status).toBe(200);
      expect(res.body.latest_version.force_update).toBe(true);
    });

    it('should pass device_id without errors', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(versionData));
      const res = await request(app).get('/android/check-update?current_version=2&device_id=DEVICE-123');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /android/download', () => {
    it('should redirect to Google Play for beta channel', async () => {
      const res = await request(app).get('/android/beta/download');
      expect(res.status).toBe(301);
    });

    it('should return 404 when APK file not found (production)', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      const res = await request(app).get('/android/download');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /android/checksum', () => {
    it('should return 404 when APK file not found', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      const res = await request(app).get('/android/checksum');
      expect(res.status).toBe(404);
    });

    it('should return checksums when APK exists', async () => {
      fs.access.mockResolvedValue(undefined);
      const fileBuffer = Buffer.from('fake apk content');
      fs.readFile.mockResolvedValue(fileBuffer);
      const res = await request(app).get('/android/checksum');
      expect(res.status).toBe(200);
      expect(res.body.md5).toBeDefined();
      expect(res.body.sha256).toBeDefined();
      expect(res.body.file_size).toBeDefined();
    });

    it('should return beta checksum for beta channel', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      const res = await request(app).get('/android/beta/checksum');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /android/config', () => {
    it('should return app configuration', async () => {
      const res = await request(app).get('/android/config');
      expect(res.status).toBe(200);
      expect(res.body.minVersion).toBeDefined();
      expect(res.body.features).toBeDefined();
    });
  });

});
