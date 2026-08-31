const fs = require('fs');

function parseSimpleCsv(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    
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

const invextra = parseSimpleCsv('Invextra_export.csv');
console.log('=== INVEXTRA TABLE ===');
console.log('Total Rows:', invextra.results.length);
console.log('Columns:', invextra.headers);
console.log('Sample Row 1:', invextra.results[0]);
console.log('Sample Row 2:', invextra.results[1]);
console.log('Sample Row 3:', invextra.results[2]);
