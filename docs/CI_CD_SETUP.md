# CI/CD Documentation

## Overview

This repository has three main CI/CD workflows:

1. **Testing CI** (`test.yml`) - Runs on every push and PR
2. **Preprod Deployment** (`deploy-preprod.yml`) - Auto-deploys staging branch to preprod VPS
3. **Production Deployment** (`deploy-production.yml`) - Deploys main branch to production VPS with robust controls

## 1. Testing CI (Priority 1) ✅

### What it does
- Runs automatically on every push to `main`, `staging`, and `develop` branches
- Runs on all pull requests
- Tests all API routes including:
  - Authentication routes
  - Gym management routes
  - Member management routes
  - Subscription management routes
  - Planning/Exercise routes
  - Banner routes
  - Check-in routes
  - Store routes
  - Android app routes
  - User management routes
- Tests email service integration (mocked)
- Generates code coverage reports
- Validates Prisma schema

### Local Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific route tests
npm run test:auth
npm run test:gyms
npm run test:subscriptions
npm run test:members

# Run tests in CI mode
npm run test:ci
```

## 2. Preprod Deployment (Priority 2) ✅

### What it does
- Triggers on every push to `staging` branch
- Runs full test suite before deployment
- Deploys to preprod VPS via SSH
- Restarts PM2 process automatically
- Performs health checks
- Rolls back automatically on failure

### Required GitHub Secrets

Set these in: Repository Settings → Secrets and variables → Actions

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `PREPROD_SSH_KEY` | Private SSH key for VPS access | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `PREPROD_HOST` | VPS hostname or IP address | `preprod.example.com` or `192.168.1.100` |
| `PREPROD_USER` | SSH username | `deploy` or `ubuntu` |
| `PREPROD_URL` | Full URL of preprod server | `https://preprod.example.com` |
| `PREPROD_PROJECT_PATH` | Project path on VPS | `/home/deploy/db-server` |

### Setup Instructions

1. **Generate SSH Key on your local machine:**
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-preprod" -f ~/.ssh/github_preprod
   ```

2. **Add public key to VPS:**
   ```bash
   ssh-copy-id -i ~/.ssh/github_preprod.pub user@preprod-server
   # Or manually add to ~/.ssh/authorized_keys on the VPS
   ```

3. **Add private key to GitHub Secrets:**
   - Copy the private key content:
     ```bash
     cat ~/.ssh/github_preprod
     ```
   - Go to GitHub: Settings → Secrets → New repository secret
   - Name: `PREPROD_SSH_KEY`
   - Value: Paste the entire private key (including BEGIN/END lines)

4. **Ensure VPS has required software:**
   ```bash
   # On the VPS
   sudo apt update
   sudo apt install -y nodejs npm postgresql-client git
   npm install -g pm2 dotenv-cli
   ```

5. **Setup project on VPS:**
   ```bash
   cd ~
   git clone https://github.com/TeamFitness/db-server.git
   cd db-server
   git checkout staging
   npm install
   
   # Copy environment file
   cp .env.preprod.example .env.preprod
   # Edit .env.preprod with actual credentials
   nano .env.preprod
   
   # Setup database
   npx prisma generate
   dotenv -e .env.preprod -- npx prisma migrate deploy
   
   # Start with PM2
   pm2 start ecosystem.config.js --only teamfitness-preprod
   pm2 save
   pm2 startup  # Follow instructions
   ```

### Manual Deployment
To trigger manually: Go to Actions → Deploy to Preprod (VPS) → Run workflow

## 3. Production Deployment (Priority 3) ✅

### What it does
- Triggers on push to `main` branch
- Runs full test suite with coverage requirements
- Creates automatic database backup before deployment
- Deploys to production VPS with zero-downtime (cluster mode)
- Performs extended health monitoring (60 seconds)
- Automatic rollback on failure
- Creates deployment tags
- Can be triggered manually with optional test skip

### Required GitHub Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `PROD_SSH_KEY` | Private SSH key for production VPS | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `PROD_HOST` | Production VPS hostname or IP | `prod.example.com` or `203.0.113.1` |
| `PROD_USER` | SSH username for production | `deploy` |
| `PROD_URL` | Full URL of production server | `https://api.example.com` |
| `PROD_PROJECT_PATH` | Project path on production VPS | `/var/www/db-server` |
| `PROD_BACKUP_PATH` | Backup directory path | `/var/backups/db-server` |

