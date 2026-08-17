/** patients.js — Patient CRUD operations. */
import { dbPatients, dbVisits, dbDocuments } from "./db.js";

export function getPatients()         { return { success: true, data: dbPatients.getAll(), error: null }; }
export function searchPatients(query) { return { success: true, data: dbPatients.search(query), error: null }; }
export function getPatient(id)        {
  const p = dbPatients.getById(id);
  if (!p) return { success: false, data: null, error: { code: "NOT_FOUND", message: "Patient not found." } };
  return { success: true, data: p, error: null };
}

export function createPatient(formData) {
  const { full_name, relation_name, relation_type, phone, age, gender, cnic } = formData;
  if (!full_name?.trim()) return { success: false, data: null, error: { code: "VALIDATION", message: "Full name is required." } };
  if (!phone?.trim())     return { success: false, data: null, error: { code: "VALIDATION", message: "Phone number is required." } };
  const patient = dbPatients.add({
    full_name: full_name.trim(),
    relation_name: relation_name?.trim() || "",
    relation_type: relation_type || "father",
    phone: phone.trim(),
    age: parseInt(age) || null,
    gender: gender || null,
    cnic: cnic?.trim() || ""
  });
  return { success: true, data: patient, error: null };
}

/** Return visits for a patient, enriched with prescription items. */
export function getPatientVisits(patientId) {
  const visits = dbVisits.getByPatient(patientId);
  return { success: true, data: visits, error: null };
}

export function getPatientDocuments(patientId) {
  return { success: true, data: dbDocuments.getByPatient(patientId), error: null };
}

export function uploadPatientDocument(patientId, doc) {
  const { name, file_type, data_url } = doc;
  if (!name) return { success: false, data: null, error: { code: "VALIDATION", message: "Document name is required." } };
  const newDoc = dbDocuments.add({ patient_id: patientId, name, file_type, data_url });
  return { success: true, data: newDoc, error: null };
}

export function deletePatientDocument(id) {
  dbDocuments.delete(id);
  return { success: true, data: null, error: null };
}
