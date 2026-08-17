import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getVisit } from "../api/visits.js";
import { dbClinic, dbPatients } from "../api/db.js";
import { formatDate, formatPatientAge } from "../utils/formatters.js";

export default function PrintablePrescriptionView() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [visit,   setVisit]   = useState(null);
  const [patient, setPatient] = useState(null);
  const [clinic,  setClinic]  = useState(null);
  const [error,   setError]   = useState("");

  useEffect(() => {
    const vr = getVisit(id);
    if (!vr.success) { setError(vr.error.message); return; }
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
      return () => {
        document.title = originalTitle;
      };
    }
  }, [patient, visit]);

  if (error) {
    return (
      <div className="p-lg text-center text-error font-body-md">
        {error} —{" "}
        <button className="underline text-primary" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }
  if (!visit || !patient) {
    return <div className="p-lg text-center text-outline">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-white p-md flex flex-col items-center">
      {/* Print / Back controls — hidden in print */}
      <div className="no-print flex gap-sm mb-lg w-full max-w-2xl">
        <button id="back-from-print" onClick={() => navigate(-1)} className="btn-secondary">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
        <button id="print-btn" onClick={() => window.open(`/print/prescription/${id}`, '_blank')} className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">print</span>
          Print
        </button>
      </div>

      {/* Printable A4-like card */}
      <div className="print-page w-full max-w-2xl bg-white border border-outline-variant rounded-2xl shadow-xl p-xl flex flex-col gap-lg">

        {/* Letterhead */}
        <header className="flex items-start justify-between border-b-2 border-primary pb-md">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-primary">
              {clinic?.name || "Clinic"}
            </h1>
            {clinic?.address && (
              <p className="font-body-sm text-body-sm text-outline mt-1">{clinic.address}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-label-md text-label-md text-outline uppercase">Prescription</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{formatDate(visit.visit_date)}</p>
          </div>
        </header>

        {/* Patient Info */}
        <section className="flex gap-lg flex-wrap">
          <div>
            <p className="font-label-md text-label-md text-outline uppercase mb-xs">Patient</p>
            <p className="font-body-lg text-body-lg font-semibold text-on-surface">{patient.full_name}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Age: {formatPatientAge(patient)} &bull; {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "—"}
            </p>
          </div>
          {visit.diagnosis && (
            <div>
              <p className="font-label-md text-label-md text-outline uppercase mb-xs">Diagnosis</p>
              <p className="font-body-md text-body-md font-semibold text-on-surface">{visit.diagnosis}</p>
            </div>
          )}
        </section>

        {/* Medicines Table */}
        <section>
          <p className="font-label-md text-label-md text-outline uppercase mb-sm tracking-wider">
            Rx — Medicines Prescribed
          </p>
          {visit.prescription_items?.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="font-label-md text-label-md text-outline pb-2 pr-4">Medicine</th>
                  <th className="font-label-md text-label-md text-outline pb-2 pr-4">Dosage</th>
                  <th className="font-label-md text-label-md text-outline pb-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {visit.prescription_items.map((rx, i) => (
                  <tr key={rx.id} className={i % 2 === 0 ? "bg-surface-container-low/40" : ""}>
                    <td className="font-body-md text-body-md font-semibold text-on-surface py-2 pr-4">{rx.medicine_name}</td>
                    <td className="font-body-sm text-body-sm text-on-surface-variant py-2 pr-4">{rx.dosage}</td>
                    <td className="font-body-sm text-body-sm text-on-surface-variant py-2">{rx.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="font-body-sm text-body-sm text-outline">No medicines prescribed.</p>
          )}
        </section>

        {/* Notes */}
        {visit.notes && (
          <section>
            <p className="font-label-md text-label-md text-outline uppercase mb-xs">Notes</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant italic">{visit.notes}</p>
          </section>
        )}

        {/* Follow-up */}
        {visit.follow_up_date && (
          <section className="flex items-center gap-2 text-on-surface font-body-sm text-body-sm">
            <span className="material-symbols-outlined text-[16px] text-primary">event_available</span>
            <strong>Follow-up:</strong> {formatDate(visit.follow_up_date)}
          </section>
        )}

        {/* Billing Breakdown */}
        <section className="border-t border-outline-variant/40 pt-md">
          <p className="font-label-md text-label-md text-outline uppercase mb-sm tracking-wider">Billing Breakdown</p>
          <div className="flex flex-col gap-1 font-body-sm text-body-sm text-on-surface-variant">
            <div className="flex justify-between">
              <span>Consultation Fee</span>
              <span>Rs. {clinic?.default_consultation_fee || 800}</span>
            </div>
            {visit.services?.map((ser) => (
              <div key={ser.id} className="flex justify-between">
                <span>{ser.service_name}</span>
                <span>Rs. {ser.price}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-on-surface border-t border-outline-variant/30 pt-1 mt-1 text-body-md">
              <span>Total Amount Paid</span>
              <span>Rs. {visit.fee_amount}</span>
            </div>
          </div>
        </section>

        {/* Signature line */}
        <footer className="flex justify-end mt-xl pt-md border-t border-outline-variant/40">
          <div className="text-center">
            <div className="w-40 h-px bg-on-surface mb-xs" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">Doctor's Signature</p>
          </div>
        </footer>
      </div>

      {/* 80mm Thermal Receipt Layout (Hidden on Screen, Visible on Print) */}
      <div className="print-receipt-only">
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
            Age: {formatPatientAge(patient)} &bull; {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "—"}
          </div>
          {visit.diagnosis && (
            <div className="mt-xs">
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
    </div>
  );
}
