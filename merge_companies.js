const fs = require('fs');
const path = require('path');

// Master Canonical Normalizer for Companies & Brands
function normalizeCompanyName(raw) {
    if (!raw) return { name: "BM Pvt LTD", code: "BM" };
    
    // Clean string
    let clean = String(raw).trim().replace(/\\|\/|_/g, ' ').replace(/\s+/g, ' ');
    const lower = clean.toLowerCase();

    // 1. BM Pvt LTD (BM, bm, Bm, BM\, BMa, etc.)
    if (lower === 'bm' || lower === 'bm pharma' || lower === 'bm pvt ltd' || lower.startsWith('bm ') || lower === 'bma pharma' || lower === 'bm\\ pharma') {
        return { name: "BM Pvt LTD", code: "BM" };
    }

    // 2. Dr. Willmar Schwabe Germany (shwabe, Shwabe, shwbe, schwabe, etc.)
    if (lower.includes('shwabe') || lower.includes('shwbe') || lower.includes('schwabe') || lower.includes('willmar')) {
        return { name: "Dr. Willmar Schwabe Germany", code: "SCH" };
    }

    // 3. ZAM ZAM Homoeo Pharma (ZAM ZAM, zamzam, zam zam, etc.)
    if (lower.includes('zamzam') || lower.includes('zam zam') || lower.includes('zam')) {
        return { name: "ZAM ZAM Homoeo Pharma", code: "ZAM" };
    }

    // 4. Masood Homoeopathic Pharma (MASOD, masod, masood, etc.)
    if (lower.includes('masod') || lower.includes('masood')) {
        return { name: "Masood Homoeopathic Pharma", code: "MASOD" };
    }

    // 5. Kent Homoeopathic Pharmacy (Kent, kent, KENT, etc.)
    if (lower.includes('kent')) {
        return { name: "Kent Homoeopathic Pharmacy", code: "KENT" };
    }

    // 6. Paul Brooks Homoeo Lab (PBHL, pbhl, paul brooks, pb, etc.)
    if (lower.includes('pbhl') || lower.includes('paul brooks') || lower === 'pb' || lower === 'pb pharma') {
        return { name: "Paul Brooks Homoeo Lab", code: "PB" };
    }

    // 7. MEKTUM Homeo Pharma (MEK, mek, mektum, etc.)
    if (lower.includes('mek') || lower.includes('mektum')) {
        return { name: "MEKTUM Homeo Pharma", code: "MKT" };
    }

    // 8. BLOSSOM Homeo Labs (BL, Bl, bl, blossom, etc.)
    if (lower === 'bl' || lower === 'bl pharma' || lower.includes('blossom')) {
        return { name: "BLOSSOM Homeo Labs", code: "BLS" };
    }

    // 9. Kamal Laboratories (KAMAL, kamal, Kamal, etc.)
    if (lower.includes('kamal')) {
        return { name: "Kamal Laboratories", code: "KAM" };
    }

    // 10. Ashraf Laboratories (AK, ak, ashraf, etc.)
    if (lower === 'ak' || lower === 'ak pharma' || lower.includes('ashraf')) {
        return { name: "Ashraf Laboratories", code: "ASH" };
    }

    // 11. HFP Pvt Ltd (HFP, hfp, etc.)
    if (lower.includes('hfp')) {
        return { name: "HFP Pvt Ltd", code: "HFP" };
    }

    // 12. B.H.P Laboratory (BHP, bhp, etc.)
    if (lower.includes('bhp') || lower.includes('b.h.p') || lower.includes('laboratory (pvt) ltd')) {
        return { name: "B.H.P Laboratory (PVT) LTD", code: "BHP" };
    }

    // 13. T.S. Laboratories (T.S, ts, TS, etc.)
    if (lower === 't.s' || lower === 'ts' || lower === 'ts pharma' || lower === 't.s. laboratories') {
        return { name: "T.S. Laboratories", code: "TS" };
    }

    // 14. Dr. Reckeweg Germany (RECK, reck, reckeweg, etc.)
    if (lower.includes('reck')) {
        return { name: "Dr. Reckeweg Germany", code: "REC" };
    }

    // 15. Public Pharma (Public Pharma, Public Pharma (faisalabad), etc.)
    if (lower.includes('public pharma')) {
        return { name: "Public Pharma", code: "PUB" };
    }

    // 16. Qarshi Pharma (qarshi, Qarshi, etc.)
    if (lower.includes('qarshi')) {
        return { name: "Qarshi Laboratories", code: "QAR" };
    }

    // 17. Farhan Homoeo (farhan, Farhan, etc.)
    if (lower.includes('farhan')) {
        return { name: "Farhan Homoeo", code: "FAR" };
    }

    // 18. GHR Homoeo Pharma (GHR, ghr, etc.)
    if (lower.includes('ghr')) {
        return { name: "GHR Homoeo Pharma", code: "GHR" };
    }

    // 19. W.S. Laboratories (WShah, ws, etc.)
    if (lower.includes('wshah') || lower === 'ws' || lower.includes('w.s.')) {
        return { name: "W.S. Laboratories", code: "WS" };
    }

    // 20. Eagle Homoeo (Eagle, egl, etc.)
    if (lower.includes('eagle') || lower === 'egl') {
        return { name: "Eagle Homoeo", code: "EGL" };
    }

    // 21. Clinic Internal Preparation
    if (lower.includes('clinic')) {
        return { name: "Clinic Internal Preparation", code: "CLN" };
    }

    // 22. Generic fallback for codes with "0", "00", "1231", "model"
    if (lower === '0' || lower === '00' || lower === '0 pharma' || lower === '00 pharma' || lower === '1231 pharma' || lower === 'model pharma') {
        return { name: "Local Pharma Market / OTC", code: "LPM" };
    }

    // Clean title case name
    const titleCase = clean.replace(/ pharma$/i, '').replace(/\b\w/g, l => l.toUpperCase()) + " Pharma";
    return { name: titleCase, code: clean.substring(0, 3).toUpperCase() };
}

