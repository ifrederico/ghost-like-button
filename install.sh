#!/bin/bash
set -e

echo "🎯 Ghost Like Button Installer"
echo ""

# Determine if we're in a cloned repo or need to fetch files
if [ -f "compose.yml" ]; then
    echo "✓ Found existing files"
    IN_REPO=true
else
    echo "📦 Fetching installation files..."
    IN_REPO=false
    
    # Create installation directory
    INSTALL_DIR="ghost-like-button"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Download required files
    curl -sO https://raw.githubusercontent.com/ifrederico/ghost-like-button/master/compose.yml
    curl -sO https://raw.githubusercontent.com/ifrederico/ghost-like-button/master/.env.example
fi

# Get Ghost URL
read -p "Enter your Ghost URL (e.g., https://yourdomain.com): " GHOST_URL

# Validate URL format
if [[ ! "$GHOST_URL" =~ ^https?:// ]]; then
    echo "❌ Error: Ghost URL must start with http:// or https://"
    exit 1
fi

# Create directories with correct permissions
echo "📁 Creating directories..."
mkdir -p data
chown -R 1000:1000 data/ 2>/dev/null || chmod -R 755 data/

# Create .env file
echo "📝 Creating configuration..."
cat > .env << EOF
GHOST_URL=$GHOST_URL
PORT=8787
NODE_ENV=production
EOF

# Get Ghost network name
echo ""
echo "🔍 Looking for Ghost Docker network..."
GHOST_NETWORK=$(docker network ls --format "{{.Name}}" | grep ghost | head -n 1)

if [ -z "$GHOST_NETWORK" ]; then
    read -p "Enter your Ghost Docker network name: " GHOST_NETWORK
else
    echo "Found: $GHOST_NETWORK"
    read -p "Use this network? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        read -p "Enter your Ghost Docker network name: " GHOST_NETWORK
    fi
fi

# Update compose.yml with network name
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/ghost_ghost_network/$GHOST_NETWORK/g" compose.yml
else
    # Linux
    sed -i "s/ghost_ghost_network/$GHOST_NETWORK/g" compose.yml
fi

echo ""
echo "🚀 Starting Ghost Like Button..."
docker compose up -d

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "  📊 Check logs: docker compose logs ghost-like-button"
echo "  🏥 Health check: curl http://localhost:8787/health"
if [ "$IN_REPO" = false ]; then
    echo "  📁 Installation directory: $(pwd)"
fi
echo ""
echo "📖 See README.md for theme integration instructions"