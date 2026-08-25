import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.37.45.233", 22, "root", "Keru@11998844", timeout=15)

commands = [
    # 1. Create log file with permissions
    "touch /var/log/clinicore_automation.log && chmod 666 /var/log/clinicore_automation.log",

    # 2. Write systemd unit file
    """cat > /etc/systemd/system/clinicore-automation.service <<'EOF'
[Unit]
Description=CliniCore 24/7 Autonomous Background Automation Daemon
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/clinicore/backend
ExecStart=/usr/bin/python3 /var/www/clinicore/backend/automation_daemon.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/clinicore_automation.log
StandardError=append:/var/log/clinicore_automation.log

[Install]
WantedBy=multi-user.target
EOF
""",

    # 3. Reload systemd, enable, and start service
    "systemctl daemon-reload",
    "systemctl enable clinicore-automation.service",
    "systemctl restart clinicore-automation.service",

    # 4. Install 1-minute crontab runner for root as redundancy
    """(crontab -l 2>/dev/null | grep -v "cron_daily_backup.php"; echo "* * * * * php /var/www/clinicore/backend/cron_daily_backup.php >> /var/log/clinicore_automation.log 2>&1") | crontab -""",

    # 5. Check status
    "systemctl status clinicore-automation.service --no-pager",
    "crontab -l",
    "ps aux | grep automation_daemon.py",
]

for cmd in commands:
    print("=" * 60)
    print(f"$ {cmd[:50]}...")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out:
        print(out.encode('ascii', errors='replace').decode())
    if err:
        print("[STDERR]", err.encode('ascii', errors='replace').decode())

client.close()
