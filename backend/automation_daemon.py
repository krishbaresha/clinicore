#!/usr/bin/env python3
"""
CliniCore Enterprise Automation Daemon (Python 3)
Continuously monitors schedules in real-time (every 10s) and triggers automated backups.
Runs 24/7 as a background Linux system service on Hostinger VPS (77.37.45.233).
"""

import sys
import time
import os
import subprocess
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PHP_CRON_SCRIPT = os.path.join(SCRIPT_DIR, "cron_daily_backup.php")

def run_backup_check(force=False):
    cmd = ["php", PHP_CRON_SCRIPT]
    if force:
        cmd.append("--force")
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        output = res.stdout.strip()
        if output:
            print(output, flush=True)
        if res.returncode != 0 and res.stderr:
            logging.error(f"Execution error: {res.stderr.strip()}")
            sys.stdout.flush()
    except subprocess.TimeoutExpired:
        logging.warning("Backup execution timed out (60s).")
        sys.stdout.flush()
    except Exception as e:
        logging.error(f"Daemon exception: {str(e)}")
        sys.stdout.flush()

def main():
    logging.info("Starting CliniCore Python 3 24/7 Automation Daemon...")
    logging.info(f"Target Runner: {PHP_CRON_SCRIPT}")
    
    # If invoked with --once or --force
    if "--once" in sys.argv:
        force = "--force" in sys.argv
        run_backup_check(force=force)
        return

    # Continuous 24/7 polling loop (every 15 seconds)
    while True:
        try:
            run_backup_check()
        except KeyboardInterrupt:
            logging.info("Daemon stopped by user.")
            break
        except Exception as e:
            logging.error(f"Loop error: {str(e)}")
        time.sleep(15)

if __name__ == "__main__":
    main()
