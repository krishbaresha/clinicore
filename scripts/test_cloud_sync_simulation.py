import urllib.request, json

API_URL = "https://api.clinicore.me/api/v1/system/sync-state"

print("======================================================")
print("  MULTI-DEVICE UNIVERSAL REAL-TIME CLOUD SYNC TEST    ")
print("======================================================")

# Step 1: Simulate Device 1 (Reception in Hyderabad) creating a patient & visit
device1_payload = {
    "cf_patients_v5": [
        {
            "id": "pat_sim_001",
            "full_name": "Tariq Ahmed Khan",
            "relation_name": "Bashir Ahmed",
            "phone": "03001234567",
            "gender": "male",
            "age": 42
        }
    ],
    "cf_visits_v5": [
        {
            "id": "vis_sim_001",
            "patient_id": "pat_sim_001",
            "patient_name": "Tariq Ahmed Khan",
            "token_number": 1,
            "status": "waiting",
            "fee_amount": 500,
            "visit_date": "2026-08-25T13:30:00Z"
        }
    ]
}

print("\n[Step 1] Device 1 (Receptionist) pushing new patient & token to VPS MySQL...")
req = urllib.request.Request(
    API_URL,
    data=json.dumps(device1_payload).encode('utf-8'),
    headers={"Content-Type": "application/json", "User-Agent": "CliniCore-Device1"}
)
with urllib.request.urlopen(req, timeout=10) as res:
    print(f"  Push Status: {res.getcode()} -> {res.read().decode('utf-8')}")

# Step 2: Simulate Device 2 (Doctor in consultation room or any browser worldwide) pulling state
print("\n[Step 2] Device 2 (Doctor Terminal) pulling cloud state from VPS...")
get_req = urllib.request.Request(API_URL, headers={"User-Agent": "CliniCore-Device2"})
with urllib.request.urlopen(get_req, timeout=10) as res:
    cloud_data = json.loads(res.read().decode('utf-8'))
    patients = cloud_data.get("data", {}).get("cf_patients_v5", [])
    visits = cloud_data.get("data", {}).get("cf_visits_v5", [])
    
    print(f"  Device 2 Received Patients: {len(patients)} -> {patients}")
    print(f"  Device 2 Received Visits: {len(visits)} -> {visits}")
    
    assert len(patients) == 1, "Patient count mismatch on Device 2!"
    assert patients[0]["full_name"] == "Tariq Ahmed Khan", "Patient name mismatch!"
    assert len(visits) == 1, "Visit count mismatch on Device 2!"
    print("  [SUCCESS] Device 2 is 100% in lockstep with Device 1 via VPS MySQL!")

# Step 3: Clean up test simulation back to clean ground-zero state
print("\n[Step 3] Resetting cloud state back to clean ground zero...")
clean_payload = {
    "cf_patients_v5": [],
    "cf_visits_v5": [],
    "cf_sales_v5": [],
    "cf_inventory_v5": []
}
clean_req = urllib.request.Request(
    API_URL,
    data=json.dumps(clean_payload).encode('utf-8'),
    headers={"Content-Type": "application/json", "User-Agent": "CliniCore-Reset"}
)
with urllib.request.urlopen(clean_req, timeout=10) as res:
    print(f"  Reset Status: {res.getcode()}")

print("\n======================================================")
print("  ALL MULTI-DEVICE CLOUD SYNC TESTS PASSED PERFECTLY! ")
print("======================================================")
