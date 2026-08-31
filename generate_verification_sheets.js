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

const accounts = parseSimpleCsv('Accounts_export.csv').results;
const inventory = parseSimpleCsv('Inventory_export.csv').results;

// Generate Parties preview CSV
// Header: Party Code, Party Name, Account Type, City/Area, Phone, Salesman, Opening Balance (Rs 0)
const partiesHeaders = ['Party Code', 'Party Name', 'Account Type', 'City', 'Phone', 'Salesman', 'Opening Balance'];
const partiesRows = [partiesHeaders.join(',')];

accounts.forEach(a => {
    const pCode = (a['Account No'] || a['ID'] || '').trim();
    const pName = (a['Account Name'] || '').trim();
    const pType = (a['Account Type'] || '').trim();
    const naration = (a['Naration'] || '').trim();
    
    // Clean fields
    const safeName = `"${pName.replace(/"/g, '""')}"`;
    const safeType = `"${pType}"`;
    const safeCity = '""'; // Default empty for manual/later entry
    const safePhone = '""';
    const safeSalesman = '""';
    const safeBalance = '0';

    partiesRows.push([`"${pCode}"`, safeName, safeType, safeCity, safePhone, safeSalesman, safeBalance].join(','));
});

fs.writeFileSync('e:\\Soft\\DrCreate\\Clinicore\\VERIFY_PARTIES_PREVIEW.csv', partiesRows.join('\r\n'), 'utf8');
console.log(`Generated VERIFY_PARTIES_PREVIEW.csv (${accounts.length} parties)`);

// Generate Medicines preview CSV
// Header: Item ID, Item Code / Company Code, Medicine Name, Category, Minimum Alert Level, Sale Price (0), Purchase Price (0), Current Stock (0)
const medHeaders = ['Item Code', 'Item Name', 'Company / Brand Code', 'Minimum Alert Level', 'Cost Price', 'Sale Price', 'Current Stock'];
const medRows = [medHeaders.join(',')];

inventory.forEach(inv => {
    const code = (inv['ID'] || '').trim();
    const name = (inv['Item Name'] || '').trim();
    const brandCode = (inv['Item Code'] || '').trim();
    const minLevel = (inv['Minimum Level'] || '0').trim();
    
    const safeCode = `"${code}"`;
    const safeName = `"${name.replace(/"/g, '""')}"`;
    const safeBrand = `"${brandCode.replace(/"/g, '""')}"`;
    const safeMin = `"${minLevel}"`;
    const costPrice = '0';
    const salePrice = '0';
    const stock = '0';
    
    medRows.push([safeCode, safeName, safeBrand, safeMin, costPrice, salePrice, stock].join(','));
});

fs.writeFileSync('e:\\Soft\\DrCreate\\Clinicore\\VERIFY_MEDICINES_PREVIEW.csv', medRows.join('\r\n'), 'utf8');
console.log(`Generated VERIFY_MEDICINES_PREVIEW.csv (${inventory.length} medicines)`);
