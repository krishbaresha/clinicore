import os
import paramiko




client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("[IP_ADDRESS]", 22, "root", "Keru@11998844", timeout=15)

conf = """server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name clinicore.me www.clinicore.me api.clinicore.me _;

    location /.well-known/acme-challenge/ {
        root /var/www/clinicore/frontend/dist;
    }

    # Route ALL /api/* requests to PHP gateway
    location ~ ^/api(/.*)?$ {
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/clinicore/backend/public/index.php;
        fastcgi_param DOCUMENT_ROOT   /var/www/clinicore/backend/public;
        fastcgi_param REQUEST_URI     $request_uri;
        fastcgi_read_timeout 120;
    }

    # Frontend SPA Root
    location / {
        root /var/www/clinicore/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # PWA Service Worker & Entrypoint: NEVER CACHE
    location ~* ^/(sw\\.js|manifest\\.json|version\\.json|index\\.html)$ {
        root /var/www/clinicore/frontend/dist;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;
        expires 0;
    }

    # Content-Hashed Vite Assets
    location /assets/ {
        root /var/www/clinicore/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    # Static Media & Web Fonts
    location ~* \\.(png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
        root /var/www/clinicore/frontend/dist;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # Block access to sensitive backend files
    location ~ /\\.(env|git) { deny all; return 403; }
    location ~* ^/backend/src { deny all; return 403; }

    access_log /var/log/nginx/clinicore_access.log;
    error_log  /var/log/nginx/clinicore_error.log warn;
}
"""

sftp = client.open_sftp()
with sftp.file('/etc/nginx/sites-available/clinicore', 'w') as f:
    f.write(conf)
sftp.close()

_, stdout, stderr = client.exec_command('nginx -t && systemctl reload nginx')
print('Nginx reload:', stdout.read().decode(), stderr.read().decode())

_, stdout, stderr = client.exec_command('curl -I -H "Host: clinicore.me" http://127.0.0.1/')
print('Curl test on 127.0.0.1:\n', stdout.read().decode())

client.close()
