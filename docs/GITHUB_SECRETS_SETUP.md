# GitHub Secrets Setup Guide

This guide helps you set up the required GitHub Secrets for CI/CD workflows.

## Quick Setup Checklist

### 1. Testing CI (Already Working)
No secrets required! This workflow runs automatically on every push.

### 2. Preprod Deployment

Go to: **Repository Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

| Secret Name | How to Get It |
|-------------|---------------|
| `PREPROD_SSH_KEY` | Generate: `ssh-keygen -t ed25519 -C "github-preprod"` then copy private key |
| `PREPROD_HOST` | Your VPS IP or domain (e.g., `192.168.1.100` or `preprod.example.com`) |
| `PREPROD_USER` | SSH username (e.g., `deploy` or `ubuntu`) |
| `PREPROD_URL` | Full URL with https (e.g., `https://preprod.example.com`) |
| `PREPROD_PROJECT_PATH` | Path on VPS (e.g., `/home/deploy/db-server`) |

### 3. Production Deployment

Add these additional secrets:

| Secret Name | How to Get It |
|-------------|---------------|
| `PROD_SSH_KEY` | Generate: `ssh-keygen -t ed25519 -C "github-prod"` (use different key!) |
| `PROD_HOST` | Production VPS IP or domain |
| `PROD_USER` | SSH username for production |
| `PROD_URL` | Full production URL (e.g., `https://api.example.com`) |
| `PROD_PROJECT_PATH` | Production path (e.g., `/var/www/db-server`) |
| `PROD_BACKUP_PATH` | Backup directory (e.g., `/var/backups/db-server`) |

### 4. Optional: Code Coverage

| Secret Name | How to Get It |
|-------------|---------------|
| `CODECOV_TOKEN` | Get from https://codecov.io (free for open source) |

## Step-by-Step: SSH Key Setup

### Generate SSH Key Pair

```bash
# For Preprod
ssh-keygen -t ed25519 -C "github-actions-preprod" -f ~/.ssh/github_preprod

# For Production (separate key!)
ssh-keygen -t ed25519 -C "github-actions-prod" -f ~/.ssh/github_prod
```

### Add Public Key to VPS

```bash
# For Preprod
ssh-copy-id -i ~/.ssh/github_preprod.pub user@preprod-server

# For Production
ssh-copy-id -i ~/.ssh/github_prod.pub user@prod-server
```

Or manually:
```bash
# Copy public key content
cat ~/.ssh/github_preprod.pub

# SSH to server and add to authorized_keys
ssh user@server
nano ~/.ssh/authorized_keys
# Paste the public key, save and exit
```

### Add Private Key to GitHub

```bash
# Copy private key content
cat ~/.ssh/github_preprod
```

1. Go to GitHub: **Repository Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `PREPROD_SSH_KEY` (or `PROD_SSH_KEY`)
4. Value: Paste the ENTIRE private key including:
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   [key content]
   -----END OPENSSH PRIVATE KEY-----
   ```
5. Click **Add secret**

## Verify Setup

### Test SSH Connection
```bash
# Test preprod connection
ssh -i ~/.ssh/github_preprod user@preprod-server

# Test prod connection
ssh -i ~/.ssh/github_prod user@prod-server
```

### Check Secrets in GitHub
1. Go to: **Settings → Secrets and variables → Actions**
2. Verify all required secrets are present
3. Names should match exactly (case-sensitive)

## Environment Protection (Recommended for Production)

1. Go to: **Repository Settings → Environments**
2. Click **New environment**
3. Name: `production`
4. Add protection rules:
   - ✅ Required reviewers (select team members)
   - ✅ Wait timer (optional, e.g., 5 minutes)
   - ✅ Deployment branches: only `main`
5. Save

## Test Your Setup

### Test Preprod Deployment
1. Push to `staging` branch
2. Go to: **Actions → Deploy to Preprod (VPS)**
3. Watch the workflow run
4. Check logs if it fails

### Test Production Deployment
1. Go to: **Actions → Deploy to Production (VPS) → Run workflow**
2. Select `main` branch
3. Click **Run workflow**
4. Watch the deployment (if you set up reviewers, approve it first)

## Troubleshooting

### "Permission denied (publickey)"
- Check public key is in `~/.ssh/authorized_keys` on VPS
- Verify private key is correctly added to GitHub secrets
- Test SSH connection manually

### "Host key verification failed"
- The workflow adds known hosts automatically
- If issue persists, manually add to known_hosts on runner

### Deployment fails at PM2 restart
- Verify PM2 is installed on VPS: `pm2 --version`
- Check ecosystem.config.js exists in project
- Verify .env.preprod or .env.prod exists on VPS

### Health check fails
- Check if service is actually running: `pm2 list`
- Verify URL in secrets is correct
- Check logs: `pm2 logs`
- Test health endpoint manually: `curl https://your-url/health`

## Security Best Practices

✅ **DO:**
- Use different SSH keys for preprod and production
- Rotate keys every 3-6 months
- Use GitHub environment protection for production
- Enable 2FA for all team members
- Regularly audit access logs

❌ **DON'T:**
- Share SSH private keys via email/chat
- Commit private keys to repository
- Use same key for multiple environments
- Give unnecessary VPS access
- Disable security features "for convenience"

## Need Help?

1. Check the full documentation: [CI_CD_SETUP.md](CI_CD_SETUP.md)
2. Review GitHub Actions logs
3. Check VPS logs via SSH
4. Open an issue on GitHub

---

**Remember:** Security is important! Never commit secrets to the repository.
