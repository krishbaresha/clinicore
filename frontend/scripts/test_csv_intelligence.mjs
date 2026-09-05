import { parseInventoryCSV, extractSmartPackingAndName, normalizePackingUnit, toTitleCaseClean } from "../src/api/db.js";

console.log("=== Testing Bulk Inventory CSV Engine ===");

// Test 1: extractSmartPackingAndName
const testCases = [
  {
    input: "hepakent sugarfree 120ml",
    expectedName: "Hepakent Sugarfree",
    expectedPack: "120 ML",
  },
  {
    input: "gastric plus with podina 75tabs",
    expectedName: "Gastric Plus With Podina",
    expectedPack: "75 TABS",
  },
  {
    input: "Endura Mens Essential capsule 20",
    expectedName: "Endura Mens Essential",
    expectedPack: "20 CAPS",
  },
  {
    input: "Berberis Aq Q 30 ml",
    expectedName: "Berberis Aq Q",
    expectedPack: "30 ML",
  },
  {
    input: "Bio Plasgen No 24 (20g)",
    expectedName: "Bio Plasgen No 24",
    expectedPack: "20 GMS",
  },
  {
    input: "Alfalfa Tonic 250ml",
    expectedName: "Alfalfa Tonic",
    expectedPack: "250 ML",
  },
  {
    input: "Carduus Marianus Q (1000 ml)",
    expectedName: "Carduus Marianus Q",
    expectedPack: "1000 ML",
  },
];

let allPassed = true;
for (const tc of testCases) {
  const res = extractSmartPackingAndName(tc.input);
  const pass = res.name === tc.expectedName && res.packing === tc.expectedPack;
  console.log(`[${pass ? "PASS" : "FAIL"}] "${tc.input}" -> Name: "${res.name}", Pack: "${res.packing}"`);
  if (!pass) {
    console.error(`  Expected Name: "${tc.expectedName}", Pack: "${tc.expectedPack}"`);
    allPassed = false;
  }
}

// Test 2: parseInventoryCSV with unarranged CSV
const sampleCsv = `Medicine Name,Description,Packing,Company,Purchase Price,Sale Price,Store Stock
hepakent sugarfree 120ml,syrup for liver,,BM Pvt LTD,150,220,10
gastric plus with podina 75tabs,gastric acidity tablets,,Paul Brooks,300,450,25
Endura Mens Essential capsule 20,vitality capsules,,Schwabe / German,800,1200,15
berberis vulgaris 30ml,dilution,,BM Pvt LTD,180,260,30
acid phos q 1000ml,mother tincture,,Schwabe / German,4500,6000,5
`;

const parsed = parseInventoryCSV(sampleCsv);
console.log(`\nParsed ${parsed.length} items from CSV:`);
parsed.forEach((p, idx) => {
  console.log(`${idx + 1}. [${p.company_name}] "${p.medicine_name}" | Pack: "${p.packing}" | Desc: "${p.product_description}" | Sale: Rs. ${p.unit_sale_price} | Stock: ${p.store_stock}`);
});

// Verify Sorting: Primary company, Secondary name
const companies = parsed.map((p) => p.company_name);
console.log("\nCompany sequence in output:", companies);

// Check if sorted
const isSorted = parsed.every((val, i, arr) => {
  if (i === 0) return true;
  const compComp = arr[i - 1].company_name.localeCompare(val.company_name, undefined, { sensitivity: "base" });
  if (compComp < 0) return true;
  if (compComp === 0) {
    return arr[i - 1].medicine_name.localeCompare(val.medicine_name, undefined, { sensitivity: "base" }) <= 0;
  }
  return false;
});

console.log(`Company & Name Alphabetical Sorting: ${isSorted ? "PASSED ✅" : "FAILED ❌"}`);
if (!allPassed || !isSorted) {
  process.exit(1);
} else {
  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
}
