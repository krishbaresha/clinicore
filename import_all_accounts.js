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

const lines = fs.readFileSync('Accounts_export.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const allAccounts = [];

for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const id = cols[0].replace(/^"|"$/g, '').trim();
    const name = cols[1].replace(/^"|"$/g, '').trim();
    const accNo = cols[2].replace(/^"|"$/g, '').trim() || String(i).padStart(3, '0');
    const naration = cols[3].replace(/^"|"$/g, '').trim();
    const type = cols[4].replace(/^"|"$/g, '').trim() || 'General';

    if (name) {
        allAccounts.push({
            id: `acc_${accNo}`,
            account_no: accNo,
            account_name: name,
            name: name,
            naration: naration && naration !== '0' ? naration : '',
            account_type: type,
            type: type,
            opening_balance: 0,
            current_balance: 0,
            status: 'active',
            date: new Date().toLocaleDateString("en-US"),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
}

console.log(`Loaded ${allAccounts.length} Chart of Accounts from Access database.`);

// 1. Write to Tauri Roaming directory
const appData = process.env.APPDATA;
const tauriDataDir = path.join(appData, 'ClinicFlow', 'data');
if (fs.existsSync(tauriDataDir)) {
    fs.writeFileSync(path.join(tauriDataDir, 'cf_accounts_v5.json'), JSON.stringify(allAccounts, null, 2), 'utf8');
    console.log(`✅ Saved ${allAccounts.length} accounts to %APPDATA%/ClinicFlow/data/cf_accounts_v5.json!`);
}

// 2. Write to frontend seed
fs.writeFileSync('frontend/src/api/master_accounts_seed.json', JSON.stringify(allAccounts, null, 2), 'utf8');
console.log(`✅ Updated frontend/src/api/master_accounts_seed.json!`);
