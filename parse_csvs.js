const fs = require('fs');

function parseSimpleCsv(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    
    // Header parsing
    const headers = splitCsvLine(lines[0]);
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = splitCsvLine(lines[i]);
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = values[idx] !== undefined ? values[idx] : '';
        });
        results.push(obj);
    }
    return { headers, results };
}

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

const accounts = parseSimpleCsv('Accounts_export.csv');
console.log('=== ACCOUNTS TABLE ===');
console.log('Total Rows:', accounts.results.length);
console.log('Columns:', accounts.headers);
console.log('Sample Row 1:', accounts.results[0]);
console.log('Sample Row 2:', accounts.results[1]);

const inventory = parseSimpleCsv('Inventory_export.csv');
console.log('\n=== INVENTORY TABLE ===');
console.log('Total Rows:', inventory.results.length);
console.log('Columns:', inventory.headers);
console.log('Sample Row 1:', inventory.results[0]);
console.log('Sample Row 2:', inventory.results[1]);

// Let's analyze distinct companies in Inventory
const companies = new Set();
inventory.results.forEach(r => {
    // Check company column
    const comp = r.Company || r.Mfg || r.Manufacturer || r.Comp || r.Brand || '';
    if (comp) companies.add(comp);
});
console.log('\nDistinct Companies in Inventory:', Array.from(companies).slice(0, 30));
