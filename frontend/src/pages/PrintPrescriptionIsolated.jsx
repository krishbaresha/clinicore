import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getVisit } from "../api/visits.js";
import { dbClinic, dbPatients } from "../api/db.js";
import { formatDate } from "../utils/formatters.js";

export default function PrintPrescriptionIsolated() {
  const { id } = useParams();
  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const vr = getVisit(id);
    if (!vr.success) {
      setError(vr.error.message);
      return;
    }
    setVisit(vr.data);
    const p = dbPatients.getById(vr.data.patient_id);
    setPatient(p);
    setClinic(dbClinic.get());
  }, [id]);

  useEffect(() => {
    if (patient && visit) {
      const originalTitle = document.title;
      const dateStr = formatDate(visit.visit_date);
      const cleanName = patient.full_name.replace(/\s+/g, "_");
      document.title = `Prescription_${cleanName}_${dateStr}`;
      
      // Auto print and auto close
      const timer = setTimeout(() => {
        window.print();
      }, 500);

      const closeWindow = () => {
        window.close();
      };

      window.addEventListener("afterprint", closeWindow);

      return () => {
        document.title = originalTitle;
        clearTimeout(timer);
        window.removeEventListener("afterprint", closeWindow);
      };
    }
  }, [patient, visit]);

  if (error) {
    return (
      <div style={{ padding: "20px", color: "red", fontFamily: "sans-serif" }}>
        Error: {error}
      </div>
    );
  }

  if (!visit || !patient) {
    return (
      <div style={{ padding: "20px", color: "#666", fontFamily: "sans-serif" }}>
        Loading prescription...
      </div>
    );
  }

  return (
    <div className="isolated-print-view">
      <div className="receipt-title">{clinic?.name || "Clinic"}</div>
      {clinic?.address && <div className="receipt-address">{clinic.address}</div>}
      
      <div className="receipt-meta">
        <span>Prescription</span>
        <span>{formatDate(visit.visit_date)}</span>
      </div>

      <div className="receipt-divider" />

      <div className="receipt-info-block">
        <div><strong>Patient:</strong> {patient.full_name}</div>
        <div>
          Age {patient.age ?? "—"} &bull; {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "—"}
        </div>
        {visit.diagnosis && (
          <div style={{ marginTop: "4px" }}>
            <strong>Diagnosis:</strong> {visit.diagnosis}
          </div>
        )}
      </div>

      <div className="receipt-divider" />

      <div className="receipt-rx-label">Rx — Medicines Prescribed</div>
      
      {visit.prescription_items?.length > 0 ? (
        <div className="receipt-meds">
          {visit.prescription_items.map((rx) => (
            <div key={rx.id} className="receipt-med-item">
              <div className="receipt-med-name">{rx.medicine_name}</div>
              <div className="receipt-med-details">{rx.dosage} ({rx.duration})</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="receipt-meds-empty">No medicines prescribed.</div>
      )}

      {visit.notes && (
        <>
          <div className="receipt-divider" />
          <div className="receipt-info-block">
            <strong>Notes:</strong> {visit.notes}
          </div>
        </>
      )}

      {visit.follow_up_date && (
        <>
          <div className="receipt-divider" />
          <div className="receipt-info-block">
            <strong>Follow-up:</strong> {formatDate(visit.follow_up_date)}
          </div>
        </>
      )}

      {/* Billing Breakdown */}
      <div className="receipt-divider" />
      <div className="receipt-info-block" style={{ fontSize: "12px", lineHeight: "1.4" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Consultation Fee:</span>
          <span>Rs. {clinic?.default_consultation_fee || 800}</span>
        </div>
        {visit.services?.map((ser) => (
          <div key={ser.id} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{ser.service_name}:</span>
            <span>Rs. {ser.price}</span>
          </div>
        ))}
        <div className="receipt-divider" style={{ margin: "4px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <span>Total Paid:</span>
          <span>Rs. {visit.fee_amount}</span>
        </div>
      </div>

      <div className="receipt-divider" />

      <div className="receipt-footer">
        <div className="receipt-signature-line" />
        <div>Doctor's Signature</div>
      </div>
    </div>
  );
}
