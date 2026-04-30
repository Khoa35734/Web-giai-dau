#!/bin/bash

# Admin Dashboard Setup Script
# This script helps set up the admin account for WebGiaiDau

echo "🚀 WebGiaiDau Admin Dashboard Setup"
echo "===================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo -e "${BLUE}📡 Checking if server is running...${NC}"
SERVER_CHECK=$(curl -s http://localhost:5000/api/db-test)

if [ -z "$SERVER_CHECK" ]; then
  echo -e "${YELLOW}⚠️  Server is not running!${NC}"
  echo "Please start the server first:"
  echo "  cd server && npm run dev"
  exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Create admin account
echo -e "${BLUE}📝 Creating Admin Account${NC}"
echo "================================"
echo ""

read -p "Enter admin email: " ADMIN_EMAIL
read -s -p "Enter admin password: " ADMIN_PASSWORD
echo ""
read -p "Enter admin full name: " ADMIN_NAME

echo ""
echo -e "${YELLOW}Creating account...${NC}"

RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"full_name\": \"$ADMIN_NAME\"
  }")

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Admin account created successfully!${NC}"
  echo ""
  echo "Login credentials:"
  echo "  Email: $ADMIN_EMAIL"
  echo "  Password: ••••••••"
  echo ""
  echo -e "${BLUE}🎉 You can now login to the admin dashboard!${NC}"
else
  echo -e "${YELLOW}⚠️  Error creating admin account${NC}"
  echo "Response: $RESPONSE"
fi

echo ""
echo "For more information, see ADMIN_SETUP.md"
