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
const narations = new Map();
const names = [];

for (let i = 1; i < rawLines.length; i++) {
    const cols = splitCsvLine(rawLines[i]);
    const name = cols[1].replace(/^"|"$/g, '').trim();
    const nar = cols[3].replace(/^"|"$/g, '').trim();
    narations.set(nar, (narations.get(nar) || 0) + 1);
    names.push(name);
}

console.log('Unique Narations in Access:');
for (const [k, v] of narations.entries()) {
    console.log(`  [${k}]: ${v}`);
}

console.log('\nSample Medicine Names:');
console.log(names.slice(0, 40));
