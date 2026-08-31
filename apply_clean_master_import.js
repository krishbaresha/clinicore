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

// 1. Parse VERIFIED_MEDICINES_CATALOG.csv
const medCsvLines = fs.readFileSync('VERIFIED_MEDICINES_CATALOG.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const cleanInventory = [];

for (let i = 1; i < medCsvLines.length; i++) {
    const cols = splitCsvLine(medCsvLines[i]);
    const name = cols[0].replace(/^"|"$/g, '').trim();
    const company = cols[1].replace(/^"|"$/g, '').trim();
    const code = cols[2].replace(/^"|"$/g, '').trim();
    const cost = parseFloat(cols[3]) || 0;
    const sale = parseFloat(cols[4]) || 0;
    const storeStock = parseInt(cols[5]) || 0;
    const whStock = parseInt(cols[6]) || 0;
    const category = cols[7].replace(/^"|"$/g, '').trim();
    const minAlert = parseInt(cols[8]) || 6;

    cleanInventory.push({
        id: `med_${String(i).padStart(4, '0')}`,
        medicine_name: name,
        company_name: company,
        item_code: code,
        generic_name: category,
        category: category,
        strength: name.includes('120Ml') ? '120ml' : name.includes('240Ml') ? '240ml' : name.includes('20Ml') ? '20ml' : '',
        has_multi_unit: name.toLowerCase().includes('tab') || name.toLowerCase().includes('capsule'),
        strips_per_box: 10,
        units_per_strip: 10,
        box_label: "Box",
        strip_label: "Strip",
        unit_label: "Tablet",
        cost_price_per_box: cost,
        box_sale_price: sale,
        strip_sale_price: sale,
        unit_sale_price: sale,
        unit_price: sale,
        total_base_stock: 0,
        stock_qty: 0,
        store_stock: 0,
        warehouse_stock: 0,
        location_stocks: { wh_001: 0, wh_str: 0 },
        low_stock_threshold: minAlert,
        expiry_date: "2028-12-31",
        is_active: true,
        batches: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

// 2. Parse VERIFY_PARTIES_PREVIEW.csv
const partyCsvLines = fs.readFileSync('VERIFY_PARTIES_PREVIEW.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const cleanParties = [];

for (let i = 1; i < partyCsvLines.length; i++) {
    const cols = splitCsvLine(partyCsvLines[i]);
    const code = cols[0].replace(/^"|"$/g, '').trim();
    const name = cols[1].replace(/^"|"$/g, '').trim();
    const type = cols[2].replace(/^"|"$/g, '').trim();
    const city = cols[3].replace(/^"|"$/g, '').trim();
    const phone = cols[4].replace(/^"|"$/g, '').trim();
    const salesman = cols[5].replace(/^"|"$/g, '').trim();

    cleanParties.push({
        id: `pty_${code || String(i).padStart(3, '0')}`,
        party_code: code,
        party_name: name,
        name: name,
        account_type: type || 'Customer',
        city: city || '',
        phone: phone || '',
        salesman: salesman || '',
        balance_due: 0,
        opening_balance: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

// 3. Write directly to Tauri Data Directory
const appData = process.env.APPDATA;
const tauriDataDir = path.join(appData, 'ClinicFlow', 'data');

if (fs.existsSync(tauriDataDir)) {
    fs.writeFileSync(path.join(tauriDataDir, 'cf_inventory_v5.json'), JSON.stringify(cleanInventory, null, 2), 'utf8');
    fs.writeFileSync(path.join(tauriDataDir, 'cf_parties_v5.json'), JSON.stringify(cleanParties, null, 2), 'utf8');
    console.log(`✅ Successfully injected into Desktop App (%APPDATA%/ClinicFlow/data):`);
    console.log(`   - cf_inventory_v5.json: ${cleanInventory.length} medicines`);
    console.log(`   - cf_parties_v5.json: ${cleanParties.length} parties`);
}

// Also save to frontend seeds
fs.writeFileSync('frontend/src/api/master_medicines_seed.json', JSON.stringify(cleanInventory, null, 2), 'utf8');
fs.writeFileSync('frontend/src/api/master_parties_seed.json', JSON.stringify(cleanParties, null, 2), 'utf8');
console.log('✅ Updated master seed JSON files in frontend/src/api/');
