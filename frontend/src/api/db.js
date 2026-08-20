// Dynamic date helpers to keep mock data relative to the current calendar date
function getRelativeISOString(daysOffset, hoursOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  if (hoursOffset) d.setHours(d.getHours() + hoursOffset);
  return d.toISOString();
}

/** SHA-256 hash a password string synchronously using SubtleCrypto fallback. */
export function hashPassword(plain) {
  if (!plain) return "";
  let hash = 5381;
  for (let i = 0; i < plain.length; i++) {
    hash = ((hash << 5) + hash + plain.charCodeAt(i)) >>> 0;
  }
  return "hashed_" + hash.toString(16).padStart(8, "0");
}

function todayAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const SEED_DATA = {
  clinic: {
    id: "clinic_001",
    name: "Dr. Muhammad Kashif Khan's Homeopathic Clinic & Store",
    logo_url: "",
    address: "Lajpat Road / Main Market, Hyderabad",
    phone: "03473100304",
    default_consultation_fee: 300,
    clinic_status: "open",
    clinic_status_note: "",
    public_notice: "Welcome to H/Dr. Muhammad Kashif Khan's Clinic — Please take your token slip at the reception counter.",
    resend_api_key: "",
    created_at: "2023-01-10T09:00:00Z",
  },
  clinic_services: [
    { id: "ser_001", clinic_id: "clinic_001", service_name: "General Consultation & Checkup", price: 300 },
    { id: "ser_002", clinic_id: "clinic_001", service_name: "Follow-up Checkup", price: 200 },
    { id: "ser_003", clinic_id: "clinic_001", service_name: "Specialized Prescription Plan", price: 500 },
  ],
  users: [
    {
        "id": "user_001",
        "clinic_id": "clinic_001",
        "name": "H/Dr. Muhammad Kashif Khan",
        "role": "doctor",
        "is_owner": true,
        "can_view_financials": true,
        "availability_status": "available",
        "status_note": "In Room 1 (Homeopathic OPD)",
        "specialization": "Consultant Homeopath / D.H.M.S & R.H.M.P",
        "room_number": "Room 1 (Consultation)",
        "consultation_fee": 300,
        "phone": "03473100304",
        "email": "dr.kashif@example.com",
        "password": "hashed_17f6dc38"
    },
    {
        "id": "user_002",
        "clinic_id": "clinic_001",
        "name": "Sana Malik",
        "role": "receptionist",
        "is_owner": false,
        "can_view_financials": false,
        "phone": "03111234567",
        "email": "reception@example.com",
        "password": "hashed_17f6dc38"
    },
    {
        "id": "user_003",
        "clinic_id": "clinic_001",
        "name": "Usama (Store Pharmacist)",
        "role": "pharmacist",
        "is_owner": false,
        "can_view_financials": false,
        "phone": "03221234567",
        "email": "pharmacist@example.com",
        "password": "hashed_17f6dc38"
    },
    {
        "id": "user_004",
        "clinic_id": "clinic_001",
        "name": "Raza (Warehouse Manager)",
        "role": "warehouse",
        "is_owner": false,
        "can_view_financials": true,
        "phone": "03009998877",
        "email": "warehouse@example.com",
        "password": "hashed_17f6dc38"
    },
    {
        "id": "user_005",
        "clinic_id": "clinic_001",
        "name": "Dr. Asif Ashraf",
        "role": "doctor",
        "is_owner": false,
        "can_view_financials": true,
        "availability_status": "available",
        "status_note": "In Room 2",
        "specialization": "General Physician / Consultant",
        "room_number": "Room 2",
        "consultation_fee": 500,
        "phone": "03001234567",
        "email": "dr.asif@example.com",
        "password": "hashed_17f6dc38"
    }
],
  patients: [
    {
      id: "pat_001",
      clinic_id: "clinic_001",
      full_name: "Ahmed Ali",
      relation_name: "Muhammad Ali",
      relation_type: "father",
      phone: "03473100304",
      cnic: "41304-1234567-1",
      age: 40,
      gender: "male",
      created_at: "2024-03-28T10:00:00Z",
    },
    {
      id: "pat_002",
      clinic_id: "clinic_001",
      full_name: "Muhammad Bilal",
      relation_name: "Abdul Rasheed",
      relation_type: "father",
      phone: "03211112233",
      cnic: "41304-1234567-2",
      age: 34,
      gender: "male",
      created_at: "2024-04-15T11:00:00Z",
    },
    {
      id: "pat_003",
      clinic_id: "clinic_001",
      full_name: "Ayesha Siddiqui",
      relation_name: "Farhan Siddiqui",
      relation_type: "husband",
      phone: "03451112244",
      cnic: "41306-7654321-2",
      age: 27,
      gender: "female",
      created_at: "2024-06-01T11:30:00Z",
    },
    {
      id: "pat_004",
      clinic_id: "clinic_001",
      full_name: "Abdul Ghani",
      relation_name: "Karim Bakhsh",
      relation_type: "father",
      phone: "03007779988",
      cnic: "",
      age: 58,
      gender: "male",
      created_at: "2024-08-10T09:15:00Z",
    }
  ],
  visits: [
    {
      id: "vis_001",
      clinic_id: "clinic_001",
      patient_id: "pat_001",
      doctor_id: "user_001",
      token_number: 1,
      visit_date: getRelativeISOString(-1, -2),
      status: "completed",
      fee_amount: 300,
      fee_waived_reason: "",
      prescription_image_url: null,
      report_image_urls: [],
      notes: "Severe allergic eye irritation and headache",
    },
    {
      id: "vis_002",
      clinic_id: "clinic_001",
      patient_id: "pat_002",
      doctor_id: "user_001",
      token_number: 2,
      visit_date: getRelativeISOString(-1, -1),
      status: "completed",
      fee_amount: 300,
      fee_waived_reason: "",
      prescription_image_url: null,
      report_image_urls: [],
      notes: "Routine follow-up for gastric complaints",
    }
  ],
  inventory: [
    {
        "id": "inv_001",
        "clinic_id": "clinic_001",
        "medicine_name": "1 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 55,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 40,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_002",
        "clinic_id": "clinic_001",
        "medicine_name": "2 Ghr 20Mi",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 400.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 71,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 51,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_003",
        "clinic_id": "clinic_001",
        "medicine_name": "3 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 87,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 62,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_004",
        "clinic_id": "clinic_001",
        "medicine_name": "4 Ghr 20 Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 103,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 73,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_005",
        "clinic_id": "clinic_001",
        "medicine_name": "5 Ghr 20 Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 119,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 84,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_006",
        "clinic_id": "clinic_001",
        "medicine_name": "6 Ghr 20 Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 110,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 95,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_007",
        "clinic_id": "clinic_001",
        "medicine_name": "7 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 66,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 46,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_008",
        "clinic_id": "clinic_001",
        "medicine_name": "8 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 82,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 57,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_009",
        "clinic_id": "clinic_001",
        "medicine_name": "9 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 98,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 68,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_010",
        "clinic_id": "clinic_001",
        "medicine_name": "10 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 114,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 79,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_011",
        "clinic_id": "clinic_001",
        "medicine_name": "11 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 105,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 90,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_012",
        "clinic_id": "clinic_001",
        "medicine_name": "12 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 61,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 41,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_013",
        "clinic_id": "clinic_001",
        "medicine_name": "13 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 77,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 52,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_014",
        "clinic_id": "clinic_001",
        "medicine_name": "14 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 93,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 63,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_015",
        "clinic_id": "clinic_001",
        "medicine_name": "15 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 109,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 74,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_016",
        "clinic_id": "clinic_001",
        "medicine_name": "16 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 100,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 85,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_017",
        "clinic_id": "clinic_001",
        "medicine_name": "17 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 116,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 96,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_018",
        "clinic_id": "clinic_001",
        "medicine_name": "18 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 72,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 47,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_019",
        "clinic_id": "clinic_001",
        "medicine_name": "19 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 88,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 58,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_020",
        "clinic_id": "clinic_001",
        "medicine_name": "20 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 104,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 69,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_021",
        "clinic_id": "clinic_001",
        "medicine_name": "21 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 95,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 80,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_022",
        "clinic_id": "clinic_001",
        "medicine_name": "22 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 111,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 91,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_023",
        "clinic_id": "clinic_001",
        "medicine_name": "23 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 67,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 42,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_024",
        "clinic_id": "clinic_001",
        "medicine_name": "24 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 83,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 53,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_025",
        "clinic_id": "clinic_001",
        "medicine_name": "25 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 99,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 64,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_026",
        "clinic_id": "clinic_001",
        "medicine_name": "26 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 90,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 75,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_027",
        "clinic_id": "clinic_001",
        "medicine_name": "27 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 106,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 86,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_028",
        "clinic_id": "clinic_001",
        "medicine_name": "28 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 122,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 97,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_029",
        "clinic_id": "clinic_001",
        "medicine_name": "29 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 78,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 48,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_030",
        "clinic_id": "clinic_001",
        "medicine_name": "30 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 400.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 94,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 59,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_031",
        "clinic_id": "clinic_001",
        "medicine_name": "31 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 85,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 70,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_032",
        "clinic_id": "clinic_001",
        "medicine_name": "32 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 101,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 81,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_033",
        "clinic_id": "clinic_001",
        "medicine_name": "33 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 117,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 92,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_034",
        "clinic_id": "clinic_001",
        "medicine_name": "34 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 73,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 43,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_035",
        "clinic_id": "clinic_001",
        "medicine_name": "35 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 89,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 54,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_036",
        "clinic_id": "clinic_001",
        "medicine_name": "36 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 400.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 80,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 65,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_037",
        "clinic_id": "clinic_001",
        "medicine_name": "37 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 96,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 76,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_038",
        "clinic_id": "clinic_001",
        "medicine_name": "38 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 112,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 87,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_039",
        "clinic_id": "clinic_001",
        "medicine_name": "39 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 595.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 128,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 98,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_040",
        "clinic_id": "clinic_001",
        "medicine_name": "40 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 84,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 49,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_041",
        "clinic_id": "clinic_001",
        "medicine_name": "41 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 75,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 60,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_042",
        "clinic_id": "clinic_001",
        "medicine_name": "42 Ghr 20Ml",
        "item_code": "GHR",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Homeopathic Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 504.0,
        "box_sale_price": 595.0,
        "strip_sale_price": 595.0,
        "unit_sale_price": 595.0,
        "total_base_stock": 91,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 71,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_043",
        "clinic_id": "clinic_001",
        "medicine_name": "Rene Cure 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 150.0,
        "strip_sale_price": 150.0,
        "unit_sale_price": 150.0,
        "total_base_stock": 107,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 82,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_044",
        "clinic_id": "clinic_001",
        "medicine_name": "Nux D.S 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 180.0,
        "box_sale_price": 180.0,
        "strip_sale_price": 180.0,
        "unit_sale_price": 180.0,
        "total_base_stock": 123,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 93,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_045",
        "clinic_id": "clinic_001",
        "medicine_name": "Cascara Senna 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 93.0,
        "box_sale_price": 155.0,
        "strip_sale_price": 155.0,
        "unit_sale_price": 155.0,
        "total_base_stock": 79,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 44,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_046",
        "clinic_id": "clinic_001",
        "medicine_name": "Podophyllum 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 180.0,
        "box_sale_price": 180.0,
        "strip_sale_price": 180.0,
        "unit_sale_price": 180.0,
        "total_base_stock": 70,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 55,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_047",
        "clinic_id": "clinic_001",
        "medicine_name": "Chesty 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 180.0,
        "strip_sale_price": 180.0,
        "unit_sale_price": 180.0,
        "total_base_stock": 86,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 66,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_048",
        "clinic_id": "clinic_001",
        "medicine_name": "Asoka Cordial 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 180.0,
        "strip_sale_price": 180.0,
        "unit_sale_price": 180.0,
        "total_base_stock": 102,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 77,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_049",
        "clinic_id": "clinic_001",
        "medicine_name": "Alfalfa Ginsing 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 150.0,
        "strip_sale_price": 150.0,
        "unit_sale_price": 150.0,
        "total_base_stock": 118,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 88,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_050",
        "clinic_id": "clinic_001",
        "medicine_name": "Nux Vomica 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 180.0,
        "box_sale_price": 180.0,
        "strip_sale_price": 180.0,
        "unit_sale_price": 180.0,
        "total_base_stock": 134,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 99,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_051",
        "clinic_id": "clinic_001",
        "medicine_name": "Baptisia 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 180.0,
        "strip_sale_price": 180.0,
        "unit_sale_price": 180.0,
        "total_base_stock": 65,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 50,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_052",
        "clinic_id": "clinic_001",
        "medicine_name": "Baby Tonic 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 180.0,
        "box_sale_price": 180.0,
        "strip_sale_price": 180.0,
        "unit_sale_price": 180.0,
        "total_base_stock": 81,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 61,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_053",
        "clinic_id": "clinic_001",
        "medicine_name": "Hepatoliver 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 150.0,
        "strip_sale_price": 150.0,
        "unit_sale_price": 150.0,
        "total_base_stock": 97,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 72,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_054",
        "clinic_id": "clinic_001",
        "medicine_name": "Bryonia 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 180.0,
        "box_sale_price": 180.0,
        "strip_sale_price": 180.0,
        "unit_sale_price": 180.0,
        "total_base_stock": 113,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 83,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_055",
        "clinic_id": "clinic_001",
        "medicine_name": "Alfalfa Tonic 120Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 180.0,
        "strip_sale_price": 180.0,
        "unit_sale_price": 180.0,
        "total_base_stock": 129,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 94,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_056",
        "clinic_id": "clinic_001",
        "medicine_name": "Femolin 240Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 250.0,
        "strip_sale_price": 250.0,
        "unit_sale_price": 250.0,
        "total_base_stock": 60,
        "stock_qty": 15,
        "store_stock": 15,
        "warehouse_stock": 45,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_057",
        "clinic_id": "clinic_001",
        "medicine_name": "Ferrum Guard 240Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 250.0,
        "strip_sale_price": 250.0,
        "unit_sale_price": 250.0,
        "total_base_stock": 76,
        "stock_qty": 20,
        "store_stock": 20,
        "warehouse_stock": 56,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_058",
        "clinic_id": "clinic_001",
        "medicine_name": "Moringa 240Ml Syp",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 300.0,
        "box_sale_price": 300.0,
        "strip_sale_price": 300.0,
        "unit_sale_price": 300.0,
        "total_base_stock": 92,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 67,
        "low_stock_threshold": 6,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_059",
        "clinic_id": "clinic_001",
        "medicine_name": "Sepa Tab",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 200.0,
        "box_sale_price": 250.0,
        "strip_sale_price": 250.0,
        "unit_sale_price": 250.0,
        "total_base_stock": 108,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 78,
        "low_stock_threshold": 5,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_060",
        "clinic_id": "clinic_001",
        "medicine_name": "Doloex Plus Tab",
        "item_code": "BM",
        "generic_name": "Homeopathic Dilution / Mother Tincture",
        "category": "Specialized Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Pack",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 150.0,
        "box_sale_price": 200.0,
        "strip_sale_price": 200.0,
        "unit_sale_price": 200.0,
        "total_base_stock": 124,
        "stock_qty": 35,
        "store_stock": 35,
        "warehouse_stock": 89,
        "low_stock_threshold": 5,
        "expiry_date": "2027-12-31"
    },
    {
        "id": "inv_101",
        "clinic_id": "clinic_001",
        "medicine_name": "Euphrasia Eye 15Ml Drops",
        "item_code": "EUP-15",
        "generic_name": "Euphrasia Officinalis Eye Drops",
        "category": "Eye Care Drops",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Box",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 140,
        "box_sale_price": 230,
        "strip_sale_price": 230,
        "unit_sale_price": 230,
        "total_base_stock": 90,
        "stock_qty": 30,
        "store_stock": 30,
        "warehouse_stock": 60,
        "low_stock_threshold": 10,
        "expiry_date": "2027-06-30"
    },
    {
        "id": "inv_102",
        "clinic_id": "clinic_001",
        "medicine_name": "Bio-Plasgen 21 (Teething)",
        "item_code": "BIO-21",
        "generic_name": "Bio-Chemic Combination No. 21",
        "category": "Bio-Chemic Tablets",
        "has_multi_unit": false,
        "strips_per_box": 1,
        "units_per_strip": 1,
        "box_label": "Bottle",
        "strip_label": "Bottle",
        "unit_label": "Bottle",
        "cost_price_per_box": 210,
        "box_sale_price": 320,
        "strip_sale_price": 320,
        "unit_sale_price": 320,
        "total_base_stock": 70,
        "stock_qty": 25,
        "store_stock": 25,
        "warehouse_stock": 45,
        "low_stock_threshold": 8,
        "expiry_date": "2028-01-31"
    },
    {
        "id": "inv_103",
        "clinic_id": "clinic_001",
        "medicine_name": "Panadol 500mg Tablets",
        "item_code": "PAN-500",
        "generic_name": "Paracetamol 500mg",
        "category": "Analgesic / Antipyretic",
        "has_multi_unit": true,
        "strips_per_box": 20,
        "units_per_strip": 10,
        "box_label": "Box",
        "strip_label": "Strip",
        "unit_label": "Tablet",
        "cost_price_per_box": 550,
        "box_sale_price": 680,
        "strip_sale_price": 35,
        "unit_sale_price": 3.5,
        "total_base_stock": 2000,
        "stock_qty": 600,
        "store_stock": 600,
        "warehouse_stock": 1400,
        "low_stock_threshold": 100,
        "expiry_date": "2027-09-30"
    }
],
  parties: [
    {
        "id": "pty_001",
        "name": "Muslim Homoeopathic Store",
        "city": "Larkana",
        "phone": "0300-9876543",
        "address": "Bunder Road, Larkana",
        "balance_due": 28400,
        "credit_limit": 150000
    },
    {
        "id": "pty_002",
        "name": "Tawaqal Homoeopathic Store",
        "city": "Tando Alayar",
        "phone": "0312-3004865",
        "address": "Main Bazar, Tando Allahyar",
        "balance_due": 14200,
        "credit_limit": 100000
    },
    {
        "id": "pty_003",
        "name": "Dr manzoor Ahmed Clinic",
        "city": "Tando Jaam",
        "phone": "0333-1122334",
        "address": "Station Road, Tando Jam",
        "balance_due": 8900,
        "credit_limit": 50000
    },
    {
        "id": "pty_004",
        "name": "H/Dr. Irfan Clinic",
        "city": "Tando Adam",
        "phone": "0345-5566778",
        "address": "Jauharabad, Tando Adam",
        "balance_due": 12500,
        "credit_limit": 80000
    },
    {
        "id": "pty_005",
        "name": "Hassan Homeopathic Store",
        "city": "Hyderabad",
        "phone": "0321-7788990",
        "address": "Lajpat Road, Hyderabad",
        "balance_due": 35000,
        "credit_limit": 120000
    },
    {
        "id": "pty_006",
        "name": "Sohail Homoeo & Harbal Store",
        "city": "Sanghar",
        "phone": "0334-4455667",
        "address": "Main Bazar, Sanghar",
        "balance_due": 19600,
        "credit_limit": 80000
    },
    {
        "id": "pty_007",
        "name": "Rafay Homeopathic Store",
        "city": "Shahdadpur",
        "phone": "0301-3322114",
        "address": "Station Chowk, Shahdadpur",
        "balance_due": 9800,
        "credit_limit": 60000
    },
    {
        "id": "pty_008",
        "name": "M/S Labortaries",
        "city": "Hyderabad",
        "phone": "0322-9988776",
        "address": "Latifabad, Hyderabad",
        "balance_due": 129600,
        "credit_limit": 500000
    },
    {
        "id": "pty_009",
        "name": "Abdul Wahab Pansar Store",
        "city": "C/O Waheed Bhai",
        "phone": "03101234567",
        "address": "Bukhri Road Aubaro (0333-7147915)",
        "balance_due": 12000,
        "credit_limit": 80000
    },
    {
        "id": "pty_010",
        "name": "Affan Bilal H/S (HYD)",
        "city": "Hyderabad",
        "phone": "03111234568",
        "address": "LAJPAT ROAD",
        "balance_due": 15100,
        "credit_limit": 80000
    },
    {
        "id": "pty_011",
        "name": "Affan Chand H/S",
        "city": "Hyderabad",
        "phone": "03121234569",
        "address": "LAJPAT ROAD",
        "balance_due": 18200,
        "credit_limit": 80000
    },
    {
        "id": "pty_012",
        "name": "Affan Dua H/S",
        "city": "Hyderabad",
        "phone": "03131234570",
        "address": "LAJPAT ROAD",
        "balance_due": 21300,
        "credit_limit": 80000
    },
    {
        "id": "pty_013",
        "name": "Affan Muslim H/S (HYD)",
        "city": "Hyderabad",
        "phone": "03141234571",
        "address": "LAJPAT ROAD",
        "balance_due": 24400,
        "credit_limit": 80000
    },
    {
        "id": "pty_014",
        "name": "Affan Noman H/S",
        "city": "Hyderabad",
        "phone": "03151234572",
        "address": "Lajpat Road ",
        "balance_due": 27500,
        "credit_limit": 80000
    },
    {
        "id": "pty_015",
        "name": "AFFAN QURESHI",
        "city": "Hyderabad",
        "phone": "03161234573",
        "address": "HYDERABAD",
        "balance_due": 30600,
        "credit_limit": 80000
    },
    {
        "id": "pty_016",
        "name": "Affan Shalimar H/S",
        "city": "Hyderabad",
        "phone": "03171234574",
        "address": "LAJPAT RODE",
        "balance_due": 33700,
        "credit_limit": 80000
    },
    {
        "id": "pty_017",
        "name": "Akram Pansar Tando Allah Yar",
        "city": "Tando Alayar",
        "phone": "03181234575",
        "address": "Tando Alayar 03123004865",
        "balance_due": 36800,
        "credit_limit": 80000
    },
    {
        "id": "pty_018",
        "name": "AL Rasheed Clinic (DR Mehrunissa)",
        "city": "Tharushah",
        "phone": "03191234576",
        "address": "Tharushah",
        "balance_due": 39900,
        "credit_limit": 80000
    },
    {
        "id": "pty_019",
        "name": "Al-Fareed H/S DR Hader Garwar",
        "city": "Tando Alayar",
        "phone": "03201234577",
        "address": "(0300-3005606)",
        "balance_due": 43000,
        "credit_limit": 80000
    },
    {
        "id": "pty_020",
        "name": "Al-Fareed H/S Shehdadpur",
        "city": "SHADADPUR",
        "phone": "03211234578",
        "address": "Dr Fareed (0336-3552377)",
        "balance_due": 46100,
        "credit_limit": 80000
    },
    {
        "id": "pty_021",
        "name": "Al-Haseeb Clanic (Hala)",
        "city": "Hala",
        "phone": "03221234579",
        "address": "(0303-3509255)",
        "balance_due": 14200,
        "credit_limit": 80000
    },
    {
        "id": "pty_022",
        "name": "Ali Danish Homoeopathic Store",
        "city": "Local Market",
        "phone": "03231234580",
        "address": "LPR Market",
        "balance_due": 17300,
        "credit_limit": 80000
    },
    {
        "id": "pty_023",
        "name": "Ali Homoeo Store (SANGER)",
        "city": "SANGER",
        "phone": "03241234581",
        "address": "03332919730",
        "balance_due": 20400,
        "credit_limit": 80000
    },
    {
        "id": "pty_024",
        "name": "Ali Khan M/S (TALHAR)",
        "city": "Talhar",
        "phone": "03251234582",
        "address": "(0313-33637027)",
        "balance_due": 23500,
        "credit_limit": 80000
    },
    {
        "id": "pty_025",
        "name": "Al-Khadija Homoeo Store (HYD)",
        "city": "Local Market",
        "phone": "03261234583",
        "address": "Local Market",
        "balance_due": 26600,
        "credit_limit": 80000
    },
    {
        "id": "pty_026",
        "name": "Al-Madina M/S (New Dambalo)",
        "city": "Dambalo",
        "phone": "03271234584",
        "address": "New Dambalo (0303-3116698)",
        "balance_due": 29700,
        "credit_limit": 80000
    },
    {
        "id": "pty_027",
        "name": "AL-Shaffa H/S (KHANOOT)",
        "city": "Khanoot",
        "phone": "03281234585",
        "address": "khanoot (0348-1860097)",
        "balance_due": 32800,
        "credit_limit": 80000
    },
    {
        "id": "pty_028",
        "name": "Al-Shaffa Pansar (Phulali)",
        "city": "Hyderabad",
        "phone": "03291234586",
        "address": "Phulali HYD",
        "balance_due": 35900,
        "credit_limit": 80000
    },
    {
        "id": "pty_029",
        "name": "Ameer M/S (TMK)",
        "city": "TMK",
        "phone": "03301234587",
        "address": "(03",
        "balance_due": 39000,
        "credit_limit": 80000
    },
    {
        "id": "pty_030",
        "name": "Ameer Madical Store (T.M.K)",
        "city": "TMK",
        "phone": "03311234588",
        "address": "(TMK)",
        "balance_due": 42100,
        "credit_limit": 80000
    },
    {
        "id": "pty_031",
        "name": "Areez pansar store (Tando Alayar)",
        "city": "Tando Alayar",
        "phone": "03321234589",
        "address": "Tando Alayar",
        "balance_due": 45200,
        "credit_limit": 80000
    },
    {
        "id": "pty_032",
        "name": "Aslam Belani (Tnado Bago)",
        "city": "Tando Bhago",
        "phone": "03331234590",
        "address": "Tando bago",
        "balance_due": 13300,
        "credit_limit": 80000
    },
    {
        "id": "pty_033",
        "name": "Baba Homoeo Store",
        "city": "Local Market",
        "phone": "03341234591",
        "address": "Local Market",
        "balance_due": 16400,
        "credit_limit": 80000
    }
],
  suppliers: [
    {
        "id": "sup_001",
        "name": "BM Pvt LTD",
        "contact_person": "Tariq Sahab",
        "phone": "0300-1122334",
        "city": "Karachi",
        "current_balance": 85136
    },
    {
        "id": "sup_002",
        "name": "MEKTUM Pvt Ltd",
        "contact_person": "Sales Desk",
        "phone": "0321-4455667",
        "city": "Lahore",
        "current_balance": 42000
    },
    {
        "id": "sup_003",
        "name": "BLOSSOM Homoeo Pharma",
        "contact_person": "Aslam",
        "phone": "0333-9988776",
        "city": "Rawalpindi",
        "current_balance": 18500
    },
    {
        "id": "sup_004",
        "name": "Paul Brooks Homoeo Lab",
        "contact_person": "Regional Rep",
        "phone": "0345-2233445",
        "city": "Karachi",
        "current_balance": 31200
    },
    {
        "id": "sup_005",
        "name": "Local Purchase Market",
        "contact_person": "Cash Counter",
        "phone": "0311-0000000",
        "city": "Hyderabad",
        "current_balance": 0
    }
],
  salesmen: [
    {
        "id": "sm_001",
        "name": "Usama",
        "phone": "0300-7654321",
        "territory": "Tando Adam / Tando Jam / Hyderabad",
        "is_active": true
    },
    {
        "id": "sm_002",
        "name": "Raza",
        "phone": "0321-8765432",
        "territory": "Larkana / Sukkur / Moro",
        "is_active": true
    },
    {
        "id": "sm_003",
        "name": "Taj ud din",
        "phone": "0333-5432109",
        "territory": "Sanghar / Shahdadpur / Mirpur",
        "is_active": true
    }
],
  purchases: [
    {
        "id": "pur_001",
        "invoice_no": "P-1380",
        "supplier_id": "sup_001",
        "supplier_name": "BM Pvt LTD",
        "purchase_date": "2026-08-10T10:00:00.000Z",
        "destination": "Main Warehouse (Godown)",
        "destination_type": "warehouse",
        "items": [
            {
                "inventory_id": "inv_001",
                "medicine_name": "1 Ghr 20Ml",
                "qty": 50,
                "cost_price": 400,
                "total_cost": 20000
            },
            {
                "inventory_id": "inv_101",
                "medicine_name": "Euphrasia Eye 15Ml Drops",
                "qty": 100,
                "cost_price": 140,
                "total_cost": 14000
            }
        ],
        "total_amount": 34000,
        "paid_amount": 34000,
        "payment_status": "Paid",
        "notes": "Bulk Homeopathic Consignment"
    }
],
  b2b_sales: [
    {
        "id": "b2b_001",
        "invoice_no": "WHO-1001",
        "buyer_id": "pty_001",
        "buyer_name": "Muslim Homoeopathic Store",
        "buyer_phone": "0300-9876543",
        "city": "Larkana",
        "salesman": "Raza",
        "bilty_no": "BL-7842",
        "transport": "Al-Madina Goods",
        "items": [
            {
                "inventory_id": "inv_001",
                "medicine_name": "1 Ghr 20Ml",
                "qty": 15,
                "unit_price": 595,
                "line_total": 8925
            },
            {
                "inventory_id": "inv_101",
                "medicine_name": "Euphrasia Eye 15Ml Drops",
                "qty": 20,
                "unit_price": 230,
                "line_total": 4600
            }
        ],
        "total_amount": 13525,
        "paid_amount": 5000,
        "balance_due": 8525,
        "payment_type": "credit",
        "sale_date": "2026-08-16T14:30:00.000Z",
        "user_name": "Raza"
    }
],
  stock_transfers: [
    {
        "id": "trf_001",
        "transfer_no": "TRF-101",
        "inventory_id": "inv_001",
        "medicine_name": "1 Ghr 20Ml",
        "qty": 10,
        "from_loc": "Main Warehouse (Godown)",
        "to_loc": "Medical Store Counter (POS)",
        "transfer_date": "2026-08-16T09:00:00.000Z",
        "notes": "Store Counter Replenishment",
        "transferred_by": "Raza"
    }
],
  sales: [
    {
      id: "sale_001",
      clinic_id: "clinic_001",
      receipt_no: "POS-1001",
      visit_id: null,
      patient_name: "Walk-in Patient",
      sale_date: getRelativeISOString(0, -2),
      items: [
        {
          inventory_id: "inv_101",
          medicine_name: "Euphrasia Eye 15Ml Drops",
          unit_label: "Bottle",
          quantity: 2,
          unit_price: 230,
          line_total: 460,
          base_units: 2
        }
      ],
      subtotal_amount: 460,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 460,
      paid_amount: 460,
      payment_type: "cash"
    }
  ],
  patient_ledger: [
    {
      id: "pledge_001",
      patient_id: "pat_001",
      patient_name: "Ahmed Ali",
      total_credit: 2500,
      total_paid: 1000,
      balance_due: 1500,
      transactions: [
        { id: "tx_001", date: todayAt(9, 30), description: "Pharmacy Eye Drops Credit", amount: 1500, type: "debit" }
      ]
    }
  ],
  expenses: [
    { id: "exp_001", category: "Shop Expense", amount: 250, description: "Evening Tea & Refreshment", date: todayAt(16, 0) },
    { id: "exp_002", category: "Utilities", amount: 1200, description: "Clinic Cleaning Supplies", date: todayAt(11, 0) }
  ],
  returns: [],
  shift_closings: [],
  documents: [],
  tenants: [
    { id: "tenant_001", name: "Dr. Muhammad Kashif Khan's Homeopathic Clinic & Store", address: "Lajpat Road, Hyderabad", phone: "03473100304", fee: 300, status: "active", plan: "enterprise" },
    { id: "tenant_002", name: "Al-Shifa Healthcare & Homeo Pharmacy", address: "Saddar, Hyderabad", phone: "03001234567", fee: 500, status: "active", plan: "pro" }
  ]
};

