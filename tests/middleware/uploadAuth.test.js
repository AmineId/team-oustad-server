const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const uploadAuth = require('../../middleware/uploadAuth');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

const app = express();
app.use(express.json());
app.use('/protected', uploadAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

function makeToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h', ...options });
}

describe('uploadAuth middleware', () => {
  it('returns 401 when no Authorization header', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 401 when header does not start with Bearer', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Basic sometoken');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 403 when token role is member', async () => {
    const token = makeToken({ sub: 1, email: 'member@test.com', type: 'member' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('returns 401 when token is expired', async () => {
    const token = makeToken({ sub: 1, email: 'admin@test.com', type: 'admin' }, { expiresIn: '0s' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token expired');
  });

  it('returns 401 when token is invalid/malformed', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid token');
  });

  it('calls next and sets req.user when admin token is valid', async () => {
    const token = makeToken({ sub: 42, email: 'admin@test.com', type: 'admin' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.type).toBe('admin');
  });

  it('calls next and sets req.user when owner token is valid', async () => {
    const token = makeToken({ sub: 99, email: 'owner@test.com', type: 'owner' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.type).toBe('owner');
  });
});
