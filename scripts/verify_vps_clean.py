import os
import paramiko

def verify_vps():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    host = "77.37.45.233"
    user = "root"
    passwd = os.getenv("VPS_ROOT_PASSWORD", "Keru@11998844")

    client.connect(host, 22, user, passwd, timeout=20)

    # 1. Clean TRUNCATE loop
    stdin, stdout, stderr = client.exec_command("mysql clinicore -e 'SHOW TABLES;'")
    tables_raw = stdout.read().decode().strip().split('\n')[1:]
    tables = [t.strip() for t in tables_raw if t.strip()]

    for t in tables:
        cmd = f"mysql clinicore -e 'SET FOREIGN_KEY_CHECKS=0; TRUNCATE TABLE `{t}`; SET FOREIGN_KEY_CHECKS=1;'"
        client.exec_command(cmd)

    # 2. Verify all table rows
    print("STATUS SUMMARY:")
    for t in tables:
        stdin, stdout, stderr = client.exec_command(f"mysql clinicore -e 'SELECT COUNT(*) FROM `{t}`;'")
        cnt = stdout.read().decode().strip().split('\n')[-1].strip()
        print(f"{t}: {cnt} rows")

    client.close()

if __name__ == "__main__":
    verify_vps()