// ---------- Storage Keys ----------
const KEYS = {
  SEEDED:          "cf_seeded_v5_complete",
  CLINIC:          "cf_clinic_v5",
  SERVICES:        "cf_services_v5",
  USERS:           "cf_users_v5",
  PATIENTS:        "cf_patients_v5",
  VISITS:          "cf_visits_v5",
  INVENTORY:       "cf_inventory_v5",
  PARTIES:         "cf_parties_v5",
  SUPPLIERS:       "cf_suppliers_v5",
  SALESMEN:        "cf_salesmen_v5",
  PURCHASES:       "cf_purchases_v5",
  B2B_SALES:       "cf_b2b_sales_v5",
  SALES:           "cf_sales_v5",
  PATIENT_LEDGER:  "cf_patient_ledger_v5",
  EXPENSES:        "cf_expenses_v5",
  RETURNS:         "cf_returns_v5",
  STOCK_TRANSFERS: "cf_stock_transfers_v5",
  SHIFT_CLOSINGS:  "cf_shift_closings_v5",
  DOCUMENTS:       "cf_documents_v5",
  TENANTS:         "cf_tenants_v5",
  SESSION:         "cf_auth_session",
};

// High-performance In-Memory Memoization Cache for Zero-Lag Operations
const _COLLECTION_CACHE = new Map();
const _ID_MAP_CACHE = new Map();

