import { Client, Databases, Storage, Permission, Role } from "node-appwrite";

const ENDPOINT = "https://sgp.cloud.appwrite.io/v1";
const PROJECT_ID = "6a8abfc60007fa775924";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DATABASE_ID = "clinicore_db";
const BUCKET_ID = "prescriptions_vault";

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const TABLES = [
  { id: "patients", name: "Patients" },
  { id: "visits", name: "Visits" },
  { id: "store_inventory", name: "Store Inventory" },
  { id: "store_sales", name: "Store Sales" },
  { id: "warehouses", name: "Warehouses" },
  { id: "cashbook", name: "Cashbook" },
  { id: "clinic_settings", name: "Clinic Settings" },
];

async function setupAppwrite() {
  console.log("🚀 Starting 100% Automated Appwrite Cloud Provisioning...");

  // 1. Ensure Database Exists
  try {
    await databases.get(DATABASE_ID);
    console.log(`✅ Database '${DATABASE_ID}' found.`);
  } catch (err) {
    console.log(`Creating database '${DATABASE_ID}'...`);
    await databases.create(DATABASE_ID, "CliniCore DB");
    console.log(`✅ Database '${DATABASE_ID}' created.`);
  }

  // 2. Ensure Storage Bucket Exists with Permissions
  try {
    await storage.getBucket(BUCKET_ID);
    console.log(`✅ Bucket '${BUCKET_ID}' found.`);
  } catch (err) {
    console.log(`Creating bucket '${BUCKET_ID}'...`);
    await storage.createBucket(
      BUCKET_ID,
      "Prescriptions Vault",
      [
        Permission.read(Role.any()),
        Permission.create(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      false, // fileSecurity
      true,  // enabled
      10 * 1024 * 1024, // 10MB
      ["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"]
    );
    console.log(`✅ Bucket '${BUCKET_ID}' created with full public permissions.`);
  }

  // 3. Create or Update Tables and Attributes
  for (const table of TABLES) {
    console.log(`\n📦 Processing Table: ${table.name} (${table.id})...`);
    
    // Create Table if missing
    try {
      await databases.getCollection(DATABASE_ID, table.id);
      console.log(`  ✓ Table '${table.id}' exists.`);
    } catch (err) {
      console.log(`  Creating table '${table.id}'...`);
      await databases.createCollection(
        DATABASE_ID,
        table.id,
        table.name,
        [
          Permission.read(Role.any()),
          Permission.create(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ]
      );
      console.log(`  ✓ Table '${table.id}' created.`);
    }

    // Add 'data' String attribute (100,000 chars for universal JSON payloads)
    try {
      await databases.createStringAttribute(DATABASE_ID, table.id, "data", 100000, false);
      console.log(`  ✓ Attribute 'data' created.`);
    } catch (err) {
      console.log(`  - Attribute 'data' status: ${err.message || 'Already exists'}`);
    }

    // Add 'synced_at' String attribute
    try {
      await databases.createStringAttribute(DATABASE_ID, table.id, "synced_at", 100, false);
      console.log(`  ✓ Attribute 'synced_at' created.`);
    } catch (err) {
      console.log(`  - Attribute 'synced_at' status: ${err.message || 'Already exists'}`);
    }
  }

  console.log("\n🎉 ALL APPWRITE TABLES, ATTRIBUTES & STORAGE BUCKETS FULLY AUTOMATED & READY!");
}

setupAppwrite().catch(console.error);
