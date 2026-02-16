#!/bin/bash

# Script to stop the PostgreSQL container

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Stopping Budget-Wise database..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Stop the PostgreSQL container
cd "$PROJECT_ROOT"
docker compose down

echo -e "${GREEN}Database stopped successfully.${NC}"
echo ""
echo -e "${YELLOW}Note: Data is persisted in a Docker volume. Use 'docker compose down -v' to remove data.${NC}"
