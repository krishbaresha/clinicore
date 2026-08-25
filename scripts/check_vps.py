import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.37.45.233", 22, "root", "Keru@11998844", timeout=15)

commands = [
    "systemctl status clinicore-automation --no-pager",
    "crontab -u www-data -l",
    "crontab -l",
    "tail -n 30 /var/log/clinicore_automation.log",
    "mysql -u root clinicore -e 'SELECT * FROM system_settings;'",
]

for cmd in commands:
    print("=" * 60)
    print(f"$ {cmd}")
    print("=" * 60)
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    if err:
        print("[STDERR]", err)

client.close()
