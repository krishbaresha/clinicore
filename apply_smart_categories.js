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

const BRAND_NAME_MAP = {
    "GHR": "GHR Homoeo Pharma",
    "BM": "BM Pvt LTD",
    "MEK": "MEKTUM Homeo Pharma",
    "HFP": "HFP Pvt Ltd",
    "BL": "BLOSSOM Homeo Labs",
    "Bl": "BLOSSOM Homeo Labs",
    "PBHL": "Paul Brooks Homoeo Lab",
    "Clinic": "Clinic Internal Preparation",
    "AK": "Ashraf Laboratories",
    "WShah": "W.S. Laboratories",
    "MASOD": "Masood Homoeopathic Pharma",
    "RECK": "Dr. Reckeweg Germany",
    "KAMAL": "Kamal Laboratories",
    "Shwabe": "Dr. Willmar Schwabe Germany",
    "Eagle": "Eagle Homoeo",
    "ZAM ZAM": "ZAM ZAM Homoeo Pharma",
    "BHP": "B.H.P Laboratory (PVT) LTD",
    "Kent": "Kent Homoeopathic Pharmacy",
    "NP": "NP Laboratories",
    "T.S": "T.S. Laboratories",
    "Public Pharma": "Public Pharma",
    "Lehning": "Lehning Laboratories",
    "Farhan": "Farhan Homoeo",
    "JR": "JR Laboratories",
    "GR": "GR Laboratories"
};

function detectCategoryAndForm(name, naration) {
    const lower = (name + ' ' + (naration || '')).toLowerCase();
    
    // 1. Syrups & Suspensions
    if (lower.includes('syp') || lower.includes('syrup') || lower.includes('susp') || lower.includes('cordial') || lower.includes('tonic') || lower.includes('elixir')) {
        return { category: "Syrup", form: "Syrup / Suspension", multiUnit: false };
    }
    // 2. Tablets
    if (lower.includes('tab') || lower.includes('tablet') || lower.includes('tablets') || lower.includes('pills') || lower.includes('globules')) {
        return { category: "Tablet", form: "Tablet (Solid)", multiUnit: true };
    }
    // 3. Capsules
    if (lower.includes('cap') || lower.includes('capsule') || lower.includes('capsules') || lower.includes('softgel')) {
        return { category: "Capsule", form: "Capsule (Hard/Softgel)", multiUnit: true };
    }
    // 4. Ointments / Creams / Gels
    if (lower.includes('cream') || lower.includes('ointment') || lower.includes('gel') || lower.includes('pomade') || lower.includes('lotion') || lower.includes('soap') || lower.includes('shampoo')) {
        return { category: "Cream / Ointment", form: "Cream / Ointment / Gel", multiUnit: false };
    }
    // 5. Mother Tinctures (Q / MTQ / MT / Tincture)
    if (lower.includes('mtq') || lower.includes('mother tincture') || lower.includes(' q ') || lower.endsWith(' q') || lower.includes('mt ') || lower.endsWith(' mt')) {
        return { category: "Mother Tincture (Q)", form: "Mother Tincture (Liquid Q)", multiUnit: false };
    }
    // 6. Dilutions / Potencies (30C, 200C, 1M, 10M, CM, LM)
    if (lower.includes('30c') || lower.includes('200c') || lower.includes(' 30 ') || lower.endsWith(' 30') || lower.includes(' 200 ') || lower.endsWith(' 200') || lower.includes(' 1m') || lower.includes(' 10m') || lower.includes(' cm') || lower.includes(' lm') || lower.includes('dilution')) {
        return { category: "Dilution", form: "Homeopathic Dilution / Potency", multiUnit: false };
    }
    // 7. Biochemic / Tissue Salts (3X, 6X, 12X, 30X, 200X)
    if (lower.includes('3x') || lower.includes('6x') || lower.includes('12x') || lower.includes('30x') || lower.includes('200x') || lower.includes('biochemic') || lower.includes('bio-plasgen') || lower.includes('bioplasgen') || lower.includes('tissue salt')) {
        return { category: "Biochemic / Tissue Salt", form: "Biochemic / Tissue Salts (6X/12X)", multiUnit: true };
    }
    // 8. Drops (20ml, 30ml, Drops, Complex)
    if (lower.includes('drop') || lower.includes('drops') || lower.includes('20ml') || lower.includes('30ml') || lower.includes('ghr') || lower.includes('bm-') || lower.includes('pb-') || lower.includes('r-') || lower.includes('mkt-')) {
        return { category: "Drops", form: "Homeopathic Drops", multiUnit: false };
    }
    // 9. Injections
    if (lower.includes('inj') || lower.includes('injection') || lower.includes('ampoule') || lower.includes('vial') || lower.includes('infusion') || lower.includes('drip')) {
        return { category: "Injection", form: "Injection / IV Drip", multiUnit: false };
    }
    // 10. Eye / Ear Drops
    if (lower.includes('eye') || lower.includes('ear') || lower.includes('cineraria') || lower.includes('euphrasia')) {
        return { category: "Eye / Ear Drops", form: "Eye / Ear Drops", multiUnit: false };
    }
    
    return { category: "Homeopathic Medicine", form: "Homeopathic Formulation", multiUnit: false };
}