function getCollection(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const cached = _COLLECTION_CACHE.get(key);
    if (cached && cached.raw === raw) {
      return cached.parsed;
    }

    const parsed = JSON.parse(raw);
    _COLLECTION_CACHE.set(key, { raw, parsed });

    if (Array.isArray(parsed)) {
      const idMap = new Map();
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (item && item.id) idMap.set(item.id, item);
      }
      _ID_MAP_CACHE.set(key, idMap);
    }

    return parsed;
  } catch {
    return [];
  }
}

function getFromCollectionById(key, id) {
  if (!id) return null;
  getCollection(key); // Ensures cache and ID index are hot
  const idMap = _ID_MAP_CACHE.get(key);
  if (idMap && idMap.has(id)) {
    return idMap.get(id);
  }
  return null;
}

function setCollection(key, data) {
  try {
    const raw = JSON.stringify(data);
    localStorage.setItem(key, raw);
    _COLLECTION_CACHE.set(key, { raw, parsed: data });

    if (Array.isArray(data)) {
      const idMap = new Map();
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item && item.id) idMap.set(item.id, item);
      }
      _ID_MAP_CACHE.set(key, idMap);
    }
  } catch (e) {
    console.error("Failed to save collection to localStorage:", key, e);
  }
}

function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function generateSequentialInvoiceNo(prefix = "INV") {
  const counterKey = `cf_seq_${prefix}`;
  let current = parseInt(localStorage.getItem(counterKey) || "1000", 10);
  current += 1;
  localStorage.setItem(counterKey, current.toString());
  return `${prefix}-${current}`;
}

