const fs = require('fs');
const path = require('path');

// 1. Read the newly extracted master price list
const masterCsv = fs.readFileSync('Software_Docs_PriceLists_Master.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const extractedItems = [];

function parseCsvLine(line) {
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

for (let i = 1; i < masterCsv.length; i++) {
    const cols = parseCsvLine(masterCsv[i]);
    if (cols.length >= 6) {
        extractedItems.push({
            code: cols[0].replace(/^"|"$/g, '').trim(),
            name: cols[1].replace(/^"|"$/g, '').trim(),
            company: cols[2].replace(/^"|"$/g, '').trim(),
            category: cols[3].replace(/^"|"$/g, '').trim(),
            packing: cols[4].replace(/^"|"$/g, '').trim(),
            retailPrice: Number(cols[5].replace(/^"|"$/g, '').trim()) || 0,
        });
    }
}

console.log(`Loaded ${extractedItems.length} extracted items from Software Docs Price Lists.`);

// 2. Load Active Inventory from Tauri Data Directory
const appData = process.env.APPDATA;
const tauriDataDir = path.join(appData, 'ClinicFlow', 'data');
const invFile = path.join(tauriDataDir, 'cf_inventory_v5.json');

const inventory = JSON.parse(fs.readFileSync(invFile, 'utf8'));

// Normalizer to compare medicine names smartly
function simplify(str) {
    return str.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/tab|tabs|tablets|syrup|drops|ointment|cream|capsules|cap|drops|inj|ampoules/g, '');
}

let replacedCount = 0;
let addedNewCount = 0;
const matchedExtracted = new Set();

const updatedInventory = inventory.map(item => {
    const itemSimp = simplify(item.medicine_name);
    const itemComp = (item.company_name || "").toLowerCase();

    // Find match in extracted items
    const match = extractedItems.find(ext => {
        const extSimp = simplify(ext.name);
        const extComp = ext.company.toLowerCase();
        
        // Same company family (e.g. lehning, reckeweg, kent, hfp, ghr)
        const compMatch = (
            (itemComp.includes('lehning') && extComp.includes('lehning')) ||
            (itemComp.includes('reckeweg') && extComp.includes('reckeweg')) ||
            (itemComp.includes('kent') && extComp.includes('kent')) ||
            (itemComp.includes('hfp') && extComp.includes('hfp')) ||
            (itemComp.includes('ghr') && extComp.includes('ghr'))
        );

        if (!compMatch) return false;

        // Exact simplified match or one contains the other
        return itemSimp === extSimp || (itemSimp.length > 3 && extSimp.includes(itemSimp)) || (extSimp.length > 3 && itemSimp.includes(extSimp));
    });

    if (match) {
        replacedCount++;
        matchedExtracted.add(match.name);
        return {
            ...item,
            medicine_name: match.name,
            item_code: match.code,
            company_name: match.company,
            category: match.category,
            dosage_form: match.category,
            dosage_type: match.category,
            packing: match.packing,
            retail_price: match.retailPrice,
            sale_price: match.retailPrice,
            unit_price: match.retailPrice,
            mrp: match.retailPrice,
            cost_price: 0,
            stock_qty: 0,
            total_base_stock: 0,
            updated_at: new Date().toISOString()
        };
    }

    return item;
});

// For extracted items that were not found in old inventory, add them as new official entries
extractedItems.forEach((ext, idx) => {
    if (!matchedExtracted.has(ext.name)) {
        addedNewCount++;
        updatedInventory.push({
            id: `inv_ext_${Date.now()}_${idx}`,
            item_code: ext.code,
            barcode: ext.code,
            medicine_name: ext.name,
            generic_name: ext.name,
            company_name: ext.company,
            category: ext.category,
            dosage_form: ext.category,
            dosage_type: ext.category,
            packing: ext.packing,
            retail_price: ext.retailPrice,
            sale_price: ext.retailPrice,
            unit_price: ext.retailPrice,
            mrp: ext.retailPrice,
            cost_price: 0,
            stock_qty: 0,
            total_base_stock: 0,
            min_stock_alert: 5,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
});

// 3. Save to live storage & seed
fs.writeFileSync(invFile, JSON.stringify(updatedInventory, null, 2), 'utf8');
fs.writeFileSync('frontend/src/api/master_medicines_seed.json', JSON.stringify(updatedInventory, null, 2), 'utf8');

console.log(`\n🎉 INVENTORY REPLACEMENT COMPLETE:`);
console.log(`- Matched & Replaced with Official Names & Prices: ${replacedCount} items`);
console.log(`- Added New Verified Photo List Products: ${addedNewCount} items`);
console.log(`- Total Live Catalogue: ${updatedInventory.length} items (All Stock = 0, Cost = 0)`);
