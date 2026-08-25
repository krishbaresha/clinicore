import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('77.37.45.233', 22, 'root', 'Keru@11998844', timeout=15)

# MySQL reset commands: truncate all mock data tables and clean app_cloud_state
sql_commands = """
USE clinicore;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE app_cloud_state;
TRUNCATE TABLE visit_attachments;
TRUNCATE TABLE visits;
TRUNCATE TABLE patients;
TRUNCATE TABLE patient_ledger;

TRUNCATE TABLE pos_sale_items;
TRUNCATE TABLE pos_sales;
TRUNCATE TABLE b2b_sale_items;
TRUNCATE TABLE b2b_sales;
TRUNCATE TABLE purchase_items;
TRUNCATE TABLE purchases;
TRUNCATE TABLE supplier_ledger;
TRUNCATE TABLE stock_transfer_items;
TRUNCATE TABLE stock_transfers;
TRUNCATE TABLE stock_movements;
TRUNCATE TABLE warehouse_stocks;
TRUNCATE TABLE inventory;

TRUNCATE TABLE expenses;
TRUNCATE TABLE cashbook;
TRUNCATE TABLE shift_closings;
TRUNCATE TABLE audit_logs;

TRUNCATE TABLE parties;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE salesmen;
TRUNCATE TABLE users;
TRUNCATE TABLE warehouses;
TRUNCATE TABLE clinics;

SET FOREIGN_KEY_CHECKS = 1;
"""

cmd = f'mysql -u clinicore_user -pCF_Secure2024! -e "{sql_commands}"'
print("Executing Ground-Zero Database Clean on VPS MySQL...")
stdin, stdout, stderr = client.exec_command(cmd)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
if out:
    print(out)
if err:
    print("Note:", err)

# Check table counts
check_cmd = """
mysql -u clinicore_user -pCF_Secure2024! -e "
USE clinicore;
SELECT 'app_cloud_state' AS tbl, COUNT(*) AS cnt FROM app_cloud_state
UNION ALL SELECT 'patients', COUNT(*) FROM patients
UNION ALL SELECT 'visits', COUNT(*) FROM visits
UNION ALL SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL SELECT 'users', COUNT(*) FROM users;
"
"""
stdin, stdout, stderr = client.exec_command(check_cmd)
print("\nTable Status After Ground Zero Clean:")
print(stdout.read().decode('utf-8', errors='replace'))

client.close()
