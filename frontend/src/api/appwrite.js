import { Client, Databases, Storage, Account, ID, Query } from "appwrite";

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || "";
export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || "clinicore_db";
export const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID || "prescriptions_vault";

export const client = new Client();

if (PROJECT_ID) {
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID);
}

export const databases = new Databases(client);
export const storage = new Storage(client);
export const account = new Account(client);

export const isAppwriteConfigured = () => Boolean(PROJECT_ID && PROJECT_ID.length > 3);

/**
 * Appwrite Collection Identifiers
 */
export const COLLECTIONS = {
  PATIENTS: "patients",
  VISITS: "visits",
  STORE_INVENTORY: "store_inventory",
  STORE_SALES: "store_sales",
  WAREHOUSES: "warehouses",
  CASHBOOK: "cashbook",
  CLINIC_SETTINGS: "clinic_settings",
  USERS: "users",
};

/**
 * Universal Repository Driver for Appwrite with graceful fallback
 */
export class AppwriteRepository {
  constructor(collectionId) {
    this.collectionId = collectionId;
  }

  async getAll(queries = []) {
    if (!isAppwriteConfigured()) return null;
    try {
      const response = await databases.listDocuments(DATABASE_ID, this.collectionId, queries);
      return response.documents;
    } catch (err) {
      console.warn(`[Appwrite] Error listing ${this.collectionId}:`, err);
      return null;
    }
  }

  async getById(documentId) {
    if (!isAppwriteConfigured()) return null;
    try {
      return await databases.getDocument(DATABASE_ID, this.collectionId, documentId);
    } catch (err) {
      console.warn(`[Appwrite] Error getting ${this.collectionId}/${documentId}:`, err);
      return null;
    }
  }

  async create(data, documentId = ID.unique()) {
    if (!isAppwriteConfigured()) return null;
    try {
      return await databases.createDocument(DATABASE_ID, this.collectionId, documentId, data);
    } catch (err) {
      console.warn(`[Appwrite] Error creating in ${this.collectionId}:`, err);
      return null;
    }
  }

  async update(documentId, data) {
    if (!isAppwriteConfigured()) return null;
    try {
      return await databases.updateDocument(DATABASE_ID, this.collectionId, documentId, data);
    } catch (err) {
      console.warn(`[Appwrite] Error updating in ${this.collectionId}/${documentId}:`, err);
      return null;
    }
  }

  async delete(documentId) {
    if (!isAppwriteConfigured()) return null;
    try {
      await databases.deleteDocument(DATABASE_ID, this.collectionId, documentId);
      return true;
    } catch (err) {
      console.warn(`[Appwrite] Error deleting in ${this.collectionId}/${documentId}:`, err);
      return false;
    }
  }
}

/**
 * Cloud Storage Upload Helper for Prescriptions & Lab Photos
 */
export async function uploadFileToCloud(file, fileId = ID.unique()) {
  if (!isAppwriteConfigured()) return null;
  try {
    const uploaded = await storage.createFile(BUCKET_ID, fileId, file);
    // Return direct permanent view URL
    const fileUrl = storage.getFileView(BUCKET_ID, uploaded.$id);
    return {
      fileId: uploaded.$id,
      url: fileUrl.href || fileUrl.toString(),
    };
  } catch (err) {
    console.warn("[Appwrite Storage] Upload error:", err);
    return null;
  }
}

export function getCloudFilePreview(fileId, width = 800, height = 800) {
  if (!isAppwriteConfigured() || !fileId) return null;
  try {
    const previewUrl = storage.getFilePreview(BUCKET_ID, fileId, width, height);
    return previewUrl.href || previewUrl.toString();
  } catch (err) {
    return null;
  }
}
