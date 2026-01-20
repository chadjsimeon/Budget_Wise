#!/bin/bash

# Script to start the PostgreSQL container for local development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Starting Budget-Wise database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Start the PostgreSQL container
cd "$PROJECT_ROOT"
docker compose up -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
RETRIES=30
until docker exec budgetwise-db pg_isready -U user > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo -n "."
    RETRIES=$((RETRIES-1))
    sleep 1
done
echo ""

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}Error: Database failed to start within timeout.${NC}"
    exit 1
fi

echo -e "${GREEN}Database is ready!${NC}"
echo ""
echo "Connection info:"
echo -e "  Host:     ${YELLOW}localhost${NC}"
echo -e "  Port:     ${YELLOW}5432${NC}"
echo -e "  Database: ${YELLOW}budgetwise${NC}"
echo -e "  User:     ${YELLOW}postgres${NC}"
echo -e "  Password: ${YELLOW}postgres${NC}"
echo ""
echo -e "DATABASE_URL: ${YELLOW}postgresql://postgres:postgres@localhost:5432/budgetwise${NC}"
echo ""
echo "To run migrations: npm run db:migrate"
