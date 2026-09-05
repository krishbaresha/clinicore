#!/usr/bin/env python3
"""
CliniCore Enterprise Automation Daemon (Python 3)
Continuously monitors schedules in real-time and coordinates automated backups.
Runs 24/7 as a background Linux system service on Hostinger VPS (77.37.45.233).
"""

import sys
import time
import os
import subprocess
import logging
import json
from urllib import request, error
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

API_BASE = "http://127.0.0.1:5000"
DRIVE_BACKUP_SCRIPT = "/var/www/clinicore/scripts/run_drive_backup.py"

def check_backend_health():
    try:
        req = request.Request(f"{API_BASE}/health", method="GET")
        with request.urlopen(req, timeout=5) as res:
            if res.status == 200:
                return True
    except Exception as e:
        logging.warning(f"Node.js API healthcheck warning: {e}")
    return False

def trigger_vps_backup(force=False):
    try:
        payload = json.dumps({"force": force, "source": "automation_daemon"}).encode("utf-8")
        req = request.Request(
            f"{API_BASE}/api/v1/system/trigger-vps-backup",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with request.urlopen(req, timeout=30) as res:
            body = res.read().decode("utf-8")
            logging.info(f"Triggered VPS backup response: {body}")
            return True
    except Exception as e:
        logging.error(f"Error triggering VPS backup: {e}")
        return False

def trigger_drive_backup():
    if os.path.exists(DRIVE_BACKUP_SCRIPT):
        try:
            res = subprocess.run(
                ["python3", DRIVE_BACKUP_SCRIPT],
                capture_output=True,
                text=True,
                timeout=60
            )
            logging.info(f"Drive backup output: {res.stdout.strip()}")
            if res.stderr:
                logging.warning(f"Drive backup stderr: {res.stderr.strip()}")
        except Exception as e:
            logging.error(f"Error running Drive backup: {e}")

last_backup_hour = None

def run_backup_check(force=False):
    global last_backup_hour
    is_healthy = check_backend_health()
    if not is_healthy:
        logging.warning("Node.js API is currently unresponsive, retrying next tick...")
        return

    now = datetime.now()
    # If forced via command-line argument
    if force:
        logging.info("Forced backup execution triggered...")
        trigger_vps_backup(force=True)
        trigger_drive_backup()
        return

    # Daily 9:00 PM (21:00) and 2:00 AM autonomous trigger
    if now.hour in (2, 21) and now.minute < 2 and last_backup_hour != now.hour:
        last_backup_hour = now.hour
        logging.info(f"Scheduled backup trigger for hour {now.hour}:00...")
        trigger_vps_backup(force=True)
        trigger_drive_backup()

def main():
    logging.info("Starting CliniCore Python 3 24/7 Automation Daemon (Node.js API Bridge)...")
    logging.info(f"Target API: {API_BASE}")
    
    # If invoked with --once or --force
    if "--once" in sys.argv or "--force" in sys.argv:
        run_backup_check(force=True)
        return

    # Continuous 24/7 polling loop (every 30 seconds)
    while True:
        try:
            run_backup_check()
        except KeyboardInterrupt:
            logging.info("Daemon stopped by user.")
            break
        except Exception as e:
            logging.error(f"Loop error: {str(e)}")
        time.sleep(30)

if __name__ == "__main__":
    main()