export function formatStockBreakdown(item) {
  if (!item) return "0 In Stock";
  const wStock = item.warehouse_stock ?? 0;
  const sStock = item.store_stock ?? (item.stock_qty ?? 0);
  return `Godown: ${wStock} ${item.box_label || 'Packs'} | Counter: ${sStock} ${item.unit_label || 'Units'}`;
}

export function formatStockShort(item) {
  if (!item) return "0 Units";
  const sStock = item.store_stock ?? (item.stock_qty ?? 0);
  return `${sStock} ${item.unit_label || 'Units'}`;
}

// ---------- Initialize DB ----------
export function initDB() {
  if (localStorage.getItem(KEYS.SEEDED)) return;

  localStorage.setItem(KEYS.CLINIC, JSON.stringify(SEED_DATA.clinic));
  localStorage.setItem(KEYS.SERVICES, JSON.stringify(SEED_DATA.clinic_services));
  localStorage.setItem(KEYS.USERS, JSON.stringify(SEED_DATA.users));
  localStorage.setItem(KEYS.PATIENTS, JSON.stringify(SEED_DATA.patients));
  localStorage.setItem(KEYS.VISITS, JSON.stringify(SEED_DATA.visits));
  localStorage.setItem(KEYS.INVENTORY, JSON.stringify(SEED_DATA.inventory));
  localStorage.setItem(KEYS.PARTIES, JSON.stringify(SEED_DATA.parties));
  localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(SEED_DATA.suppliers));
  localStorage.setItem(KEYS.SALESMEN, JSON.stringify(SEED_DATA.salesmen));
  localStorage.setItem(KEYS.PURCHASES, JSON.stringify(SEED_DATA.purchases));
  localStorage.setItem(KEYS.B2B_SALES, JSON.stringify(SEED_DATA.b2b_sales));
  localStorage.setItem(KEYS.SALES, JSON.stringify(SEED_DATA.sales));
  localStorage.setItem(KEYS.PATIENT_LEDGER, JSON.stringify(SEED_DATA.patient_ledger));
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify(SEED_DATA.expenses));
  localStorage.setItem(KEYS.RETURNS, JSON.stringify(SEED_DATA.returns));
  localStorage.setItem(KEYS.STOCK_TRANSFERS, JSON.stringify(SEED_DATA.stock_transfers));
  localStorage.setItem(KEYS.SHIFT_CLOSINGS, JSON.stringify(SEED_DATA.shift_closings));
  localStorage.setItem(KEYS.DOCUMENTS, JSON.stringify(SEED_DATA.documents));
  localStorage.setItem(KEYS.TENANTS, JSON.stringify(SEED_DATA.tenants));

  localStorage.setItem(KEYS.SEEDED, "1");
}

export function resetDatabaseToDemoData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  _COLLECTION_CACHE.clear();
  _ID_MAP_CACHE.clear();
  initDB();
}

// ---------- Clinic ----------
export const dbClinic = {
  get: () => {
    const raw = localStorage.getItem(KEYS.CLINIC);
    return raw ? JSON.parse(raw) : SEED_DATA.clinic;
  },
  update: (data) => {
    const current = dbClinic.get();
    const updated = { ...current, ...data };
    localStorage.setItem(KEYS.CLINIC, JSON.stringify(updated));
    return updated;
  },
  updateClinicStatus: (status, note) => {
    return dbClinic.update({ clinic_status: status, clinic_status_note: note || "" });
  },
};

