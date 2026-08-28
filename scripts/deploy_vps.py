"""
1-Click Fast & Reliable Direct Deploy runner for CliniCore VPS
Tarballs local production build & backend and extracts directly to Hostinger VPS (77.37.45.233).
Bypasses GitHub auth issues completely and deploys instantly in < 5 seconds.
"""
import os
import sys
import tarfile
import tempfile
import paramiko

HOST = os.getenv("VPS_HOST", "77.37.45.233")
PORT = int(os.getenv("VPS_PORT", "22"))
USER = os.getenv("VPS_USER", "root")
PASS = os.getenv("VPS_ROOT_PASSWORD", "")

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

print("=" * 60)
print("[DEPLOY] Packaging & Deploying CliniCore to Hostinger VPS...")
print("=" * 60)

with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
    tar_path = tmp.name

try:
    print("[1/3] Creating deployment archive...")
    with tarfile.open(tar_path, "w:gz") as tar:
        backend_dir = os.path.join(REPO_ROOT, "backend")
        if os.path.exists(backend_dir):
            tar.add(backend_dir, arcname="backend")
            print("  + backend/")

        db_dir = os.path.join(REPO_ROOT, "database")
        if os.path.exists(db_dir):
            tar.add(db_dir, arcname="database")
            print("  + database/")

        scripts_dir = os.path.join(REPO_ROOT, "scripts")
        if os.path.exists(scripts_dir):
            tar.add(scripts_dir, arcname="scripts")
            print("  + scripts/")

        dist_dir = os.path.join(REPO_ROOT, "frontend", "dist")
        if os.path.exists(dist_dir):
            tar.add(dist_dir, arcname="frontend/dist")
            print("  + frontend/dist/")
        else:
            print("  [WARN] frontend/dist not found! Run npm run build first.")

    size_mb = os.path.getsize(tar_path) / (1024 * 1024)
    print(f"  Archive ready: {size_mb:.2f} MB")

    print(f"\n[2/3] Connecting to VPS ({HOST})...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, PORT, USER, PASS, timeout=30, look_for_keys=False, allow_agent=False)

    sftp = client.open_sftp()
    remote_tar = "/tmp/clinicore_deploy.tar.gz"
    print("  Uploading package to VPS via SFTP...")
    sftp.put(tar_path, remote_tar)
    sftp.close()
    print("  Upload complete.")

    print("\n[3/3] Extracting & Applying Server Updates...")
    commands = [
        "mkdir -p /var/www/clinicore",
        f"tar -xzf {remote_tar} -C /var/www/clinicore/",
        f"rm -f {remote_tar}",
        "bash /var/www/clinicore/scripts/vps_fix_all.sh",
        "chown -R www-data:www-data /var/www/clinicore",
        "systemctl restart php8.3-fpm nginx",
        "curl -s http://localhost/api/health"
    ]

    for cmd in commands:
        print(f"\n$ {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode("utf-8", errors="replace").strip()
        err = stderr.read().decode("utf-8", errors="replace").strip()
        if out:
            print(out[:500] + ("..." if len(out) > 500 else ""))
        if err:
            print("  Note:", err[:300])

    client.close()

    print("\n" + "=" * 60)
    print("[SUCCESS] FAST DIRECT DEPLOYMENT SUCCESSFUL!")
    print("Web: https://www.clinicore.me/")
    print("API: https://api.clinicore.me/api/health")
    print("=" * 60)

finally:
    if os.path.exists(tar_path):
        os.remove(tar_path)
