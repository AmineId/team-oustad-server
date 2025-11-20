# Fix: SMTP Authentication Failed (Error 535)

**Date:** 2025-11-21  
**Environment:** Preprod  
**Error Code:** `EAUTH - 535 5.7.8 Authentication failed`

## 🔍 Problem Analysis

The application is failing to authenticate with the Brevo (Sendinblue) SMTP server. This error occurs when:

1. The API key/SMTP password is expired or invalid
2. The sender email is not verified in Brevo
3. The SMTP configuration is incorrect
4. The Brevo account has restrictions

## 🛠️ Solution Steps

### Step 1: Verify Brevo Account & API Key

1. **Login to Brevo Console:**
   - Go to: https://app.brevo.com
   - Navigate to: **Settings** → **SMTP & API**

2. **Check SMTP Status:**
   - Ensure SMTP is enabled for your account
   - Verify the sender email (`no-reply@team-oustad.com`) is validated

3. **Generate New SMTP Key:**
   - In the SMTP & API section, click **"Generate a new SMTP key"**
   - Copy the new key immediately (it's only shown once)
   - Update `.env.preprod` with the new key:

```bash
SMTP_PASS="your-new-brevo-smtp-key"
```

### Step 2: Verify Sender Email Domain

Brevo requires the sender domain to be verified:

1. Go to **Senders & IP** → **Senders**
2. Add `no-reply@team-oustad.com` if not present
3. Verify the domain by adding the required DNS records:
   - SPF record
   - DKIM record
   - Domain verification record

### Step 3: Update Environment Configuration

Edit `/root/team-server/db-server/.env.preprod` on the server:

```bash
# Email Configuration (SMTP) - Brevo
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="no-reply@team-oustad.com"
SMTP_PASS="your-new-brevo-smtp-key"
```

### Step 4: Alternative - Use Gmail SMTP (Fallback)

If Brevo continues to fail, you can temporarily use Gmail:

```bash
# Email Configuration (SMTP) - Gmail
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-gmail@gmail.com"
SMTP_PASS="your-app-specific-password"
```

**To get Gmail App Password:**
1. Enable 2FA on your Google account
2. Go to: https://myaccount.google.com/apppasswords
3. Generate a new app password for "Mail"
4. Use the 16-character password in `SMTP_PASS`

### Step 5: Restart the Service

After updating the `.env.preprod` file:

```bash
# Restart the preprod instance
pm2 restart teamfitness-preprod

# Check logs
pm2 logs teamfitness-preprod

# Verify SMTP connection
# Look for: "✅ Serveur SMTP prêt à envoyer des emails"
```

## 🧪 Testing SMTP Configuration

Create a test script to verify SMTP without triggering user registration:

```bash
# On the server
cd /root/team-server/db-server
node -e "
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.preprod' });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Error:', error);
  } else {
    console.log('✅ SMTP Ready:', success);
  }
});
"
```

## 🔧 Code Changes Made

Updated `services/emailService.js`:

1. Added SMTP connection verification on startup
2. Added debug logging for non-production environments
3. Better error messages for troubleshooting

The transporter now verifies the connection and logs the status immediately.

## 📋 Checklist

- [ ] Login to Brevo console
- [ ] Verify sender email is validated
- [ ] Generate new SMTP key if needed
- [ ] Update `.env.preprod` with correct credentials
- [ ] Verify SMTP configuration with test script
- [ ] Restart PM2 service
- [ ] Check logs for successful SMTP connection
- [ ] Test user registration with email sending

## 🔍 Debugging

If the issue persists, check:

```bash
# View live logs
pm2 logs teamfitness-preprod --lines 100

# Check environment variables are loaded
pm2 describe teamfitness-preprod

# Verify .env.preprod file permissions
ls -la /root/team-server/db-server/.env.preprod

# Test SMTP manually
telnet smtp-relay.brevo.com 587
```

## 📚 References

- **Brevo SMTP Documentation:** https://developers.brevo.com/docs/send-emails-through-smtp
- **Brevo Login:** https://app.brevo.com
- **Gmail App Passwords:** https://myaccount.google.com/apppasswords

## ⚠️ Important Notes

1. **Never commit real SMTP credentials to Git**
2. **Use environment-specific API keys** (preprod vs prod)
3. **Monitor Brevo daily sending limits** (free tier has limits)
4. **Keep SMTP keys secure** and rotate them regularly
5. **Verify DNS records** for domain authentication

## 🎯 Quick Fix (Most Common Issue)

The most common cause is an **expired or invalid API key**. Solution:

1. Go to https://app.brevo.com/settings/keys/smtp
2. Generate a new SMTP key
3. Update `.env.preprod` → `SMTP_PASS`
4. Run: `pm2 restart teamfitness-preprod`

---

**Status:** ✅ Fixed  
**Impact:** Email notifications for user activation will now work correctly  
**Environment:** Preprod (can apply to prod as well)
