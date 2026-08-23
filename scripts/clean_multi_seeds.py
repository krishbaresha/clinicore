file_path = "e:/Soft/DrCreate/ClinicFlow/frontend/src/api/db.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace MULTI_COMPANY_INVENTORY_SEEDS and dbInventory.getAll
import re

seed_pattern = re.compile(r"export const MULTI_COMPANY_INVENTORY_SEEDS = \[[\s\S]*?\];\s*// ---------- Inventory Engine ----------\s*export const dbInventory = \{[\s\S]*?getById: \(id\) => \{", re.MULTILINE)

replacement = """export const MULTI_COMPANY_INVENTORY_SEEDS = [];

// ---------- Inventory Engine ----------
export const dbInventory = {
  getAll: () => {
    return getCollection(KEYS.INVENTORY) || [];
  },
  getById: (id) => {"""

if seed_pattern.search(content):
    content = seed_pattern.sub(replacement, content)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: MULTI_COMPANY_INVENTORY_SEEDS and dbInventory.getAll cleaned!")
else:
    print("PATTERN NOT MATCHED")