### Setup Instructions

1. **Generate separate SSH key for production:**
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-production" -f ~/.ssh/github_prod
   ```

2. **Add public key to production VPS:**
   ```bash
   ssh-copy-id -i ~/.ssh/github_prod.pub user@prod-server
   ```

3. **Add private key to GitHub Secrets** (same process as preprod)

4. **Setup production VPS:**
   ```bash
   # On production VPS
   sudo apt update
   sudo apt install -y nodejs npm postgresql-client git
   npm install -g pm2 dotenv-cli
   
   # Create project directory
   sudo mkdir -p /var/www/db-server
   sudo chown $USER:$USER /var/www/db-server
   
   cd /var/www/db-server
   git clone https://github.com/TeamFitness/db-server.git .
   git checkout main
   npm ci --production
   
   # Setup environment
   cp .env.prod.example .env.prod
   nano .env.prod  # Edit with production credentials
   
   # Setup database
   npx prisma generate
   dotenv -e .env.prod -- npx prisma migrate deploy
   
   # Start with PM2 in cluster mode
   pm2 start ecosystem.config.js --only teamfitness-prod
   pm2 save
   pm2 startup
   
   # Create backup directory
   mkdir -p ~/backups
   ```

5. **Setup GitHub Environment Protection:**
   - Go to: Repository Settings → Environments → New environment
   - Name: `production`
   - Add required reviewers (recommended)
   - Add deployment branches rule (only `main`)

### Manual Deployment
Go to: Actions → Deploy to Production (VPS) → Run workflow

### Rollback Procedure

If automatic rollback fails, manual rollback:

```bash
# SSH into production
ssh user@prod-server

cd /var/www/db-server

# View recent commits
git log --oneline -5

# Rollback to previous commit
git checkout <previous-commit-sha>

# Reinstall dependencies
npm ci --production

# Regenerate Prisma client
npx prisma generate

# Restart PM2
pm2 reload teamfitness-prod

# Monitor logs
pm2 logs teamfitness-prod
```

## Monitoring and Logs

### View PM2 Logs
```bash
# Real-time logs
pm2 logs teamfitness-preprod
pm2 logs teamfitness-prod

# Last 100 lines
pm2 logs --lines 100

# Error logs only
pm2 logs --err
```

### PM2 Management
```bash
# Status
pm2 list

# Restart
pm2 restart teamfitness-preprod
pm2 restart teamfitness-prod

# Stop
pm2 stop teamfitness-preprod

# Reload (zero-downtime)
pm2 reload teamfitness-prod

# Monitor
pm2 monit
```

### Health Checks
```bash
# Preprod
curl https://preprod.example.com/health

# Production
curl https://api.example.com/health
```

## Troubleshooting

### Tests failing in CI
1. Check test logs in GitHub Actions
2. Run tests locally: `npm test`
3. Check database migrations: `npx prisma migrate status`

### Deployment failing
1. Check GitHub Actions logs
2. Verify SSH connectivity: `ssh user@server`
3. Check PM2 logs on server: `pm2 logs`
4. Verify environment variables on server

### Health check failing
1. Check if service is running: `pm2 list`
2. Check logs: `pm2 logs`
3. Verify database connection
4. Check nginx/reverse proxy configuration

### Database migration issues
```bash
# On VPS
cd /path/to/project
dotenv -e .env.preprod -- npx prisma migrate status
dotenv -e .env.preprod -- npx prisma migrate resolve --applied <migration_name>
```

## Best Practices

1. **Always test locally before pushing**
2. **Use staging branch for preprod testing**
3. **Only merge to main after preprod verification**
4. **Monitor production deployments for at least 5 minutes**
5. **Keep backups for at least 7 days**
6. **Test rollback procedure in preprod**
7. **Review failed deployment logs immediately**

## Security Notes

- SSH keys are stored as GitHub secrets (encrypted)
- Never commit `.env` files
- Use different SSH keys for preprod and production
- Regularly rotate SSH keys (quarterly recommended)
- Use GitHub environment protection for production
- Enable 2FA for all team members
- Regular security audits: `npm audit`

## Support

For issues:
1. Check GitHub Actions logs
2. Check server logs via SSH
3. Review this documentation
4. Contact DevOps team
