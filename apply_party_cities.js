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

// City standardizer dictionary for Interior Sindh
const KNOWN_CITIES = [
    "Hyderabad", "Kotri", "TMK", "Tando Muhammad Khan", "Sanghar", "SANGER",
    "Shahdadpur", "SHADADPUR", "Tando Adam", "T.Adam", "Tando Alayar",
    "Tando Jaam", "Tando Bhago", "Tando Ghulam Ali", "Larkana", "Sukkur", "Sukkar",
    "Badin", "Badain", "Nawabshah", "NAWABSHAH", "Moro", "Hala", "Golarchi", "GOLARCHI",
    "Mirpur Khas", "Mirpur", "Umerkot", "Umar Kot", "Tharparkar", "Tharushah", "Talhar",
    "Matyari", "Dolat Pur", "Dambalo", "Gulab Lagari", "Ghulab Lagari", "Jahan Mori",
    "Jhand Mori", "Jahand Mori", "Khanoot", "KHANOOT", "Noabad", "Pano Aqil", "PANOAQIL",
    "Qazi Ahmed", "Sanjhoro", "Rato Dero", "Chamber", "Odero Lal", "Kunri", "Bandhi",
    "Kumba", "Dharki", "DHARKI", "Mehar", "Gambat", "Piro Lashari", "Khairpur Miras",
    "Khipro", "Darya Khan Mari", "Bashirabad", "Khaber", "Karachi", "Lahore", "Faisalabad", "Multan"
];

function resolveCityFromAccount(name, type, naration) {
    const combined = `${type} ${naration} ${name}`.trim();
    
    // Check direct match with type
    for (const city of KNOWN_CITIES) {
        if (type.toLowerCase() === city.toLowerCase()) {
            return formatCityName(city);
        }
    }
    
    // Check if city name is mentioned inside naration, name or type
    for (const city of KNOWN_CITIES) {
        const regex = new RegExp(`\\b${city}\\b`, 'i');
        if (regex.test(combined)) {
            return formatCityName(city);
        }
    }
    
    if (type.toLowerCase() === 'local market' || type.toLowerCase() === 'customer') {
        return "Hyderabad (Local)";
    }
    if (type.toLowerCase() === 'supplier') {
        return "National Supplier";
    }
    
    return type || "Hyderabad";
}

function formatCityName(c) {
    const clean = c.trim().toLowerCase();
    if (clean === 'tmk') return 'Tando Muhammad Khan (TMK)';
    if (clean === 'sanger') return 'Sanghar';
    if (clean === 'shadadpur') return 'Shahdadpur';
    if (clean === 't.adam') return 'Tando Adam';
    if (clean === 'tando alayar') return 'Tando Allahyar';
    if (clean === 'tando jaam') return 'Tando Jam';
    if (clean === 'badain') return 'Badin';
    if (clean === 'nawabshah') return 'Nawabshah';
    if (clean === 'golarchi') return 'Golarchi';
    if (clean === 'jhand mori' || clean === 'jahand mori') return 'Jahan Mori';
    if (clean === 'khanoot') return 'Khanoot';
    if (clean === 'panoaqil') return 'Pano Aqil';
    if (clean === 'sukkar') return 'Sukkur';
    if (clean === 'umar kot') return 'Umerkot';
    if (clean === 'ghulab lagari') return 'Gulab Lagari';
    if (clean === 'mirpur') return 'Mirpur Khas';
    if (clean === 'dharki') return 'Dharki';
    if (clean === 'odero lal') return 'Odero Lal';
    if (clean === 'rato dero') return 'Ratodero';
    
    // Capitalize words
    return c.replace(/\b\w/g, l => l.toUpperCase());
}

const accLines = fs.readFileSync('Accounts_export.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
const cleanParties = [];
const cityStats = {};

for (let i = 1; i < accLines.length; i++) {
    const cols = splitCsvLine(accLines[i]);
    const id = cols[0].replace(/^"|"$/g, '').trim();
    const name = cols[1].replace(/^"|"$/g, '').trim();
    const no = cols[2].replace(/^"|"$/g, '').trim();
    const nar = cols[3].replace(/^"|"$/g, '').trim();
    const type = cols[4].replace(/^"|"$/g, '').trim();

    const resolvedCity = resolveCityFromAccount(name, type, nar);
    cityStats[resolvedCity] = (cityStats[resolvedCity] || 0) + 1;

    // Extract phone number from naration if present
    const phoneMatch = (nar + ' ' + name).match(/03\d{2}[-\s]?\d{7}/);
    const phone = phoneMatch ? phoneMatch[0] : '';

    cleanParties.push({
        id: `pty_${no || id || String(i).padStart(3, '0')}`,
        party_code: no || String(i).padStart(3, '0'),
        party_name: name,
        name: name,
        account_type: type || 'Customer',
        city: resolvedCity,
        territory: resolvedCity,
        phone: phone,
        address: nar && nar !== '0' ? nar : `${resolvedCity}, Sindh`,
        salesman: nar.toLowerCase().includes('waheed') ? 'Waheed Bhai' : nar.toLowerCase().includes('danish') ? 'Muhammad Danish' : 'Usama',
        balance_due: 0,
        opening_balance: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

console.log('City Distribution across all 263 Registered Parties:');
for (const [k, v] of Object.entries(cityStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${k}: ${v} Parties`);
}

// 1. Write to Tauri Data Directory
const appData = process.env.APPDATA;
const tauriDataDir = path.join(appData, 'ClinicFlow', 'data');
if (fs.existsSync(tauriDataDir)) {
    fs.writeFileSync(path.join(tauriDataDir, 'cf_parties_v5.json'), JSON.stringify(cleanParties, null, 2), 'utf8');
    console.log(`\n✅ Successfully updated %APPDATA%/ClinicFlow/data/cf_parties_v5.json with categorized cities (${cleanParties.length} parties)!`);
}

// 2. Write to frontend seed
fs.writeFileSync('frontend/src/api/master_parties_seed.json', JSON.stringify(cleanParties, null, 2), 'utf8');
console.log(`✅ Updated frontend/src/api/master_parties_seed.json!`);
