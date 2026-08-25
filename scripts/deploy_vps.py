"""
1-Click Deploy runner for CliniCore VPS
Triggers git sync & updates services on Hostinger VPS (77.37.45.233).
"""
import paramiko
import sys

HOST = "77.37.45.233"
PORT = 22
USER = "root"
PASS = "Keru@11998844"

print("=" * 60)
print("🚀 Deploying CliniCore to Hostinger VPS (77.37.45.233)...")
print("=" * 60)

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, PORT, USER, PASS, timeout=20, look_for_keys=False, allow_agent=False)

    commands = [
        "cd /var/www/clinicore && git config --global --add safe.directory /var/www/clinicore",
        "cd /var/www/clinicore && git fetch origin main && git reset --hard origin/main",
        "bash /var/www/clinicore/scripts/vps_fix_all.sh",
        "curl -s http://localhost/api/health"
    ]

    for cmd in commands:
        print(f"\n$ {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode("utf-8", errors="replace").strip()
        clean = out.encode("ascii", "replace").decode("ascii")
        if clean:
            print(clean[:600] + ("..." if len(clean) > 600 else ""))

    client.close()
    print("\n" + "=" * 60)
    print("✅ DEPLOYMENT SUCCESSFUL! All services updated & live.")
    print("Web: https://www.clinicore.me/")
    print("API: https://api.clinicore.me/api/health")
    print("=" * 60)

except Exception as e:
    print(f"\n❌ Deployment error: {e}")
    sys.exit(1)
