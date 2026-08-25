import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('77.37.45.233', 22, 'root', 'Keru@11998844', timeout=15)

env_content = """APP_NAME=CliniCore
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.clinicore.me

DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=clinicore
DB_USERNAME=clinicore_user
DB_PASSWORD=CF_Secure2024!

JWT_SECRET=super_secret_production_jwt_key_2026_clinicore_pk
JWT_EXPIRY=86400

STORAGE_PATH=/var/www/clinicore/backend/storage/files
RESEND=re_gbvdQToJ_8dV5uc9bv7TXD1Dr9kZbi2zi
"""

commands = [
    f"cat << 'EOF' > /var/www/clinicore/backend/.env\n{env_content}EOF",
    "chown www-data:www-data /var/www/clinicore/backend/.env",
    "chmod 640 /var/www/clinicore/backend/.env",
    "systemctl restart php8.3-fpm nginx"
]

for cmd in commands:
    print(f"=== CMD: {cmd[:60]}...")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out)
    if err:
        print("ERR:", err)

client.close()
print("Done updating VPS .env and restarting PHP-FPM.")
