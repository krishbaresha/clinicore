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

// 1. Process Parties
const partiesCsv = fs.readFileSync('VERIFY_PARTIES_PREVIEW.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const partiesData = [];
for (let i = 1; i < partiesCsv.length; i++) {
    const cols = splitCsvLine(partiesCsv[i]);
    const code = cols[0].replace(/^"|"$/g, '');
    const name = cols[1].replace(/^"|"$/g, '');
    const type = cols[2].replace(/^"|"$/g, '');
    const city = cols[3].replace(/^"|"$/g, '');
    const phone = cols[4].replace(/^"|"$/g, '');
    const salesman = cols[5].replace(/^"|"$/g, '');
    const balance = Number(cols[6]) || 0;

    partiesData.push({
        id: 'pty_' + (code || String(i).padStart(3, '0')),
        party_code: code,
        party_name: name,
        name: name,
        account_type: type || 'Customer',
        city: city || '',
        phone: phone || '',
        salesman: salesman || '',
        balance_due: balance,
        opening_balance: balance,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

// 2. Process Medicines
const medCsv = fs.readFileSync('VERIFY_MEDICINES_PREVIEW.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const medData = [];
for (let i = 1; i < medCsv.length; i++) {
    const cols = splitCsvLine(medCsv[i]);
    const code = cols[0].replace(/^"|"$/g, '');
    const name = cols[1].replace(/^"|"$/g, '');
    const brand = cols[2].replace(/^"|"$/g, '');
    const minLevel = Number(cols[3]) || 6;
    const cost = Number(cols[4]) || 0;
    const price = Number(cols[5]) || 0;
    const stock = Number(cols[6]) || 0;

    medData.push({
        id: 'med_' + (code || String(i).padStart(4, '0')),
        item_code: brand || 'GEN',
        medicine_name: name,
        company_name: brand || 'Other',
        category: 'Drops',
        strength: '20ml',
        cost_price: cost,
        sale_price: price,
        stock_qty: stock,
        total_base_stock: stock,
        store_stock: 0,
        warehouse_stock: 0,
        low_stock_threshold: minLevel,
        is_active: true,
        batches: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

fs.writeFileSync('frontend/src/api/master_parties_seed.json', JSON.stringify(partiesData, null, 2), 'utf8');
fs.writeFileSync('frontend/src/api/master_medicines_seed.json', JSON.stringify(medData, null, 2), 'utf8');
console.log('Successfully created frontend/src/api/master_parties_seed.json (' + partiesData.length + ' records)');
console.log('Successfully created frontend/src/api/master_medicines_seed.json (' + medData.length + ' records)');
