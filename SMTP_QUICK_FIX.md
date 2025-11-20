# Quick Fix: SMTP Authentication Error 535

## 🚨 The Problem
Your preprod server cannot send emails due to SMTP authentication failure with Brevo.

## ⚡ Quick Solution (5 minutes)

### Option 1: Get New Brevo API Key (Recommended)

1. **Go to Brevo Console:**
   ```
   https://app.brevo.com/settings/keys/smtp
   ```

2. **Generate new SMTP key** and copy it

3. **SSH to your preprod server:**
   ```bash
   ssh root@your-preprod-server
   cd /root/team-server/db-server
   ```

4. **Edit .env.preprod:**
   ```bash
   nano .env.preprod
   ```
   
   Update the line:
   ```bash
   SMTP_PASS="your-new-brevo-smtp-key-here"
   ```
   
   Save: `Ctrl+O`, `Enter`, `Ctrl+X`

5. **Test SMTP connection:**
   ```bash
   node scripts/test-smtp.js preprod
   ```
   
   You should see: ✅ CONNEXION SMTP RÉUSSIE!

6. **Restart the service:**
   ```bash
   pm2 restart teamfitness-preprod
   pm2 logs teamfitness-preprod
   ```

### Option 2: Use Gmail SMTP (Temporary Fallback)

If Brevo doesn't work, switch to Gmail:

1. **Generate Gmail App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Generate password for "Mail"

2. **Update .env.preprod:**
   ```bash
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER="your-gmail@gmail.com"
   SMTP_PASS="your-16-char-app-password"
   ```

3. **Test and restart:**
   ```bash
   node scripts/test-smtp.js preprod
   pm2 restart teamfitness-preprod
   ```

## 🧪 Testing

### Local Test (from your dev machine):
```bash
node scripts/test-smtp.js preprod
```

### Send Real Test Email:
```bash
node scripts/test-smtp.js preprod --send your-email@example.com
```

### Check Logs:
```bash
pm2 logs teamfitness-preprod --lines 50
```

## ✅ Verification

After fixing, you should see in logs:
```
✅ Serveur SMTP prêt à envoyer des emails
```

Test user registration to confirm emails are sent.

## 📚 More Details

See: `docs/bugfix/SMTP_AUTH_FAILURE_FIX.md` for complete troubleshooting guide.

---

**Quick Commands:**

```bash
# Test SMTP
node scripts/test-smtp.js preprod

# Restart service
pm2 restart teamfitness-preprod

# View logs
pm2 logs teamfitness-preprod
```
