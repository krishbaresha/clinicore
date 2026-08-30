import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.37.45.233", 22, "root", "Keru@11998844", timeout=15)

commands = [
    # Test via HTTPS (the real path users will hit)
    "curl -sk https://localhost/api/health",
    "curl -sk https://localhost/api/v1/system/config",
    "curl -sk https://localhost/api/v1/system/sync-state",
    "curl -sk https://localhost/api/v1/time",
    # Also verify Node is still running
    "systemctl is-active clinicore-api.service",
]

for cmd in commands:
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    safe_out = out.encode('ascii', errors='replace').decode('ascii')
    if safe_out.strip():
        print(f"  {safe_out.strip()}")

client.close()
print("\n=== DONE ===")
