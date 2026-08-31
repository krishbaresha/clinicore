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

const BRAND_NAME_MAP = {
    "GHR": "GHR Homoeo Pharma",
    "BM": "BM Pvt LTD",
    "MEK": "MEKTUM Homeo Pharma",
    "HFP": "HFP Pvt Ltd",
    "BL": "BLOSSOM Homeo Labs",
    "Bl": "BLOSSOM Homeo Labs",
    "PBHL": "Paul Brooks Homoeo Lab",
    "Clinic": "Clinic Internal Preparation",
    "AK": "Ashraf Laboratories",
    "WShah": "W.S. Laboratories",
    "MASOD": "Masood Homoeopathic Pharma",
    "RECK": "Dr. Reckeweg Germany",
    "KAMAL": "Kamal Laboratories",
    "Shwabe": "Dr. Willmar Schwabe Germany",
    "Eagle": "Eagle Homoeo",
    "ZAM ZAM": "ZAM ZAM Homoeo Pharma",
    "BHP": "B.H.P Laboratory (PVT) LTD",
    "Kent": "Kent Homoeopathic Pharmacy",
    "NP": "NP Laboratories",
    "T.S": "T.S. Laboratories",
    "Public Pharma": "Public Pharma",
    "Lehning": "Lehning Laboratories",
    "Farhan": "Farhan Homoeo",
    "JR": "JR Laboratories",
    "GR": "GR Laboratories"
};

const rawLines = fs.readFileSync('Inventory_export.csv', 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);

const outHeaders = [
    "Medicine Name",
    "Company Name",
    "Product Code",
    "Purchase Price",
    "Sale Price",
    "Store Stock",
    "Warehouse Stock",
    "Category",
    "Minimum Alert Level"
];

const outRows = [outHeaders.join(',')];

for (let i = 1; i < rawLines.length; i++) {
    const cols = splitCsvLine(rawLines[i]);
    const id = cols[0].replace(/^"|"$/g, '').trim();
    const name = cols[1].replace(/^"|"$/g, '').trim();
    const brandCode = cols[2].replace(/^"|"$/g, '').trim();
    const naration = cols[3].replace(/^"|"$/g, '').trim();
    const minLevel = cols[4].replace(/^"|"$/g, '').trim() || "6";
    
    // Resolve Company Name
    const resolvedCompany = BRAND_NAME_MAP[brandCode] || (brandCode ? `${brandCode} Pharma` : "BM Pvt LTD");
    const itemCode = brandCode || id || "GEN";
    const category = (naration && naration !== "0") ? naration : "Homeopathic Drops";

    const safeName = `"${name.replace(/"/g, '""')}"`;
    const safeCompany = `"${resolvedCompany.replace(/"/g, '""')}"`;
    const safeCode = `"${itemCode.replace(/"/g, '""')}"`;
    const safeCat = `"${category.replace(/"/g, '""')}"`;
    const cost = "0";
    const sale = "0";
    const storeStock = "0";
    const godownStock = "0";
    const safeMin = `"${minLevel}"`;

    outRows.push([
        safeName,
        safeCompany,
        safeCode,
        cost,
        sale,
        storeStock,
        godownStock,
        safeCat,
        safeMin
    ].join(','));
}

fs.writeFileSync('e:\\Soft\\DrCreate\\Clinicore\\VERIFIED_MEDICINES_CATALOG.csv', outRows.join('\r\n'), 'utf8');
console.log(`Generated perfectly formatted VERIFIED_MEDICINES_CATALOG.csv with ${outRows.length - 1} medicines!`);
