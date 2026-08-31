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

const accLines = fs.readFileSync('Accounts_export.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const types = new Map();
const sampleRows = [];

for (let i = 1; i < accLines.length; i++) {
    const cols = splitCsvLine(accLines[i]);
    const id = cols[0].replace(/^"|"$/g, '').trim();
    const name = cols[1].replace(/^"|"$/g, '').trim();
    const no = cols[2].replace(/^"|"$/g, '').trim();
    const nar = cols[3].replace(/^"|"$/g, '').trim();
    const type = cols[4].replace(/^"|"$/g, '').trim();
    
    types.set(type, (types.get(type) || 0) + 1);
    sampleRows.push({ id, name, no, nar, type });
}

console.log('Account Types in Access database:');
for (const [k, v] of types.entries()) {
    console.log(`  [${k}]: ${v}`);
}

console.log('\nSample rows:');
console.log(sampleRows.slice(30, 60));