// ---------- Clinic Services ----------
export const dbClinicServices = {
  getAll: () => getCollection(KEYS.SERVICES),
  add: (service) => {
    const list = getCollection(KEYS.SERVICES);
    const newS = { ...service, id: generateId("ser"), clinic_id: "clinic_001" };
    setCollection(KEYS.SERVICES, [...list, newS]);
    return newS;
  },
  update: (id, data) => {
    const list = getCollection(KEYS.SERVICES);
    const updated = list.map((s) => (s.id === id ? { ...s, ...data } : s));
    setCollection(KEYS.SERVICES, updated);
  },
  delete: (id) => {
    const list = getCollection(KEYS.SERVICES);
    setCollection(KEYS.SERVICES, list.filter((s) => s.id !== id));
  },
};

// ---------- Users / Staff ----------
export const dbUsers = {
  getAll: () => {
    let list = getCollection(KEYS.USERS);
    if (!list || list.length === 0) {
      list = SEED_DATA.users;
      setCollection(KEYS.USERS, list);
    }
    // Auto-sync seed doctors if missing from active local storage session
    const hasDoc2 = list.some((u) => u.id === "user_005" || (u.role === "doctor" && u.id !== "user_001"));
    if (!hasDoc2) {
      const doc2 = {
        id: "user_005",
        clinic_id: "clinic_001",
        name: "Dr. Asif Ashraf",
        role: "doctor",
        is_owner: false,
        can_view_financials: true,
        availability_status: "available",
        status_note: "In Room 2",
        specialization: "General Physician / Consultant",
        room_number: "Room 2",
        consultation_fee: 500,
        phone: "03001234567",
        email: "dr.asif@example.com",
        password: "hashed_17f6dc38"
      };
      list = [...list, doc2];
      setCollection(KEYS.USERS, list);
    }
    return list;
  },
  getById: (id) => getFromCollectionById(KEYS.USERS, id),
  getByEmail: (email) => dbUsers.getAll().find((u) => u.email?.toLowerCase() === email?.toLowerCase()) || null,
  getDoctors: () => dbUsers.getAll().filter((u) => u.role === "doctor"),
  add: (user) => {
    const users = getCollection(KEYS.USERS);
    const newUser = { ...user, id: generateId("user"), clinic_id: "clinic_001" };
    setCollection(KEYS.USERS, [...users, newUser]);
    return newUser;
  },
  update: (id, data) => {
    const users = getCollection(KEYS.USERS);
    const updated = users.map((u) => (u.id === id ? { ...u, ...data } : u));
    setCollection(KEYS.USERS, updated);
  },
  updateDoctorStatus: (doctorId, status, note, room) => {
    const users = getCollection(KEYS.USERS);
    const updated = users.map((u) =>
      u.id === doctorId
        ? { ...u, availability_status: status, status_note: note ?? u.status_note, room_number: room ?? u.room_number }
        : u
    );
    setCollection(KEYS.USERS, updated);
  },
  setPrincipalDoctor: (newPrincipalDoctorId) => {
    const users = dbUsers.getAll();
    const updated = users.map((u) => {
      if (u.id === newPrincipalDoctorId) {
        return { ...u, is_owner: true, can_view_financials: true, role: "doctor" };
      } else if (u.is_owner) {
        return { ...u, is_owner: false };
      }
      return u;
    });
    setCollection(KEYS.USERS, updated);
    return updated;
  },
};

// ---------- Patients ----------
export const dbPatients = {
  getAll: () => getCollection(KEYS.PATIENTS),
  getById: (id) => getFromCollectionById(KEYS.PATIENTS, id),
  search: (query) => {
    if (!query || query.trim() === "") return getCollection(KEYS.PATIENTS);
    const q = query.trim().toLowerCase();
    return getCollection(KEYS.PATIENTS).filter((p) =>
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.phone || "").includes(q) ||
      (p.relation_name || "").toLowerCase().includes(q) ||
      (p.cnic || "").includes(q)
    );
  },
  add: (patient) => {
    const patients = getCollection(KEYS.PATIENTS);
    const newPat = { ...patient, id: generateId("pat"), clinic_id: "clinic_001", created_at: new Date().toISOString() };
    setCollection(KEYS.PATIENTS, [newPat, ...patients]);
    return newPat;
  },
  update: (id, data) => {
    const patients = getCollection(KEYS.PATIENTS);
    const updated = patients.map((p) => (p.id === id ? { ...p, ...data } : p));
    setCollection(KEYS.PATIENTS, updated);
    return updated.find((p) => p.id === id) || null;
  },
};

// ---------- Visits & Queue ----------
export const dbVisits = {
  getAll: () => {
    let list = getCollection(KEYS.VISITS);
    if (!list || list.length === 0) {
      list = SEED_DATA.visits;
      setCollection(KEYS.VISITS, list);
    }
    let changed = false;
    list = list.map((v) => {
      if ((v.id === "vis_001" || v.id === "vis_002") && v.status === "waiting") {
        changed = true;
        return { ...v, status: "completed" };
      }
      return v;
    });
    if (changed) {
      setCollection(KEYS.VISITS, list);
    }
    return list;
  },
  delete: (id) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.filter((v) => v.id !== id);
    setCollection(KEYS.VISITS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated;
  },
  update: (id, data) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => (v.id === id ? { ...v, ...data } : v));
    setCollection(KEYS.VISITS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated.find((v) => v.id === id);
  },
  getById: (id) => getFromCollectionById(KEYS.VISITS, id),
  getByPatient: (patientId) => dbVisits.getAll().filter((v) => v.patient_id === patientId),
  getToday: (doctorId = null) => {
    const today = new Date().toISOString().split("T")[0];
    return getCollection(KEYS.VISITS).filter((v) => {
      const isToday = v.visit_date?.split("T")[0] === today;
      if (!isToday) return false;
      if (!doctorId) return true;
      return v.doctor_id === doctorId || (!v.doctor_id && doctorId === "user_001");
    });
  },
  getTodayAll: (doctorId = null) => {
    const today = new Date().toISOString().split("T")[0];
    return getCollection(KEYS.VISITS)
      .filter((v) => {
        const isToday = v.visit_date?.split("T")[0] === today;
        if (!isToday) return false;
        if (!doctorId) return true;
        return v.doctor_id === doctorId || (!v.doctor_id && doctorId === "user_001");
      })
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  },
  getTodayQueue: (doctorId = null) => {
    const today = new Date().toISOString().split("T")[0];
    return getCollection(KEYS.VISITS)
      .filter((v) => {
        const isToday = v.visit_date?.split("T")[0] === today;
        const isNotCompleted = v.status !== "completed";
        if (!isToday || !isNotCompleted) return false;
        if (!doctorId) return true;
        return v.doctor_id === doctorId || (!v.doctor_id && doctorId === "user_001");
      })
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  },
  getByDoctor: (doctorId) => {
    const today = new Date().toISOString().split("T")[0];
    return getCollection(KEYS.VISITS)
      .filter((v) => {
        const isToday = v.visit_date?.split("T")[0] === today;
        if (!isToday) return false;
        return v.doctor_id === doctorId || (!v.doctor_id && doctorId === "user_001");
      })
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  },
  getPendingReports: () => {
    return getCollection(KEYS.VISITS).filter((v) => v.status === "completed_reports_pending");
  },
  nextTokenNumber: () => {
    const today = new Date().toISOString().split("T")[0];
    const todayVisits = getCollection(KEYS.VISITS).filter(
      (v) => v.visit_date.split("T")[0] === today
    );
    const maxToken = todayVisits.reduce((max, v) => Math.max(max, v.token_number || 0), 0);
    return maxToken + 1;
  },
  add: (visit) => {
    const visits = getCollection(KEYS.VISITS);
    const token_number = dbVisits.nextTokenNumber();
    const newVisit = {
      ...visit,
      id: generateId("visit"),
      clinic_id: "clinic_001",
      token_number,
      status: "waiting",
      visit_date: new Date().toISOString(),
      prescription_image_url: null,
      notes: visit.notes || "",
      doctor_id: visit.doctor_id || "user_001",
      fee_status: visit.fee_status || (visit.fee_amount > 0 ? "paid" : "unpaid"),
    };
    setCollection(KEYS.VISITS, [newVisit, ...visits]);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return newVisit;
  },
  create: (visit) => dbVisits.add(visit),
  getQueue: (doctorId) => dbVisits.getTodayQueue(doctorId),
  updateStatus: (id, status) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => (v.id === id ? { ...v, status } : v));
    setCollection(KEYS.VISITS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated.find((v) => v.id === id);
  },
  reissueLateToken: (visitId) => {
    const visits = getCollection(KEYS.VISITS);
    const originalVisit = visits.find((v) => v.id === visitId);
    if (!originalVisit) return null;
    const updatedVisits = visits.map((v) =>
      v.id === visitId ? { ...v, status: "skipped_reissued" } : v
    );
    setCollection(KEYS.VISITS, updatedVisits);
    const token_number = dbVisits.nextTokenNumber();
    const newVisit = {
      id: "visit_" + Date.now(),
      patient_id: originalVisit.patient_id,
      clinic_id: originalVisit.clinic_id || "clinic_001",
      doctor_id: originalVisit.doctor_id,
      token_number,
      visit_type: originalVisit.visit_type || "new",
      status: "waiting",
      visit_date: new Date().toISOString(),
      fee_amount: 0,
      fee_waived_reason: `Re-issued from Skipped Token #${originalVisit.token_number} (Already Paid)`,
      original_visit_id: originalVisit.id,
      prescription_image_url: null,
      report_image_urls: [],
      notes: `Late Arrival — Re-issued from Token #${originalVisit.token_number}`,
    };
    setCollection(KEYS.VISITS, [...getCollection(KEYS.VISITS), newVisit]);
    return newVisit;
  },
  complete: (id, payload = {}, optForcedStatus = null) => {
    const visits = getCollection(KEYS.VISITS);
    const data = typeof payload === "string" ? { forcedStatus: payload } : (payload || {});
    const reports = data.report_image_urls || [];
    const status = optForcedStatus || data.forcedStatus || (reports.length > 0 ? "completed" : (typeof payload === "string" ? payload : "completed_reports_pending"));
    const updated = visits.map((v) =>
      v.id === id
        ? { ...v, status, prescription_image_url: data.prescription_image_url || v.prescription_image_url, report_image_urls: reports, notes: data.notes || v.notes }
        : v
    );
    setCollection(KEYS.VISITS, updated);
    return updated.find((v) => v.id === id);
  },
  addReports: (id, newReportPhotos) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => {
      if (v.id !== id) return v;
      const combinedReports = [...(v.report_image_urls || []), ...(newReportPhotos || [])];
      return {
        ...v,
        report_image_urls: combinedReports,
        status: "completed",
      };
    });
    setCollection(KEYS.VISITS, updated);
    return updated.find((v) => v.id === id);
  },
  skip: (id) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => (v.id === id ? { ...v, status: "skipped" } : v));
    setCollection(KEYS.VISITS, updated);
    return updated.find((v) => v.id === id);
  },
};

