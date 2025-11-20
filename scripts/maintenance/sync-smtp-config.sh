#!/bin/bash

###############################################################################
# SMTP Configuration Sync Script
# 
# This script helps you sync the correct .env.preprod file to your server
# and restart the service to fix SMTP authentication issues.
#
# Usage:
#   ./scripts/maintenance/sync-smtp-config.sh
#
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_USER="root"
SERVER_HOST="your-preprod-server-hostname-or-ip"
SERVER_PATH="/root/team-server/db-server"
LOCAL_ENV_FILE=".env.preprod"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SMTP Configuration Sync - Team Fitness Preprod Server   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if local .env.preprod exists
if [ ! -f "$LOCAL_ENV_FILE" ]; then
    echo -e "${RED}❌ Error: $LOCAL_ENV_FILE not found in current directory${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Display current SMTP config from local file
echo -e "${YELLOW}📋 Local SMTP Configuration:${NC}"
grep -E "^SMTP_" "$LOCAL_ENV_FILE" | while read line; do
    key=$(echo "$line" | cut -d'=' -f1)
    value=$(echo "$line" | cut -d'=' -f2-)
    
    # Mask the password
    if [[ "$key" == "SMTP_PASS" ]]; then
        masked_value="***${value: -8}"
        echo "   $key=$masked_value"
    else
        echo "   $line"
    fi
done
echo ""

# Prompt for server details
echo -e "${YELLOW}🔧 Server Configuration:${NC}"
read -p "Enter server user (default: root): " input_user
SERVER_USER=${input_user:-$SERVER_USER}

read -p "Enter server hostname or IP: " input_host
if [ -z "$input_host" ]; then
    echo -e "${RED}❌ Server hostname is required${NC}"
    exit 1
fi
SERVER_HOST="$input_host"

read -p "Enter server path (default: $SERVER_PATH): " input_path
SERVER_PATH=${input_path:-$SERVER_PATH}

echo ""
echo -e "${YELLOW}🚀 Actions to perform:${NC}"
echo "   1. Backup current .env.preprod on server"
echo "   2. Upload new .env.preprod to server"
echo "   3. Test SMTP connection on server"
echo "   4. Restart PM2 service"
echo "   5. Show logs"
echo ""

read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
    echo -e "${YELLOW}⚠️  Aborted by user${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test SSH connection
echo -e "${YELLOW}🔌 Testing SSH connection...${NC}"
if ssh -o ConnectTimeout=5 "$SERVER_USER@$SERVER_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH connection OK${NC}"
else
    echo -e "${RED}❌ Cannot connect to server via SSH${NC}"
    echo "Please check:"
    echo "  - Server hostname/IP is correct"
    echo "  - SSH keys are configured"
    echo "  - Server is accessible from your network"
    exit 1
fi
echo ""

# Step 1: Backup current .env.preprod
echo -e "${YELLOW}💾 Creating backup of current .env.preprod on server...${NC}"
ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && cp .env.preprod .env.preprod.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  No existing .env.preprod to backup (this is OK for first-time setup)${NC}"
}
echo -e "${GREEN}✅ Backup created${NC}"
echo ""

# Step 2: Upload new .env.preprod
echo -e "${YELLOW}📤 Uploading new .env.preprod to server...${NC}"
scp "$LOCAL_ENV_FILE" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/.env.preprod"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ File uploaded successfully${NC}"
else
    echo -e "${RED}❌ Upload failed${NC}"
    exit 1
fi
echo ""

# Step 3: Test SMTP connection
echo -e "${YELLOW}🧪 Testing SMTP connection on server...${NC}"
ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && node scripts/test-smtp.js preprod" || {
    echo -e "${RED}❌ SMTP test failed${NC}"
    echo ""
    echo -e "${YELLOW}Possible issues:${NC}"
    echo "  1. SMTP credentials are still incorrect"
    echo "  2. Server cannot reach smtp-relay.brevo.com (firewall issue)"
    echo "  3. Node.js or dependencies are not installed"
    echo ""
    echo -e "${YELLOW}To restore previous config:${NC}"
    echo "  ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && cp .env.preprod.backup.* .env.preprod'"
    exit 1
}
echo -e "${GREEN}✅ SMTP connection successful${NC}"
echo ""

# Step 4: Restart PM2 service
echo -e "${YELLOW}🔄 Restarting PM2 service...${NC}"
ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && pm2 restart teamfitness-preprod"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Service restarted${NC}"
else
    echo -e "${RED}❌ Failed to restart service${NC}"
    exit 1
fi
echo ""

# Step 5: Show logs
echo -e "${YELLOW}📋 Recent logs (last 20 lines):${NC}"
ssh "$SERVER_USER@$SERVER_HOST" "pm2 logs teamfitness-preprod --lines 20 --nostream"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}🎉 SMTP configuration sync completed!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Monitor logs: ssh $SERVER_USER@$SERVER_HOST 'pm2 logs teamfitness-preprod'"
echo "  2. Test user registration to verify email sending"
echo "  3. Check for '✅ Serveur SMTP prêt à envoyer des emails' in logs"
echo ""
echo -e "${YELLOW}If issues persist:${NC}"
echo "  - Check Brevo account: https://app.brevo.com/settings/keys/smtp"
echo "  - Verify sender domain is validated"
echo "  - Generate new SMTP key if needed"
echo ""
