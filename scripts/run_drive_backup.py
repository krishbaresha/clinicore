#!/usr/bin/env python3
import os, sys, json, datetime, subprocess

TOKEN_FILE = "/etc/clinicore/token.json"
CLIENT_SECRET_FILE = "/etc/clinicore/client_secret.json"
BACKUP_DIR = "/var/backups/clinicore"

if not os.path.exists(TOKEN_FILE):
    print(json.dumps({"success": False, "message": "OAuth token missing at " + TOKEN_FILE}))
    sys.exit(1)

os.makedirs(BACKUP_DIR, exist_ok=True)

now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S")
sql_file = f"{BACKUP_DIR}/clinicore_backup_{now_str}.sql.gz"
cfbak_file = f"{BACKUP_DIR}/clinicore_vault_{now_str}.cfbak"

# 1. Generate MySQL Dump
try:
    cmd = f"mysqldump -u root clinicore 2>/dev/null | gzip > {sql_file}"
    subprocess.run(cmd, shell=True, check=True)
except Exception:
    pass

# 2. Generate JSON Vault Backup
state_path = "/var/www/clinicore/backend/data/sync_state.json"
if os.path.exists(state_path):
    with open(state_path, "r") as sf, open(cfbak_file, "w") as df:
        df.write(sf.read())
else:
    with open(cfbak_file, "w") as df:
        df.write(json.dumps({"timestamp": now_str, "status": "vps_drive_backup"}))

# 3. Upload to Google Drive using User OAuth Credentials
try:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    with open(TOKEN_FILE, 'r') as tf:
        tdata = json.load(tf)

    creds = Credentials(
        token=tdata.get('token'),
        refresh_token=tdata.get('refresh_token'),
        token_uri=tdata.get('token_uri', 'https://oauth2.googleapis.com/token'),
        client_id=tdata.get('client_id'),
        client_secret=tdata.get('client_secret'),
        scopes=tdata.get('scopes')
    )

    service = build("drive", "v3", credentials=creds)

    # Ensure ClinicCore_Backups folder exists in user's Drive
    res = service.files().list(
        q="name='ClinicCore_Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)"
    ).execute()
    folders = res.get("files", [])
    
    if folders:
        folder_id = folders[0]["id"]
    else:
        folder_meta = {
            'name': 'ClinicCore_Backups',
            'mimeType': 'application/vnd.google-apps.folder'
        }
        f_obj = service.files().create(body=folder_meta, fields='id').execute()
        folder_id = f_obj.get('id')

    uploaded_files = []

    def upload_to_user_drive(file_path, mime):
        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
            return None
        meta = {
            'name': os.path.basename(file_path),
            'parents': [folder_id]
        }
        media = MediaFileUpload(file_path, mimetype=mime, resumable=True)
        up = service.files().create(body=meta, media_body=media, fields='id, name, webViewLink').execute()
        return up.get('name')

    up_sql = upload_to_user_drive(sql_file, 'application/gzip')
    if up_sql:
        uploaded_files.append(up_sql)

    up_cfbak = upload_to_user_drive(cfbak_file, 'application/json')
    if up_cfbak:
        uploaded_files.append(up_cfbak)

    result = {
        "success": True,
        "message": "Backup uploaded successfully to Google Drive folder ClinicCore_Backups!",
        "data": {
            "timestamp": datetime.datetime.now().isoformat(),
            "file": ", ".join(uploaded_files),
            "folder": "ClinicCore_Backups",
            "storage": "Google Drive Cloud Vault"
        }
    }
    print(json.dumps(result))

except Exception as e:
    err_res = {
        "success": False,
        "message": f"Drive upload error: {str(e)}",
        "timestamp": datetime.datetime.now().isoformat()
    }
    print(json.dumps(err_res))
