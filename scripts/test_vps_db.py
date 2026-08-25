import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('77.37.45.233', 22, 'root', 'Keru@11998844', timeout=15)

commands = [
    'cat /var/www/clinicore/backend/.env',
    'mysql -u root -e "SHOW DATABASES; SELECT user, host FROM mysql.user;"',
    'mysql -u clinicore_user -pCF_Secure2024! -e "SHOW TABLES FROM clinicore;"'
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
