const fs = require('fs');

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

const rawLines = fs.readFileSync('Inventory_export.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const brandCodes = new Map();
const items = [];

for (let i = 1; i < rawLines.length; i++) {
    const cols = splitCsvLine(rawLines[i]);
    const id = cols[0].replace(/^"|"$/g, '');
    const name = cols[1].replace(/^"|"$/g, '');
    const brandCode = cols[2].replace(/^"|"$/g, '');
    const naration = cols[3].replace(/^"|"$/g, '');
    const minLevel = cols[4].replace(/^"|"$/g, '');
    const salePrice = cols[5].replace(/^"|"$/g, '');
    const purchasePrice = cols[6].replace(/^"|"$/g, '');
    
    brandCodes.set(brandCode, (brandCodes.get(brandCode) || 0) + 1);
    items.push({ id, name, brandCode, naration, minLevel, salePrice, purchasePrice });
}

console.log('Total items in raw inventory:', items.length);
console.log('All unique Brand Codes with counts:');
for (const [k, v] of brandCodes.entries()) {
    console.log(`  [${k}]: ${v} items`);
}

console.log('\nSample items:');
items.slice(0, 15).forEach(it => console.log(it));