// 1. Process and Merge Inventory
const appData = process.env.APPDATA;
const tauriDataDir = path.join(appData, 'ClinicFlow', 'data');
const invFile = path.join(tauriDataDir, 'cf_inventory_v5.json');

const inventory = JSON.parse(fs.readFileSync(invFile, 'utf8'));
const mergedCompMap = new Map();

const updatedInventory = inventory.map(item => {
    const rawComp = item.company_name;
    const { name: canonicalName, code: canonicalCode } = normalizeCompanyName(rawComp);
    mergedCompMap.set(canonicalName, (mergedCompMap.get(canonicalName) || 0) + 1);

    return {
        ...item,
        company_name: canonicalName,
        item_code: canonicalCode,
        updated_at: new Date().toISOString()
    };
});

fs.writeFileSync(invFile, JSON.stringify(updatedInventory, null, 2), 'utf8');
fs.writeFileSync('frontend/src/api/master_medicines_seed.json', JSON.stringify(updatedInventory, null, 2), 'utf8');

console.log(`✅ Successfully merged and normalized all ${updatedInventory.length} medicines!`);
console.log(`Clean Canonical Companies (${mergedCompMap.size}):`);
for (const [k, v] of Array.from(mergedCompMap.entries()).sort((a,b) => b[1] - a[1])) {
    console.log(`  - ${k}: ${v} items`);
}

// 2. Also regenerate clean distinct Suppliers collection
const supplierList = [];
let supIdx = 1;
for (const [name, count] of mergedCompMap.entries()) {
    const { code } = normalizeCompanyName(name);
    supplierList.push({
        id: `sup_${String(supIdx).padStart(3, '0')}`,
        supplier_code: code || `SUP-${String(supIdx).padStart(3, '0')}`,
        code: code,
        name: name,
        company_name: name,
        phone: "",
        city: "Pakistan",
        contact_person: "Representative",
        address: `${name} Distribution Network`,
        balance_due: 0,
        opening_balance: 0,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
    supIdx++;
}

fs.writeFileSync(path.join(tauriDataDir, 'cf_suppliers_v5.json'), JSON.stringify(supplierList, null, 2), 'utf8');
fs.writeFileSync('frontend/src/api/master_suppliers_seed.json', JSON.stringify(supplierList, null, 2), 'utf8');
console.log(`\n✅ Updated cf_suppliers_v5.json and master_suppliers_seed.json with ${supplierList.length} clean companies!`);
