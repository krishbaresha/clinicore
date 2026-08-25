#!/usr/bin/env bash
# ==============================================================================
# 🏥 CliniCore — Production VPS Auto-Provisioning & Deployment Engine
# Target OS: Ubuntu 24.04 LTS (Hostinger KVM 1 VPS)
# Stack: Nginx + PHP 8.3-FPM + MySQL 8.0 + Node.js 20 LTS + Certbot SSL
# ==============================================================================

set -euo pipefail

# Visual Output Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

LOG_FILE="/var/log/clinicore_setup.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

echo -e "${CYAN}===================================================================${NC}"
echo -e "${GREEN}    🏥 CLINICORE — PRODUCTION SERVER SETUP & PROVISIONING         ${NC}"
echo -e "${CYAN}===================================================================${NC}"
echo -e "${YELLOW}Started at: $(date)${NC}"

# Check for root privilege
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please execute this script as root (sudo bash deploy_vps_setup.sh)${NC}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 1. SYSTEM UPDATES & BASE PACKAGES
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[1/8] Updating System & Installing Core Packages...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git unzip zip htop ufw fail2ban software-properties-common ca-certificates apt-transport-https lsb-release

# ------------------------------------------------------------------------------
# 2. UFW FIREWALL & SECURITY LOCKDOWN
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/8] Configuring UFW Firewall & Fail2ban Security...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH Port'
ufw allow 80/tcp comment 'HTTP Web Port'
ufw allow 443/tcp comment 'HTTPS SSL Port'
ufw --force enable
systemctl enable fail2ban
systemctl restart fail2ban
echo -e "${GREEN}✓ UFW Firewall enabled: Ports 22, 80, 443 are OPEN. MySQL 3306 is internal.${NC}"

# ------------------------------------------------------------------------------
# 3. PHP 8.3 & REQUIRED EXTENSIONS INSTALLATION
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/8] Installing PHP 8.3-FPM & Enterprise Extensions...${NC}"
add-apt-repository -y ppa:ondrej/php
apt-get update -y
apt-get install -y php8.3 php8.3-fpm php8.3-cli php8.3-mysql php8.3-pdo php8.3-mbstring \
                   php8.3-xml php8.3-curl php8.3-gd php8.3-zip php8.3-bcmath php8.3-intl \
                   php8.3-opcache

# Install Composer
if ! command -v composer &> /dev/null; then
    echo -e "${YELLOW}Installing Composer globally...${NC}"
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

# Tune PHP 8.3-FPM Settings
PHP_INI="/etc/php/8.3/fpm/php.ini"
sed -i 's/upload_max_filesize = .*/upload_max_filesize = 32M/' "$PHP_INI"
sed -i 's/post_max_size = .*/post_max_size = 32M/' "$PHP_INI"
sed -i 's/memory_limit = .*/memory_limit = 256M/' "$PHP_INI"
sed -i 's/max_execution_time = .*/max_execution_time = 120/' "$PHP_INI"
sed -i 's/;opcache.enable=.*/opcache.enable=1/' "$PHP_INI"

systemctl restart php8.3-fpm
systemctl enable php8.3-fpm
echo -e "${GREEN}✓ PHP 8.3-FPM successfully installed & optimized.${NC}"

# ------------------------------------------------------------------------------
# 4. MYSQL 8.0 SERVER INSTALLATION & DATABASE INITIALIZATION
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[4/8] Installing & Initializing MySQL 8.0 Database...${NC}"
apt-get install -y mysql-server

systemctl start mysql
systemctl enable mysql

# Generate a cryptographically secure DB password
DB_NAME="clinicore"
DB_USER="clinicore_admin"
DB_PASS="CF_Prod_$(openssl rand -hex 8)!"

echo -e "${YELLOW}Configuring MySQL Database '${DB_NAME}' & Dedicated User '${DB_USER}'...${NC}"

mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo -e "${GREEN}✓ MySQL configured: Database '${DB_NAME}' created.${NC}"

# ------------------------------------------------------------------------------
# 5. NODE.JS 20 LTS INSTALLATION (FOR FRONTEND BUILDS)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[5/8] Installing Node.js 20 LTS & NPM...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node.js version: $(node -v) | NPM version: $(npm -v)${NC}"

# ------------------------------------------------------------------------------
# 6. DIRECTORY STRUCTURE & SECURE PERMISSIONS
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[6/8] Creating Production Directory Structure & Permissions...${NC}"
APP_ROOT="/var/www/clinicore"
mkdir -p "${APP_ROOT}/frontend/dist"
mkdir -p "${APP_ROOT}/backend/public"
mkdir -p "${APP_ROOT}/storage/uploads/prescriptions"
mkdir -p "${APP_ROOT}/storage/uploads/reports"
mkdir -p "${APP_ROOT}/storage/backups"

# Create production .env for backend
cat <<EOF > "${APP_ROOT}/backend/.env"
# CliniCore Production Environment Config
APP_ENV=production
APP_DEBUG=false
APP_URL=https://srv1926851.hstgr.cloud

# Database Connection
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=${DB_NAME}
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASS}

# Security & Session Secrets
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRATION=604800
CORS_ALLOWED_ORIGINS=*

# Private Storage Vault
STORAGE_PATH=${APP_ROOT}/storage/uploads
EOF

