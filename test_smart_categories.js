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

function detectCategoryAndForm(name, naration) {
    const lower = (name + ' ' + (naration || '')).toLowerCase();
    
    // 1. Syrups & Suspensions
    if (lower.includes('syp') || lower.includes('syrup') || lower.includes('susp') || lower.includes('cordial') || lower.includes('tonic') || lower.includes('elixir')) {
        return { category: "Syrup", form: "Syrup / Suspension", multiUnit: false };
    }
    
    // 2. Tablets
    if (lower.includes('tab') || lower.includes('tablet') || lower.includes('tablets') || lower.includes('pills') || lower.includes('globules')) {
        return { category: "Tablet", form: "Tablet (Solid)", multiUnit: true };
    }
    
    // 3. Capsules
    if (lower.includes('cap') || lower.includes('capsule') || lower.includes('capsules') || lower.includes('softgel')) {
        return { category: "Capsule", form: "Capsule (Hard/Softgel)", multiUnit: true };
    }
    
    // 4. Ointments / Creams / Gels
    if (lower.includes('cream') || lower.includes('ointment') || lower.includes('gel') || lower.includes('pomade') || lower.includes('lotion') || lower.includes('soap') || lower.includes('shampoo')) {
        return { category: "Cream / Ointment", form: "Cream / Ointment / Gel", multiUnit: false };
    }
    
    // 5. Mother Tinctures (Q / MTQ / MT / Tincture)
    if (lower.includes('mtq') || lower.includes('mother tincture') || lower.includes(' q ') || lower.endsWith(' q') || lower.includes('mt ') || lower.endsWith(' mt')) {
        return { category: "Mother Tincture (Q)", form: "Mother Tincture (Liquid Q)", multiUnit: false };
    }
    
    // 6. Dilutions / Potencies (30C, 200C, 1M, 10M, CM, LM)
    if (lower.includes('30c') || lower.includes('200c') || lower.includes(' 30 ') || lower.endsWith(' 30') || lower.includes(' 200 ') || lower.endsWith(' 200') || lower.includes(' 1m') || lower.includes(' 10m') || lower.includes(' cm') || lower.includes(' lm') || lower.includes('dilution')) {
        return { category: "Dilution", form: "Homeopathic Dilution / Potency", multiUnit: false };
    }
    
    // 7. Biochemic / Tissue Salts (3X, 6X, 12X, 30X, 200X)
    if (lower.includes('3x') || lower.includes('6x') || lower.includes('12x') || lower.includes('30x') || lower.includes('200x') || lower.includes('biochemic') || lower.includes('bio-plasgen') || lower.includes('bioplasgen') || lower.includes('tissue salt')) {
        return { category: "Biochemic / Tissue Salt", form: "Biochemic / Tissue Salts (6X/12X)", multiUnit: true };
    }
    
    // 8. Drops (20ml, 30ml, Drops, Complex)
    if (lower.includes('drop') || lower.includes('drops') || lower.includes('20ml') || lower.includes('30ml') || lower.includes('ghr') || lower.includes('bm-') || lower.includes('pb-') || lower.includes('r-') || lower.includes('mkt-')) {
        return { category: "Drops", form: "Homeopathic Drops", multiUnit: false };
    }
    
    // 9. Injections
    if (lower.includes('inj') || lower.includes('injection') || lower.includes('ampoule') || lower.includes('vial') || lower.includes('infusion') || lower.includes('drip')) {
        return { category: "Injection", form: "Injection / IV Drip", multiUnit: false };
    }
    
    // 10. Eye / Ear Drops
    if (lower.includes('eye') || lower.includes('ear') || lower.includes('cineraria') || lower.includes('euphrasia')) {
        return { category: "Eye / Ear Drops", form: "Eye / Ear Drops", multiUnit: false };
    }
    
    return { category: "General Homeopathic", form: "Homeopathic Formulation", multiUnit: false };
}

const stats = {};
for (let i = 1; i < rawLines.length; i++) {
    const cols = splitCsvLine(rawLines[i]);
    const name = cols[1].replace(/^"|"$/g, '').trim();
    const nar = cols[3].replace(/^"|"$/g, '').trim();
    const det = detectCategoryAndForm(name, nar);
    stats[det.category] = (stats[det.category] || 0) + 1;
}

console.log('Category Distribution across all 4,237 Medicines:');
for (const [k, v] of Object.entries(stats)) {
    console.log(`  - ${k}: ${v} items`);
}
