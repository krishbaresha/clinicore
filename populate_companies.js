const fs = require('fs');
const path = require('path');

function splitCsvLine(line) {
    const res = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            res.push(current.trim());
            current = '';
        } else {
            current += c;
        }
    }
    res.push(current.trim());
    return res;
}

// 1. Read Accounts_export.csv to extract all genuine Supplier companies
const accLines = fs.readFileSync('Accounts_export.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const suppliersList = [];
const seenSuppliers = new Set();

// Master list of known homoeopathic pharma companies
const MASTER_COMPANIES = [
    { name: "BM Pvt LTD", code: "BM", phone: "0300-1234567", city: "Lahore", contact: "Taj ud din" },
    { name: "Paul Brooks Homoeo Lab", code: "PB", phone: "0300-7654321", city: "Karachi", contact: "Sales Dept" },
    { name: "MEKTUM Homeo Pharma", code: "MKT", phone: "0321-9876543", city: "Lahore", contact: "Muhammad Danish" },
    { name: "BLOSSOM Homeo Labs", code: "BLS", phone: "0333-5554433", city: "Lahore", contact: "Blossom Sales" },
    { name: "Dr. Willmar Schwabe Germany", code: "SCH", phone: "0300-8889900", city: "Germany / Karachi", contact: "Import Division" },
    { name: "Dr. Reckeweg Germany", code: "REC", phone: "0300-1112233", city: "Germany / Lahore", contact: "Import Division" },
    { name: "GHR Homoeo Pharma", code: "GHR", phone: "0300-4445566", city: "Hyderabad", contact: "GHR Rep" },
    { name: "HFP Pvt Ltd", code: "HFP", phone: "0300-3332211", city: "Lahore", contact: "HFP Rep" },
    { name: "Masood Homoeopathic Pharma", code: "MASOD", phone: "0300-7776655", city: "Lahore", contact: "Masood Rep" },
    { name: "Kent Homoeopathic Pharmacy", code: "KENT", phone: "0300-9998877", city: "Karachi", contact: "Kent Rep" },
    { name: "Kamal Laboratories", code: "KAM", phone: "0300-6665544", city: "Faisalabad", contact: "Kamal Rep" },
    { name: "Ashraf Laboratories", code: "ASH", phone: "0300-5556677", city: "Faisalabad", contact: "Ashraf Rep" },
    { name: "W.S. Laboratories", code: "WS", phone: "0300-4443322", city: "Rawalpindi", contact: "WS Rep" },
    { name: "B.H.P Laboratory (PVT) LTD", code: "BHP", phone: "0300-2221100", city: "Karachi", contact: "BHP Rep" },
    { name: "Eagle Homoeo", code: "EGL", phone: "0300-8887766", city: "Lahore", contact: "Eagle Rep" },
    { name: "ZAM ZAM Homoeo Pharma", code: "ZAM", phone: "0300-3334455", city: "Multan", contact: "Zam Zam Rep" },
    { name: "T.S. Laboratories", code: "TS", phone: "0300-5551122", city: "Karachi", contact: "TS Rep" },
    { name: "Public Pharma", code: "PUB", phone: "0300-7771122", city: "Faisalabad", contact: "Public Rep" },
    { name: "Lehning Laboratories", code: "LEH", phone: "0300-9991122", city: "France / Karachi", contact: "Lehning Rep" },
    { name: "Farhan Homoeo", code: "FAR", phone: "0300-2223344", city: "Hyderabad", contact: "Farhan Rep" },
    { name: "Clinic Internal Preparation", code: "CLN", phone: "0347-3100304", city: "Hyderabad", contact: "Dr. Asif" }
];

MASTER_COMPANIES.forEach((c, idx) => {
    seenSuppliers.add(c.name.toLowerCase().trim());
    suppliersList.push({
        id: `sup_${String(idx + 1).padStart(3, '0')}`,
        supplier_code: c.code || `SUP-${String(idx + 1).padStart(3, '0')}`,
        code: c.code,
        name: c.name,
        company_name: c.name,
        phone: c.phone || "",
        city: c.city || "Pakistan",
        contact_person: c.contact || "Representative",
        address: `${c.city}, Pakistan`,
        balance_due: 0,
        opening_balance: 0,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
});

// Also add any suppliers from Accounts table
for (let i = 1; i < accLines.length; i++) {
    const cols = splitCsvLine(accLines[i]);
    const id = cols[0].replace(/^"|"$/g, '').trim();
    const name = cols[1].replace(/^"|"$/g, '').trim();
    const no = cols[2].replace(/^"|"$/g, '').trim();
    const type = cols[4].replace(/^"|"$/g, '').trim();

    if (type.toLowerCase() === 'supplier' && name) {
        const key = name.toLowerCase().trim();
        if (!seenSuppliers.has(key)) {
            seenSuppliers.add(key);
            const idx = suppliersList.length + 1;
            suppliersList.push({
                id: `sup_${String(idx).padStart(3, '0')}`,
                supplier_code: `SUP-${String(no || idx).padStart(3, '0')}`,
                code: `SUP-${String(no || idx).padStart(3, '0')}`,
                name: name,
                company_name: name,
                phone: "",
                city: "Pakistan",
                contact_person: "Representative",
                address: "",
                balance_due: 0,
                opening_balance: 0,
                status: "active",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
    }
}

// Write to Tauri AppData directory
const appData = process.env.APPDATA;
const tauriDataDir = path.join(appData, 'ClinicFlow', 'data');
if (fs.existsSync(tauriDataDir)) {
    fs.writeFileSync(path.join(tauriDataDir, 'cf_suppliers_v5.json'), JSON.stringify(suppliersList, null, 2), 'utf8');
    console.log(`✅ Successfully wrote ${suppliersList.length} Companies to cf_suppliers_v5.json in AppData!`);
}

// Write to frontend seed
fs.writeFileSync('frontend/src/api/master_suppliers_seed.json', JSON.stringify(suppliersList, null, 2), 'utf8');
console.log(`✅ Saved master_suppliers_seed.json (${suppliersList.length} companies)`);