chmod 600 "${APP_ROOT}/backend/.env"
chown -R www-data:www-data "${APP_ROOT}"
chmod -R 755 "${APP_ROOT}"
# Create bootstrap index.php if not present
cat <<'EOF' > "${APP_ROOT}/backend/public/index.php"
<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($uri === '/api/health' || $uri === '/api/v1/health' || $uri === '/api') {
    echo json_encode([
        'success' => true,
        'data' => [
            'status'    => 'healthy',
            'app'       => 'CliniCore Enterprise Engine',
            'version'   => '2.0.0',
            'runtime'   => 'PHP ' . PHP_VERSION,
            'timestamp' => date('c')
        ],
        'error' => null
    ]);
    exit;
}

// Load full API if files exist
$gatewayFile = __DIR__ . '/../src/Config/Database.php';
if (file_exists($gatewayFile)) {
    // Registered routes
    spl_autoload_register(function ($class) {
        $prefix = 'CliniCore\\';
        $baseDir = __DIR__ . '/../src/';
        $len = strlen($prefix);
        if (strncmp($prefix, $class, $len) !== 0) return;
        $relativeClass = substr($class, $len);
        $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
        if (file_exists($file)) require_once $file;
    });
    
    echo json_encode([
        'success' => true,
        'data' => ['message' => 'CliniCore API Ready', 'endpoint' => $uri],
        'error' => null
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'data' => [
        'status'  => 'healthy',
        'message' => 'CliniCore Server Online. Please sync backend source files.'
    ],
    'error' => null
]);
EOF

chown -R www-data:www-data "${APP_ROOT}"
chmod -R 755 "${APP_ROOT}"
chmod -R 775 "${APP_ROOT}/storage"

# ------------------------------------------------------------------------------
# 7. NGINX REVERSE PROXY & VIRTUAL HOST CONFIGURATION
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[7/8] Installing & Configuring Nginx Web Server...${NC}"
apt-get install -y nginx certbot python3-certbot-nginx

NGINX_CONF="/etc/nginx/sites-available/clinicore"
cat <<'EOF' > "$NGINX_CONF"
server {
    listen 80;
    listen [::]:80;
    server_name srv1926851.hstgr.cloud _;

    root /var/www/clinicore/frontend/dist;
    index index.html index.htm;

    # Gzip Compression for Ultra-Fast Loads
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/json application/javascript image/svg+xml;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Client body limit for prescription / lab image uploads
    client_max_body_size 35M;

    # Static Assets Caching
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Backend PHP API Routing via FastCGI
    location /api {
        try_files $uri $uri/ @backend;
    }

    location @backend {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/clinicore/backend/public/index.php;
        fastcgi_param REQUEST_URI $request_uri;
        include fastcgi_params;
        fastcgi_read_timeout 120;
    }

    # React Frontend SPA Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Deny access to hidden files (.env, .git)
    location ~ /\. {
        deny all;
    }
}
EOF

ln -sf /etc/nginx/sites-available/clinicore /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx
echo -e "${GREEN}✓ Nginx configured and restarted successfully.${NC}"

# ------------------------------------------------------------------------------
# 8. AUTOMATED DAILY BACKUP CRON ENGINE
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[8/8] Installing Automated Daily MySQL & Snapshot Backup Job...${NC}"
BACKUP_SCRIPT="/usr/local/bin/clinicore-backup.sh"

cat <<EOF > "$BACKUP_SCRIPT"
#!/usr/bin/env bash
BACKUP_DIR="/var/www/clinicore/storage/backups"
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
DB_FILE="\${BACKUP_DIR}/db_backup_\${TIMESTAMP}.sql.gz"

mkdir -p "\${BACKUP_DIR}"
mysqldump -u ${DB_USER} -p'${DB_PASS}' ${DB_NAME} | gzip > "\${DB_FILE}"

# Retention Policy: Delete backups older than 14 days
find "\${BACKUP_DIR}" -type f -name "db_backup_*.sql.gz" -mtime +14 -delete
EOF

chmod +x "$BACKUP_SCRIPT"

# Register daily 03:00 AM PKT (22:00 UTC) cron job
(crontab -l 2>/dev/null | grep -v "clinicore-backup.sh" ; echo "0 22 * * * /usr/local/bin/clinicore-backup.sh >/dev/null 2>&1") | crontab -
echo -e "${GREEN}✓ Daily automated database backup cron registered.${NC}"

# ------------------------------------------------------------------------------
# SUMMARY & CREDENTIALS VAULT
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}===================================================================${NC}"
echo -e "${GREEN}       🎉 CLINICORE SERVER PROVISIONING COMPLETE!                 ${NC}"
echo -e "${CYAN}===================================================================${NC}"
echo -e "${PURPLE}Generated Production Credentials Vault:${NC}"
echo -e "  MySQL Database:   ${YELLOW}${DB_NAME}${NC}"
echo -e "  MySQL Username:   ${YELLOW}${DB_USER}${NC}"
echo -e "  MySQL Password:   ${YELLOW}${DB_PASS}${NC}"
echo -e "  Backend Path:     ${YELLOW}${APP_ROOT}/backend${NC}"
echo -e "  Frontend Path:    ${YELLOW}${APP_ROOT}/frontend/dist${NC}"
echo -e "  Storage Vault:    ${YELLOW}${APP_ROOT}/storage/uploads${NC}"
echo -e "  Nginx Config:     ${YELLOW}${NGINX_CONF}${NC}"
echo -e "  Credentials File: ${YELLOW}${APP_ROOT}/backend/.env${NC}"
echo -e "${CYAN}===================================================================${NC}"
echo -e "${GREEN}You are ready to deploy backend API and frontend build!${NC}\n"
