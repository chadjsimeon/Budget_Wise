#!/bin/bash

# Script to run database migrations using Drizzle Kit

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}DATABASE_URL not set. Using default local connection.${NC}"
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/budgetwise"
fi

echo "Running database migrations..."
echo -e "Using DATABASE_URL: ${YELLOW}${DATABASE_URL}${NC}"
echo ""

# Run Drizzle Kit push
if npm run db:push; then
    echo ""
    echo -e "${GREEN}Database migrations completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}Database migrations failed.${NC}"
    echo "Make sure the database is running: npm run db:start"
    exit 1
fi
