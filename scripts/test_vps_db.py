import os
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
host = os.getenv("VPS_HOST", "77.37.45.233")
user = os.getenv("VPS_USER", "root")
passwd = os.getenv("VPS_ROOT_PASSWORD", "")
db_user = os.getenv("DB_USERNAME", "clinicore_user")
db_pass = os.getenv("DB_PASSWORD", "")
client.connect(host, 22, user, passwd, timeout=15)

commands = [
    'cat /var/www/clinicore/backend/.env',
    'mysql -u root -e "SHOW DATABASES; SELECT user, host FROM mysql.user;"',
    f'mysql -u {db_user} -p"{db_pass}" -e "SHOW TABLES FROM clinicore;"'
]

for cmd in commands:
    print(f"=== CMD: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out)
    if err:
        print("ERR:", err)

client.close()