const rawLines = fs.readFileSync('Inventory_export.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const cleanInventory = [];

for (let i = 1; i < rawLines.length; i++) {
    const cols = splitCsvLine(rawLines[i]);
    const id = cols[0].replace(/^"|"$/g, '').trim();
    const name = cols[1].replace(/^"|"$/g, '').trim();
    const brandCode = cols[2].replace(/^"|"$/g, '').trim();
    const naration = cols[3].replace(/^"|"$/g, '').trim();
    const minLevel = parseInt(cols[4]) || 6;

    const resolvedCompany = BRAND_NAME_MAP[brandCode] || (brandCode ? `${brandCode} Pharma` : "BM Pvt LTD");
    const { category, form, multiUnit } = detectCategoryAndForm(name, naration);

    cleanInventory.push({
        id: `med_${String(i).padStart(4, '0')}`,
        medicine_name: name,
        company_name: resolvedCompany,
        item_code: brandCode || "GEN",
        generic_name: form,
        category: category,
        strength: name.includes('120Ml') ? '120ml' : name.includes('240Ml') ? '240ml' : name.includes('20Ml') ? '20ml' : name.includes('30Ml') ? '30ml' : '',
        has_multi_unit: multiUnit,
        strips_per_box: multiUnit ? 10 : 1,
        units_per_strip: multiUnit ? 10 : 1,
        box_label: multiUnit ? "Box" : "Pack",
        strip_label: multiUnit ? "Strip" : "Bottle",
        unit_label: multiUnit ? "Tablet" : "Bottle",
        cost_price_per_box: 0,
        box_sale_price: 0,
        strip_sale_price: 0,
        unit_sale_price: 0,
        unit_price: 0,
        total_base_stock: 0,
        stock_qty: 0,
        store_stock: 0,
        warehouse_stock: 0,
        location_stocks: { wh_001: 0, wh_str: 0 },
        low_stock_threshold: minLevel,
        expiry_date: "2028-12-31",
        is_active: true,
        batches: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

// Write to Tauri AppData directory
const appData = process.env.APPDATA;
const tauriDataDir = path.join(appData, 'ClinicFlow', 'data');
if (fs.existsSync(tauriDataDir)) {
    fs.writeFileSync(path.join(tauriDataDir, 'cf_inventory_v5.json'), JSON.stringify(cleanInventory, null, 2), 'utf8');
    console.log(`✅ Successfully updated cf_inventory_v5.json with categorized medicines (${cleanInventory.length} items)!`);
}

// Update seed
fs.writeFileSync('frontend/src/api/master_medicines_seed.json', JSON.stringify(cleanInventory, null, 2), 'utf8');
console.log(`✅ Updated frontend/src/api/master_medicines_seed.json!`);
