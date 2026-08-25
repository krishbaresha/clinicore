#!/bin/bash
# =============================================================================
# CliniCore VPS Master Fix Script
# Fixes: Namespace/folder casing, Nginx 403, DB setup, PHP-FPM socket, .env
# =============================================================================

set -e
CLINICORE_DIR="/var/www/clinicore"
BACKEND_DIR="$CLINICORE_DIR/backend"
FRONTEND_DIR="$CLINICORE_DIR/frontend"
DB_NAME="clinicore"
DB_USER="clinicore_user"
DB_PASS="CF_Secure2024!"

echo ""
echo "======================================================"
echo "  CliniCore VPS Master Fix — Starting..."
echo "======================================================"

# ─────────────────────────────────────────────────────────
# STEP 1: Fix Linux case-sensitive namespace folder structure
# ─────────────────────────────────────────────────────────
echo ""
echo "[1/8] Fixing PHP namespace folder casing (Linux case-sensitive)..."

for folder in config:Config controllers:Controllers middleware:Middleware models:Models routes:Routes utils:Utils; do
    src="${folder%%:*}"
    dst="${folder##*:}"
    if [ -d "$src" ]; then
        mkdir -p "$dst"
        cp -rn "$src"/* "$dst"/ 2>/dev/null || true
        rm -rf "$src"
        echo "  $src -> $dst (merged & cleaned)"
    fi
done

echo "  DONE: Namespace folders fixed."

# ─────────────────────────────────────────────────────────
# STEP 2: Remove conflicting db.php
# ─────────────────────────────────────────────────────────
echo ""
echo "[2/8] Cleaning conflicting config files..."
[ -f "$BACKEND_DIR/src/Config/db.php" ] && rm "$BACKEND_DIR/src/Config/db.php" && echo "  Removed db.php"

# ─────────────────────────────────────────────────────────
# STEP 3: MySQL database and user setup
# ─────────────────────────────────────────────────────────
echo ""
echo "[3/8] Setting up MySQL database and user..."

mysql -u root <<MYSQL_EOF
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF

echo "  DB '$DB_NAME' and user '$DB_USER' ready."

# ─────────────────────────────────────────────────────────
# STEP 4: Import production schema
# ─────────────────────────────────────────────────────────
echo ""
echo "[4/8] Importing production schema..."

if [ -f "$CLINICORE_DIR/database/production_schema.sql" ]; then
    mysql -u root "$DB_NAME" < "$CLINICORE_DIR/database/production_schema.sql"
    TABLE_COUNT=$(mysql -u root -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';")
    echo "  Schema imported. Tables: $TABLE_COUNT"
else
    echo "  SKIP: Schema file not found."
fi

# ─────────────────────────────────────────────────────────
# STEP 5: Import seed data
# ─────────────────────────────────────────────────────────
echo ""
echo "[5/8] Importing seed data..."

if [ -f "$CLINICORE_DIR/database/production_seed.sql" ]; then
    mysql -u root "$DB_NAME" < "$CLINICORE_DIR/database/production_seed.sql"
    USER_COUNT=$(mysql -u root -sN -e "SELECT COUNT(*) FROM \`$DB_NAME\`.users;" 2>/dev/null || echo "0")
    echo "  Seed imported. Users: $USER_COUNT"
else
    echo "  SKIP: Seed file not found."
fi

# ─────────────────────────────────────────────────────────
# STEP 6: Production .env
# ─────────────────────────────────────────────────────────
echo ""
echo "[6/8] Writing production .env..."

JWT_SECRET=$(openssl rand -hex 32)

cat > "$BACKEND_DIR/.env" <<ENV_EOF
APP_NAME=CliniCore
APP_ENV=production
APP_DEBUG=false
APP_URL=http://77.37.45.233

DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=$DB_NAME
DB_USERNAME=$DB_USER
DB_PASSWORD=$DB_PASS

JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=86400

STORAGE_PATH=$BACKEND_DIR/storage/files
ENV_EOF

chmod 640 "$BACKEND_DIR/.env"
echo "  .env written."

# ─────────────────────────────────────────────────────────
# STEP 7: Fix Nginx configuration
# ─────────────────────────────────────────────────────────
echo ""
echo "[7/8] Writing Nginx configuration..."

PHP_SOCKET=$(find /run/php/ -name "php*-fpm.sock" 2>/dev/null | head -1)
[ -z "$PHP_SOCKET" ] && PHP_SOCKET="/run/php/php8.3-fpm.sock"
echo "  PHP-FPM socket: $PHP_SOCKET"

# Create frontend placeholder
mkdir -p "$FRONTEND_DIR/dist"
if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
cat > "$FRONTEND_DIR/dist/index.html" <<'HTML_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CliniCore Enterprise</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Segoe UI',sans-serif}
        .card{background:#1e293b;border-radius:16px;padding:48px;text-align:center;border:1px solid #334155;max-width:420px}
        h1{color:#f8fafc;font-size:28px;margin:16px 0 8px}
        p{color:#94a3b8;font-size:15px;margin-bottom:24px}
        .badge{background:#10b981;color:white;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600}
        a{display:block;margin-top:20px;color:#60a5fa;font-size:13px}
    </style>
</head>
<body>
    <div class="card">
        <div style="font-size:64px">🏥</div>
        <h1>CliniCore Enterprise</h1>
        <p>Backend API is running. Frontend deployment pending.</p>
        <span class="badge">✓ API Online</span>
        <a href="/api/health">View API Health →</a>
    </div>
</body>
</html>
HTML_EOF
echo "  Frontend placeholder created."
fi

cat > /etc/nginx/sites-available/clinicore <<NGINX_EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name api.clinicore.me clinicore.me www.clinicore.me _;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Route ALL /api/* requests to PHP gateway
    location ~ ^/api(/.*)?$ {
        fastcgi_pass unix:$PHP_SOCKET;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $BACKEND_DIR/public/index.php;
        fastcgi_param DOCUMENT_ROOT   $BACKEND_DIR/public;
        fastcgi_param REQUEST_URI     \$request_uri;
        fastcgi_read_timeout 120;
    }

    # Frontend SPA
    location / {
        root $FRONTEND_DIR/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Block access to sensitive backend files
    location ~ /\.(env|git) { deny all; return 403; }
    location ~* ^/backend/src { deny all; return 403; }

    access_log /var/log/nginx/clinicore_access.log;
    error_log  /var/log/nginx/clinicore_error.log warn;
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/clinicore /etc/nginx/sites-enabled/clinicore
[ -f /etc/nginx/sites-enabled/default ] && rm /etc/nginx/sites-enabled/default && echo "  Removed default site."

nginx -t && echo "  Nginx config: VALID" || { echo "  ERROR: Nginx config invalid!"; nginx -t; }

# Automatically provision or re-deploy Certbot SSL for api.clinicore.me
if command -v certbot &> /dev/null; then
    certbot --nginx -d api.clinicore.me --non-interactive --agree-tos -m admin@clinicore.me --redirect 2>/dev/null || true
fi

# ─────────────────────────────────────────────────────────
# STEP 8: Permissions and service restart
# ─────────────────────────────────────────────────────────
echo ""
echo "[8/8] Fixing permissions and restarting services..."

mkdir -p "$BACKEND_DIR/storage/files"
mkdir -p "$BACKEND_DIR/storage/logs"

chown -R www-data:www-data "$CLINICORE_DIR"
chmod -R 755 "$CLINICORE_DIR"
chmod -R 775 "$BACKEND_DIR/storage"
chmod 640 "$BACKEND_DIR/.env"

systemctl restart php8.3-fpm 2>/dev/null || systemctl restart php-fpm 2>/dev/null || echo "  (php-fpm restart skipped)"
systemctl reload nginx || systemctl restart nginx
echo "  Services restarted."

# ─────────────────────────────────────────────────────────
# VERIFICATION
# ─────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  VERIFICATION"
echo "======================================================"

sleep 2

echo ""
echo "Testing /api/health..."
HTTP_CODE=$(curl -s -o /tmp/health_response.json -w "%{http_code}" http://localhost/api/health)
echo "  HTTP: $HTTP_CODE"
cat /tmp/health_response.json
echo ""

echo "Testing / (frontend)..."
HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
echo "  HTTP: $HTTP_FRONT"

echo ""
echo "Database tables:"
mysql -u root -e "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA='$DB_NAME' ORDER BY TABLE_NAME;" 2>/dev/null

echo ""
echo "Seeded users:"
mysql -u root -e "SELECT id, name, role, email FROM $DB_NAME.users LIMIT 5;" 2>/dev/null || echo "  (none yet)"

echo ""
echo "======================================================"
if [ "$HTTP_CODE" = "200" ]; then
    echo "  SUCCESS: CliniCore API is LIVE!"
else
    echo "  WARNING: API returned $HTTP_CODE — check logs:"
    echo "  tail -20 /var/log/nginx/clinicore_error.log"
fi
echo "  URL: http://77.37.45.233/"
echo "  API: http://77.37.45.233/api/health"
echo "======================================================"
