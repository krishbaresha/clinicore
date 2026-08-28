/** patients.js — Patient CRUD operations. */
import { dbPatients, dbVisits, dbDocuments, normalizePhone } from "./db.js";
import { patientInputSchema, validateSchema } from "../schemas/index.js";

export { normalizePhone };

export function getPatients()         { return { success: true, data: dbPatients.getAll(), error: null }; }
export function searchPatients(query) { return { success: true, data: dbPatients.search(query), error: null }; }
export function getPatient(id)        {
  const p = dbPatients.getById(id);
  if (!p) return { success: false, data: null, error: { code: "NOT_FOUND", message: "Patient not found." } };
  return { success: true, data: p, error: null };
}
export function updatePatient(id, data) {
  const updated = dbPatients.update(id, data);
  if (!updated) return { success: false, data: null, error: { code: "NOT_FOUND", message: "Patient not found." } };
  return { success: true, data: updated, error: null };
}

export function checkDuplicatePatient({ phone, full_name, relation_name, cnic } = {}) {
  const cleanPhone = normalizePhone(phone);
  const cleanName = (full_name || "").trim().toLowerCase();
  const cleanRel = (relation_name || "").trim().toLowerCase();
  const cleanCnic = (cnic || "").trim();

  const allPatients = dbPatients.getAll();
  const matches = allPatients.filter((p) => {
    const pPhone = normalizePhone(p.phone);
    if (cleanPhone && pPhone && cleanPhone === pPhone) return true;
    if (cleanCnic && p.cnic && cleanCnic === p.cnic) return true;
    if (cleanName && cleanRel && p.full_name?.toLowerCase() === cleanName && p.relation_name?.toLowerCase() === cleanRel) return true;
    return false;
  });

  return {
    has_duplicates: matches.length > 0,
    matches,
  };
}

export function createPatient(formData) {
  const validation = validateSchema(patientInputSchema, formData);
  if (!validation.success) {
    return validation;
  }
  const patient = dbPatients.add(validation.data);
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
