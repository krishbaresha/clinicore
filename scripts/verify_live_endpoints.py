import urllib.request, json

endpoints = [
    'https://api.clinicore.me/api/health',
    'https://api.clinicore.me/api/v1/system/config',
    'https://api.clinicore.me/api/v1/system/sync-state'
]

print("=== VERIFYING LIVE CLOUD ENDPOINTS ===")
for ep in endpoints:
    try:
        req = urllib.request.Request(ep, headers={'User-Agent': 'CliniCore-Live-Test'})
        with urllib.request.urlopen(req, timeout=10) as res:
            data = res.read().decode('utf-8')
            print(f"[PASS] 200 OK: {ep}")
            print(f"       Response Preview: {data[:160]}")
    except Exception as e:
        print(f"[FAIL] {ep} -> {e}")
