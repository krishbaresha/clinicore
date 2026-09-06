const store = new Map();
if (typeof window === "undefined" || !globalThis.localStorage) {
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.window = {
    localStorage: globalThis.localStorage,
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

import XLSX from "xlsx";
import { parseInventoryCSV, dbInventory } from "../src/api/db.js";

console.log("=== Testing Paul Brooks Inventory XLSX Ingestion & Zero-Auto-Fill Standard ===");

const wb = XLSX.readFile("e:/Soft/DrCreate/Clinicore/Paul Brooks Inventory.xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

console.log("Raw Excel total rows:", rawRows.length);
if (rawRows.length < 50) {
  console.error("FAIL: Expected at least 50 rows in Excel spreadsheet.");
  process.exit(1);
}

const parsed = parseInventoryCSV(rawRows);
console.log("Parsed valid medicine count:", parsed.length);

if (parsed.length !== 53) {
  console.error(`FAIL: Expected exactly 53 medicines parsed from sheet, got ${parsed.length}`);
  process.exit(1);
}

// Check zero auto-fill
let autoFillCount = 0;
parsed.forEach((item, i) => {
  if (item.product_description || item.category || item.item_code) {
    autoFillCount++;
    console.error(`Row ${i + 1} has unexpected auto-fill:`, {
      name: item.medicine_name,
      desc: item.product_description,
      cat: item.category,
      code: item.item_code
    });
  }
});

if (autoFillCount !== 0) {
  console.error(`FAIL: Found ${autoFillCount} items with unwanted auto-fill!`);
  process.exit(1);
}
console.log("✅ Zero Auto-Fill Check: PASSED (Description, Category & Item Code strictly empty)");

// Verify specific medicine names and attributes
const acne = parsed.find(p => p.medicine_name === "Acne Pimp Soap");
if (!acne || acne.unit_sale_price !== 250 || acne.packing !== "100 gms" || acne.company_name !== "PBHL") {
  console.error("FAIL: Acne Pimp Soap attributes mismatch:", acne);
  process.exit(1);
}
console.log("✅ Acne Pimp Soap: PASSED");

const endura = parsed.find(p => p.medicine_name === "Endura / Oil Blend (Cosmetic)");
if (!endura || endura.unit_sale_price !== 1250 || endura.packing !== "20 ml" || endura.company_name !== "PBHL") {
  console.error("FAIL: Endura name or attributes corrupted:", endura);
  process.exit(1);
}
console.log("✅ Endura / Oil Blend (Cosmetic) Casing & Parentheses: PASSED");

const oclear = parsed.find(p => p.medicine_name.includes("O'Clear Brightening Soap"));
if (!oclear || oclear.medicine_name !== "O'Clear Brightening Soap Turmeric & Kojic Acid" || oclear.unit_sale_price !== 390) {
  console.error("FAIL: O'Clear name or apostrophe corrupted:", oclear);
  process.exit(1);
}
console.log("✅ O'Clear Apostrophe & Ampersand: PASSED");

const olove = parsed.find(p => p.medicine_name === "O'Love (Olive Oil Soap)");
if (!olove || olove.unit_sale_price !== 300) {
  console.error("FAIL: O'Love name corrupted:", olove);
  process.exit(1);
}
console.log("✅ O'Love (Olive Oil Soap): PASSED");

const reroot = parsed.find(p => p.medicine_name === "Reroot Hair Growth Tablet");
if (!reroot || reroot.packing !== "60's" || reroot.unit_sale_price !== 950) {
  console.error("FAIL: Reroot Hair Growth Tablet packing 60's corrupted:", reroot);
  process.exit(1);
}
console.log("✅ Reroot Hair Growth Tablet (60's packing): PASSED");

// Test bulkImport into dbInventory
const importRes = dbInventory.bulkImport(parsed, "merge");
console.log("dbInventory.bulkImport result:", importRes);
if (!importRes.success || importRes.count !== 53) {
  console.error("FAIL: dbInventory.bulkImport failed or imported wrong count:", importRes);
  process.exit(1);
}

// Verify imported items in dbInventory
const allInv = dbInventory.getAll();
const importedAcne = allInv.find(i => i.medicine_name === "Acne Pimp Soap");
if (!importedAcne || importedAcne.product_description !== "" || importedAcne.category !== "" || importedAcne.company_name !== "PBHL") {
  console.error("FAIL: dbInventory record has auto-fill or wrong company:", importedAcne);
  process.exit(1);
}
console.log("✅ dbInventory Bulk Import & Zero-Auto-Fill Verification: PASSED");

console.log("\n🎉 ALL PAUL BROOKS XLSX INGESTION & ZERO-AUTO-FILL TESTS PASSED! 🎉");
