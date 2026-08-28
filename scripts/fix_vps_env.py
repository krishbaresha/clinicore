import paramiko
# pyrefly: ignore [missing-import]
import dotenv
import os

dotenv.load_dotenv()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(os.getenv("VPS_IP"), 22, os.getenv("VPS_USERNAME"), os.getenv("VPS_PASSWORD"), timeout=15)

db_pass = os.getenv("DB_PASSWORD")
if not db_pass:
    raise RuntimeError("CRITICAL: DB_PASSWORD environment variable must be set.")

jwt_secret = os.getenv("JWT_SECRET")
if not jwt_secret:
    import secrets
    jwt_secret = secrets.token_hex(32)
resend_key = os.getenv("RESEND_API_KEY", "")

env_content = f"""APP_NAME=CliniCore
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.clinicore.me

DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=clinicore
DB_USERNAME=clinicore_user
DB_PASSWORD={db_pass}

JWT_SECRET={jwt_secret}
JWT_EXPIRY=86400

STORAGE_PATH=/var/www/clinicore/backend/storage/files
RESEND={resend_key}
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
