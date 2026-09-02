import os
import paramiko

def run_vps_reset():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    host = "77.37.45.233"
    user = "root"
    passwd = os.getenv("VPS_ROOT_PASSWORD", "Keru@11998844")

    print(f"Connecting to VPS at {host}...")
    client.connect(host, 22, user, passwd, timeout=20)

    # 1. Check existing tables
    stdin, stdout, stderr = client.exec_command("mysql clinicore -e 'SHOW TABLES;'")
    tables_raw = stdout.read().decode().strip().split('\n')[1:]
    tables = [t.strip() for t in tables_raw if t.strip()]
    print(f"Found {len(tables)} tables in database 'clinicore': {tables}")

    # 2. Build TRUNCATE commands
    truncate_sqls = ["SET FOREIGN_KEY_CHECKS = 0;"]
    for t in tables:
        truncate_sqls.append(f"TRUNCATE TABLE `{t}`;")
    truncate_sqls.append("SET FOREIGN_KEY_CHECKS = 1;")
    full_sql = " ".join(truncate_sqls)

    print("Executing full TRUNCATE on all tables...")
    stdin, stdout, stderr = client.exec_command(f"mysql clinicore -e \"{full_sql}\"")
    err = stderr.read().decode().strip()
    if err:
        print("Note/Stderr:", err)
    else:
        print("Truncate executed successfully.")

    # 3. Verify counts
    print("\nVerifying row counts across tables:")
    for t in tables:
        stdin, stdout, stderr = client.exec_command(f"mysql clinicore -e 'SELECT COUNT(*) FROM `{t}`;'")
        cnt = stdout.read().decode().strip().split('\n')[-1].strip()
        print(f" - {t}: {cnt} rows")

    # 4. Also clean outbox / state files in /var/www or temp if any exist
    clean_fs_cmd = "rm -rf /tmp/clinicore_backup* /var/www/html/backups/* 2>/dev/null || true"
    client.exec_command(clean_fs_cmd)

    client.close()
    print("\n✅ VPS Database & State Reset Complete! (Ground Zero Clean Ready for Production Setup)")

if __name__ == "__main__":
    run_vps_reset()