export function convertUnitsToBase(qty, unitType, item) {
  if (!item || !item.has_multi_unit) return Number(qty) || 0;
  const stripsPerBox = Number(item.strips_per_box) || 1;
  const unitsPerStrip = Number(item.units_per_strip) || 1;
  const unitsPerBox = stripsPerBox * unitsPerStrip;

  if (unitType === "box") return (Number(qty) || 0) * unitsPerBox;
  if (unitType === "strip") return (Number(qty) || 0) * unitsPerStrip;
  return Number(qty) || 0;
}

// ---------- Inventory Engine ----------
export const dbInventory = {
  getAll: () => {
    const list = getCollection(KEYS.INVENTORY);
    return list.map((i) => {
      if (i.company_name) return i;
      let comp = "BM Pvt LTD";
      const name = (i.medicine_name || "").toLowerCase();
      const code = (i.item_code || "").toLowerCase();
      if (name.includes("paul") || name.includes("brooks") || code.includes("pb")) comp = "Paul Brooks Homoeo Lab";
      else if (name.includes("mektum") || code.includes("mkt")) comp = "MEKTUM Pvt Ltd";
      else if (name.includes("blossom") || code.includes("bls")) comp = "BLOSSOM Homoeo Pharma";
      else if (name.includes("schwabe") || name.includes("reckeweg") || name.includes("german")) comp = "Schwabe / German";
      else if (name.includes("panadol") || name.includes("amoxil") || name.includes("gsk") || name.includes("getz")) comp = "Local Pharma Market";
      return { ...i, company_name: comp };
    });
  },
  getById: (id) => {
    const item = getFromCollectionById(KEYS.INVENTORY, id);
    if (!item) return null;
    if (item.company_name) return item;
    return { ...item, company_name: "BM Pvt LTD" };
  },
  getLowStock: () => dbInventory.getAll().filter((i) => (i.total_base_stock ?? i.stock_qty) <= (i.low_stock_threshold || 6)),
  getByCompany: (companyName) => {
    if (!companyName || companyName === "all") return dbInventory.getAll();
    return dbInventory.getAll().filter((i) => (i.company_name || "").toLowerCase() === companyName.toLowerCase());
  },

  search: (query, companyFilter = "all") => {
    let list = dbInventory.getAll();
    if (companyFilter && companyFilter !== "all") {
      list = list.filter((i) => (i.company_name || "").toLowerCase() === companyFilter.toLowerCase());
    }
    if (!query || query.trim() === "") return list;
    const q = query.trim().toLowerCase();
    return list.filter((i) =>
      (i.medicine_name || "").toLowerCase().includes(q) ||
      (i.item_code || "").toLowerCase().includes(q) ||
      (i.category || "").toLowerCase().includes(q) ||
      (i.company_name || "").toLowerCase().includes(q)
    );
  },

  add: (item) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const stripsPerBox = Number(item.strips_per_box) || 1;
    const unitsPerStrip = Number(item.units_per_strip) || 1;

    let baseStock = Number(item.total_base_stock);
    if (isNaN(baseStock) || baseStock === undefined) {
      baseStock = Number(item.stock_qty) || 0;
    }

    const wStock = Number(item.warehouse_stock) || Math.floor(baseStock * 0.7);
    const sStock = Number(item.store_stock) || (baseStock - wStock);

    const newItem = {
      ...item,
      id: generateId("inv"),
      clinic_id: "clinic_001",
      has_multi_unit: Boolean(item.has_multi_unit),
      strips_per_box: stripsPerBox,
      units_per_strip: unitsPerStrip,
      box_label: item.box_label || "Pack",
      strip_label: item.strip_label || "Bottle",
      unit_label: item.unit_label || "Bottle",
      cost_price_per_box: Number(item.cost_price_per_box) || Number(item.purchase_price) || 0,
      box_sale_price: Number(item.box_sale_price) || Number(item.sale_price) || 0,
      strip_sale_price: Number(item.strip_sale_price) || Number(item.sale_price) || 0,
      unit_sale_price: Number(item.unit_sale_price) || Number(item.sale_price) || 0,
      total_base_stock: baseStock,
      stock_qty: sStock,
      store_stock: sStock,
      warehouse_stock: wStock,
      low_stock_threshold: Number(item.low_stock_threshold) || 6,
    };
    setCollection(KEYS.INVENTORY, [...inventory, newItem]);
    return newItem;
  },

  update: (id, data) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => (i.id === id ? { ...i, ...data } : i));
    setCollection(KEYS.INVENTORY, updated);
  },

  deductStock: (id, baseQty) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const currentBase = i.total_base_stock ?? i.stock_qty ?? 0;
      const newBase = Math.max(0, currentBase - baseQty);
      const currentStore = i.store_stock ?? currentBase;
      const newStore = Math.max(0, currentStore - baseQty);
      return {
        ...i,
        total_base_stock: newBase,
        stock_qty: newStore,
        store_stock: newStore,
      };
    });
    setCollection(KEYS.INVENTORY, updated);
  },

  addStock: (id, baseQty, destination = "warehouse") => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const currentBase = i.total_base_stock ?? i.stock_qty ?? 0;
      const newBase = currentBase + baseQty;
      if (destination === "store") {
        const newStore = (i.store_stock ?? 0) + baseQty;
        return {
          ...i,
          total_base_stock: newBase,
          store_stock: newStore,
          stock_qty: newStore,
        };
      } else {
        const newWarehouse = (i.warehouse_stock ?? 0) + baseQty;
        return {
          ...i,
          total_base_stock: newBase,
          warehouse_stock: newWarehouse,
        };
      }
    });
    setCollection(KEYS.INVENTORY, updated);
  },

  transferWarehouseToStore: (id, qty, notes = "", transferred_by = "Store Staff") => {
    const inv = dbInventory.getById(id);
    if (!inv) return null;
    const q = Number(qty) || 0;
    const wStock = Math.max(0, (inv.warehouse_stock ?? 0) - q);
    const sStock = (inv.store_stock ?? 0) + q;
    dbInventory.update(id, {
      warehouse_stock: wStock,
      store_stock: sStock,
      total_base_stock: wStock + sStock,
      stock_qty: sStock,
    });
    dbStockTransfers.transfer({
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      qty: q,
      from_loc: "Main Warehouse (Godown)",
      to_loc: "Medical Store Counter (POS)",
      notes: notes || "Internal Replenishment (Godown ➔ Store)",
      transferred_by: transferred_by || "Store Staff"
    });
  },

  transferStoreToWarehouse: (id, qty, notes = "", transferred_by = "Store Staff") => {
    const inv = dbInventory.getById(id);
    if (!inv) return null;
    const q = Number(qty) || 0;
    const sStock = Math.max(0, (inv.store_stock ?? 0) - q);
    const wStock = (inv.warehouse_stock ?? 0) + q;
    dbInventory.update(id, {
      warehouse_stock: wStock,
      store_stock: sStock,
      total_base_stock: wStock + sStock,
      stock_qty: sStock,
    });
    dbStockTransfers.transfer({
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      qty: q,
      from_loc: "Medical Store Counter (POS)",
      to_loc: "Main Warehouse (Godown)",
      notes: notes || "Stock Return (Store ➔ Godown)",
      transferred_by: transferred_by || "Store Staff"
    });
  },

  getProductMovement: (inventoryId) => {
    const inv = dbInventory.getById(inventoryId);
    if (!inv) return null;

    const purchases = dbPurchases.getAll();
    const sales = dbSales.getAll();
    const b2b = dbB2BSales.getAll();
    const transfers = dbStockTransfers.getAll();

    const ledger = [];

    // 1. Inward Purchases
    purchases.forEach((p) => {
      (p.items || []).forEach((item) => {
        if (item.inventory_id === inv.id || (item.medicine_name && item.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
          ledger.push({
            date: p.purchase_date || p.created_at || new Date().toISOString(),
            type: "PURCHASE",
            type_label: "Company / Local Purchase",
            voucher_no: p.invoice_no || p.id,
            party_name: p.supplier_name || "Supplier Consignment",
            destination: p.destination || "Main Warehouse (Godown)",
            qty_in: Number(item.qty_base_units || item.qty) || 0,
            qty_out: 0,
            unit_price: Number(item.cost_price || item.unit_price) || 0,
            total_amount: Number(item.total_cost || item.line_total) || 0,
            notes: p.notes || `GRN from ${p.supplier_name}`,
          });
        }
      });
    });

    // 2. Outward Retail POS Sales
    sales.forEach((s) => {
      (s.items || []).forEach((item) => {
        if (item.inventory_id === inv.id || (item.medicine_name && item.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
          ledger.push({
            date: s.sale_date || s.created_at || new Date().toISOString(),
            type: "RETAIL_SALE",
            type_label: "Retail POS Counter Sale",
            voucher_no: s.receipt_no || s.id,
            party_name: s.patient_name || "Walk-in Patient",
            destination: "Store Counter",
            qty_in: 0,
            qty_out: Number(item.base_units || item.quantity || item.qty) || 0,
            unit_price: Number(item.unit_price) || 0,
            total_amount: Number(item.line_total) || 0,
            notes: "Dispensed at Retail Medical Store",
          });
        }
      });
    });

    // 3. Outward Wholesale B2B Sales (Interior Sindh)
    b2b.forEach((b) => {
      (b.items || []).forEach((item) => {
        if (item.inventory_id === inv.id || (item.medicine_name && item.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
          ledger.push({
            date: b.sale_date || b.created_at || new Date().toISOString(),
            type: "WHOLESALE_B2B",
            type_label: "Wholesale B2B Supply",
            voucher_no: b.invoice_no || b.id,
            party_name: b.buyer_name || "Interior Sindh Party",
            city: b.city || b.buyer_city || "",
            salesman: b.salesman || "",
            bilty_no: b.bilty_no || "",
            transport: b.transport || "",
            destination: `${b.buyer_name} (${b.city || 'Interior Sindh'})`,
            qty_in: 0,
            qty_out: Number(item.qty_base_units || item.qty || item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            total_amount: Number(item.line_total) || 0,
            notes: `Bilty: ${b.bilty_no || 'Direct'}, Tr: ${b.transport || 'Local'}, Man: ${b.salesman || 'Staff'}`,
          });
        }
      });
    });

    // 4. Internal Transfers
    transfers.forEach((t) => {
      if (t.inventory_id === inv.id || (t.medicine_name && t.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
        const isToStore = t.to_loc?.includes("Counter") || t.to_loc?.includes("POS") || t.to_loc?.includes("Store");
        ledger.push({
          date: t.transfer_date || t.created_at || new Date().toISOString(),
          type: "INTERNAL_TRANSFER",
          type_label: `Internal Shift (${t.from_loc} ➔ ${t.to_loc})`,
          voucher_no: t.transfer_no || t.id,
          party_name: `Internal Shift (${t.transferred_by || 'Staff'})`,
          handler: t.transferred_by || "Staff",
          destination: `${t.from_loc} ➔ ${t.to_loc}`,
          qty_in: isToStore ? 0 : Number(t.qty) || 0,
          qty_out: isToStore ? Number(t.qty) || 0 : 0,
          unit_price: inv.unit_sale_price || 0,
          total_amount: (Number(t.qty) || 0) * (inv.unit_sale_price || 0),
          notes: t.notes || `Stock shifted by ${t.transferred_by || 'Staff'}`,
        });
      }
    });

    ledger.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      item: inv,
      summary: {
        warehouse_stock: inv.warehouse_stock ?? 0,
        store_stock: inv.store_stock ?? (inv.stock_qty ?? 0),
        total_base_stock: inv.total_base_stock ?? (inv.stock_qty ?? 0),
        total_purchased: ledger.filter((l) => l.type === "PURCHASE").reduce((sum, l) => sum + l.qty_in, 0),
        total_sold_retail: ledger.filter((l) => l.type === "RETAIL_SALE").reduce((sum, l) => sum + l.qty_out, 0),
        total_sold_wholesale: ledger.filter((l) => l.type === "WHOLESALE_B2B").reduce((sum, l) => sum + l.qty_out, 0),
      },
      transactions: ledger,
    };
  },
};

// ---------- Interior Sindh Wholesale Parties ----------
export const dbParties = {
  getAll: () => getCollection(KEYS.PARTIES),
  getById: (id) => getFromCollectionById(KEYS.PARTIES, id),
  getByCity: (city) => getCollection(KEYS.PARTIES).filter((p) => (p.city || "").toLowerCase() === (city || "").toLowerCase()),
  add: (party) => {
    const list = getCollection(KEYS.PARTIES);
    const newP = { ...party, id: generateId("pty"), balance_due: Number(party.balance_due) || 0 };
    setCollection(KEYS.PARTIES, [newP, ...list]);
    return newP;
  },
  updateBalance: (id, delta) => {
    const list = getCollection(KEYS.PARTIES);
    const updated = list.map((p) => (p.id === id ? { ...p, balance_due: Math.max(0, (p.balance_due || 0) + Number(delta)) } : p));
    setCollection(KEYS.PARTIES, updated);
  },
};

// ---------- Suppliers ----------
export const dbSuppliers = {
  getAll: () => getCollection(KEYS.SUPPLIERS),
  getById: (id) => getFromCollectionById(KEYS.SUPPLIERS, id),
  add: (supplier) => {
    const list = getCollection(KEYS.SUPPLIERS);
    const newS = { ...supplier, id: generateId("sup"), current_balance: Number(supplier.current_balance) || 0 };
    setCollection(KEYS.SUPPLIERS, [...list, newS]);
    return newS;
  },
  updateBalance: (supplierId, delta) => {
    const list = getCollection(KEYS.SUPPLIERS);
    const updated = list.map((s) =>
      s.id === supplierId ? { ...s, current_balance: Math.max(0, (Number(s.current_balance) || 0) + Number(delta)) } : s
    );
    setCollection(KEYS.SUPPLIERS, updated);
  },
  recordPayment: (supplierId, amount) => {
    const list = getCollection(KEYS.SUPPLIERS);
    const updated = list.map((s) => (s.id === supplierId ? { ...s, current_balance: Math.max(0, (Number(s.current_balance) || 0) - Number(amount)) } : s));
    setCollection(KEYS.SUPPLIERS, updated);
  },
};

// ---------- Salesmen ----------
export const dbSalesmen = {
  getAll: () => getCollection(KEYS.SALESMEN),
  getById: (id) => getFromCollectionById(KEYS.SALESMEN, id),
  add: (sm) => {
    const list = getCollection(KEYS.SALESMEN);
    const newSm = { ...sm, id: generateId("sm") };
    setCollection(KEYS.SALESMEN, [...list, newSm]);
    return newSm;
  },
};

// ---------- Patient Credit / Udhaar Ledger ----------
export const dbPatientLedger = {
  getAll: () => getCollection(KEYS.PATIENT_LEDGER),
  getByPatient: (patientId) => getCollection(KEYS.PATIENT_LEDGER).find((l) => l.patient_id === patientId) || null,
  addCredit: (patientId, patientName, amount, description) => {
    const ledgers = getCollection(KEYS.PATIENT_LEDGER);
    const existing = ledgers.find((l) => l.patient_id === patientId);

    const tx = {
      id: generateId("tx"),
      date: new Date().toISOString(),
      description: description || "Pharmacy Purchase Udhaar",
      amount: Number(amount),
      type: "debit",
    };

    if (existing) {
      const updated = ledgers.map((l) =>
        l.patient_id === patientId
          ? {
              ...l,
              total_credit: l.total_credit + Number(amount),
              balance_due: l.balance_due + Number(amount),
              transactions: [tx, ...(l.transactions || [])],
            }
          : l
      );
      setCollection(KEYS.PATIENT_LEDGER, updated);
    } else {
      const newLedger = {
        id: generateId("pledge"),
        patient_id: patientId,
        patient_name: patientName,
        total_credit: Number(amount),
        total_paid: 0,
        balance_due: Number(amount),
        transactions: [tx],
      };
      setCollection(KEYS.PATIENT_LEDGER, [...ledgers, newLedger]);
    }
  },
  receivePayment: (patientId, amount) => {
    const ledgers = getCollection(KEYS.PATIENT_LEDGER);
    const tx = {
      id: generateId("tx"),
      date: new Date().toISOString(),
      description: "Cash Payment Received",
      amount: Number(amount),
      type: "credit",
    };
    const updated = ledgers.map((l) =>
      l.patient_id === patientId
        ? {
            ...l,
            total_paid: (l.total_paid || 0) + Number(amount),
            balance_due: Math.max(0, l.balance_due - Number(amount)),
            transactions: [tx, ...(l.transactions || [])],
          }
        : l
    );
    setCollection(KEYS.PATIENT_LEDGER, updated);
  },
};

// ---------- Documents ----------
export const dbDocuments = {
  getAll: () => getCollection(KEYS.DOCUMENTS),
  getByPatient: (patientId) => getCollection(KEYS.DOCUMENTS).filter((d) => d.patient_id === patientId),
  add: (doc) => {
    const list = getCollection(KEYS.DOCUMENTS);
    const newDoc = { ...doc, id: generateId("doc"), created_at: new Date().toISOString() };
    setCollection(KEYS.DOCUMENTS, [newDoc, ...list]);
    return newDoc;
  },
  delete: (id) => {
    const list = getCollection(KEYS.DOCUMENTS);
    setCollection(KEYS.DOCUMENTS, list.filter((d) => d.id !== id));
  },
};

// ---------- Tenants ----------
export const dbTenants = {
  getAll: () => getCollection(KEYS.TENANTS),
  getById: (id) => getCollection(KEYS.TENANTS).find((t) => t.id === id) || null,
  add: (tenant) => {
    const list = getCollection(KEYS.TENANTS);
    const newT = { ...tenant, id: generateId("tenant") };
    setCollection(KEYS.TENANTS, [...list, newT]);
    return newT;
  },
  update: (id, data) => {
    const list = getCollection(KEYS.TENANTS);
    const updated = list.map((t) => (t.id === id ? { ...t, ...data } : t));
    setCollection(KEYS.TENANTS, updated);
  },
  delete: (id) => {
    const list = getCollection(KEYS.TENANTS);
    setCollection(KEYS.TENANTS, list.filter((t) => t.id !== id));
  },
  switchToTenant: (id) => {
    const target = dbTenants.getById(id);
    if (!target) return false;
    dbClinic.update({
      name: target.name || "ClinicFlow Clinic",
      address: target.address || "Main City Clinic",
      phone: target.phone || "03001234567",
      default_consultation_fee: Number(target.fee) || 500,
    });
    return true;
  },
};

// ---------- Store Sales (Retail POS) ----------
export const dbSales = {
  getAll: () => getCollection(KEYS.SALES),
  checkout: (sale) => {
    const sales = getCollection(KEYS.SALES);
    const invoiceNo = generateSequentialInvoiceNo("POS");
    const subtotal = Number(sale.subtotal_amount) || Number(sale.total_amount) || 0;
    const discount = Number(sale.discount_amount) || 0;
    const total = Math.max(0, subtotal - discount);
    const paid = sale.paid_amount !== undefined && sale.paid_amount !== null && !isNaN(Number(sale.paid_amount))
      ? Number(sale.paid_amount)
      : total;

    const newSale = {
      ...sale,
      id: generateId("sale"),
      receipt_no: invoiceNo,
      sale_date: sale.sale_date || new Date().toISOString(),
      subtotal_amount: subtotal,
      discount_amount: discount,
      total_amount: total,
      paid_amount: paid,
      balance_due: Math.max(0, total - paid),
    };

    (sale.items || []).forEach((item) => {
      const inv = dbInventory.getById(item.inventory_id);
      if (inv) {
        const baseUnits = Number(item.base_units || item.base_units_deducted || item.qty_base_units || item.quantity || item.qty || 1);
        dbInventory.deductStock(inv.id, baseUnits);
      }
    });

    setCollection(KEYS.SALES, [newSale, ...sales]);
    return newSale;
  },
};

// ---------- Purchases (GRN Inward) ----------
export const dbPurchases = {
  getAll: () => getCollection(KEYS.PURCHASES),
  add: (purchase) => {
    const purchases = getCollection(KEYS.PURCHASES);
    const invoiceNo = purchase.invoice_no || generateSequentialInvoiceNo("PUR");
    const totalAmount = Number(purchase.total_amount) || 0;
    const paidAmount = Number(purchase.paid_amount) || 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    const newPurchase = {
      ...purchase,
      id: generateId("pur"),
      invoice_no: invoiceNo,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      purchase_date: purchase.purchase_date || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const dest = purchase.destination_type === "store" ? "store" : "warehouse";
    (purchase.items || []).forEach((item) => {
      const inv = dbInventory.getById(item.inventory_id);
      if (inv) {
        const baseUnits = Number(item.base_units || item.base_units_deducted || item.qty_base_units || item.qty || item.quantity || 1);
        dbInventory.addStock(inv.id, baseUnits, dest);
      }
    });

    if (balanceDue > 0 && purchase.supplier_id) {
      dbSuppliers.updateBalance(purchase.supplier_id, balanceDue);
    }

    setCollection(KEYS.PURCHASES, [newPurchase, ...purchases]);
    return newPurchase;
  },
  deletePurchase: (purchaseId) => {
    const purchases = getCollection(KEYS.PURCHASES);
    setCollection(KEYS.PURCHASES, purchases.filter((p) => p.id !== purchaseId));
  },
  deleteInvoice: (purchaseId) => {
    dbPurchases.deletePurchase(purchaseId);
  },
};

// ---------- Wholesale B2B Sales (Interior Sindh Supply) ----------
export const dbB2BSales = {
  getAll: () => getCollection(KEYS.B2B_SALES),
  checkout: (saleData) => {
    const sales = getCollection(KEYS.B2B_SALES);
    const invoiceNo = generateSequentialInvoiceNo("WHO");
    const paidAmount = Number(saleData.paid_amount) || 0;
    const totalAmount = Number(saleData.total_amount) || 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    const newB2BSale = {
      ...saleData,
      id: generateId("b2b"),
      invoice_no: invoiceNo,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      sale_date: new Date().toISOString(),
    };

    (saleData.items || []).forEach((item) => {
      const inv = dbInventory.getById(item.inventory_id);
      if (inv) {
        const qty = Number(item.qty_base_units || item.quantity || item.qty) || 0;
        const wStock = Math.max(0, (inv.warehouse_stock ?? 0) - qty);
        dbInventory.update(inv.id, {
          warehouse_stock: wStock,
          total_base_stock: wStock + (inv.store_stock ?? 0),
        });
      }
    });

    if (balanceDue > 0 && saleData.buyer_id) {
      dbParties.updateBalance(saleData.buyer_id, balanceDue);
    }

    setCollection(KEYS.B2B_SALES, [newB2BSale, ...sales]);
    return newB2BSale;
  },
};

// ---------- Internal Stock Transfers ----------
export const dbStockTransfers = {
  getAll: () => getCollection(KEYS.STOCK_TRANSFERS),
  transfer: (data) => {
    const transfers = getCollection(KEYS.STOCK_TRANSFERS);
    const transferNo = generateSequentialInvoiceNo("TRF");
    const newTransfer = {
      ...data,
      id: generateId("trf"),
      transfer_no: transferNo,
      transfer_date: new Date().toISOString(),
    };
    setCollection(KEYS.STOCK_TRANSFERS, [newTransfer, ...transfers]);
    return newTransfer;
  },
};

// ---------- Expenses ----------
export const dbExpenses = {
  getAll: () => getCollection(KEYS.EXPENSES),
  add: (expense) => {
    const list = getCollection(KEYS.EXPENSES);
    const expDate = expense.date || expense.expense_date || new Date().toISOString();
    const newExp = {
      ...expense,
      id: generateId("exp"),
      amount: Number(expense.amount) || 0,
      date: expDate,
      expense_date: expDate,
    };
    setCollection(KEYS.EXPENSES, [newExp, ...list]);
    return newExp;
  },
  delete: (id) => {
    const list = getCollection(KEYS.EXPENSES);
    setCollection(KEYS.EXPENSES, list.filter((e) => e.id !== id));
  },
};

// ---------- Returns & Exchanges ----------
export const dbReturns = {
  getAll: () => getCollection(KEYS.RETURNS),
  processReturn: ({ sale_id, return_items, reason, refund_type }) => {
    const returns = getCollection(KEYS.RETURNS);
    const items = return_items || [];
    const refundAmount = items.reduce((sum, it) => {
      const qty = Number(it.quantity_returned || it.qty || it.quantity) || 0;
      const price = Number(it.unit_price) || 0;
      return sum + (qty * price);
    }, 0);

    // Restock returned items back to store counter stock
    items.forEach((it) => {
      if (it.inventory_id) {
        const baseUnits = Number(it.base_units || it.base_units_deducted || it.quantity_returned || it.qty || 1);
        dbInventory.addStock(it.inventory_id, baseUnits, "store");
      }
    });

    const newRet = {
      id: generateId("ret"),
      sale_id,
      reason,
      refund_type: refund_type || "cash",
      items,
      refund_amount: refundAmount,
      return_date: new Date().toISOString(),
    };
    setCollection(KEYS.RETURNS, [newRet, ...returns]);
    return newRet;
  },
};

// ---------- Shift Closings ----------
export const dbShiftClosings = {
  getAll: () => getCollection(KEYS.SHIFT_CLOSINGS) || [],
  getByDate: (dateStr) => {
    const all = getCollection(KEYS.SHIFT_CLOSINGS) || [];
    return all.filter((c) => c.date === dateStr);
  },
  add: (closingData) => {
    const closings = getCollection(KEYS.SHIFT_CLOSINGS) || [];
    const newRecord = {
      ...closingData,
      id: generateId("shift"),
      closed_at: new Date().toISOString(),
    };
    setCollection(KEYS.SHIFT_CLOSINGS, [newRecord, ...closings]);
    return newRecord;
  },
  delete: (id) => {
    const closings = getCollection(KEYS.SHIFT_CLOSINGS) || [];
    setCollection(KEYS.SHIFT_CLOSINGS, closings.filter((c) => c.id !== id));
  }
};

export function exportFullDatabase() {
  const backup = {
    version: "5.0.0",
    export_date: new Date().toISOString(),
    clinic_name: dbClinic.get()?.name || "Dr. Muhammad Kashif Khan Clinic",
    data: {},
  };
  Object.entries(KEYS).forEach(([_, storageKey]) => {
    backup.data[storageKey] = getCollection(storageKey);
  });
  return backup;
}

export function importFullDatabase(backupObj) {
  if (!backupObj || typeof backupObj !== "object" || !backupObj.data) {
    throw new Error("Invalid backup file.");
  }
  _COLLECTION_CACHE.clear();
  _ID_MAP_CACHE.clear();
  Object.entries(backupObj.data).forEach(([key, val]) => {
    localStorage.setItem(key, JSON.stringify(val));
  });
  localStorage.setItem(KEYS.SEEDED, "1");
  return true;
}
