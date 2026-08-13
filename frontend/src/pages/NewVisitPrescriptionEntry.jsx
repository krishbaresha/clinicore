import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createVisit } from "../api/visits.js";
import { getPatient, getPatients } from "../api/patients.js";
import { getInventory } from "../api/store.js";
import { dbClinic, dbClinicServices } from "../api/db.js";

const EMPTY_MEDICINE = { medicine_name: "", dosage: "", duration: "", quantity: "" };

function calculateDefaultQty(dosage, duration) {
  if (!dosage || !duration) return "";
  const d = dosage.toLowerCase();
  let multiplier = 1;
  if (d.includes("1-1-1") || d.includes("3 time") || d.includes("tds") || d.includes("three")) {
    multiplier = 3;
  } else if (d.includes("1-0-1") || d.includes("2 time") || d.includes("bd") || d.includes("twice") || d.includes("two")) {
    multiplier = 2;
  } else if (d.includes("1-0-0") || d.includes("0-0-1") || d.includes("0-1-0") || d.includes("daily") || d.includes("once") || d.includes("od")) {
    multiplier = 1;
  }

  const dur = duration.toLowerCase();
  const match = dur.match(/\d+/);
  let days = 1;
  if (match) {
    days = parseInt(match[0]);
    if (dur.includes("week")) days *= 7;
    else if (dur.includes("month")) days *= 30;
  }
  return multiplier * days;
}

export default function NewVisitPrescriptionEntry() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const prefillId      = params.get("patient_id") || "";

  const [patientQuery, setPatientQuery]   = useState("");
  const [patients,     setPatients]       = useState([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [focusedRow, setFocusedRow] = useState(null);
  const [patientActiveIdx, setPatientActiveIdx] = useState(-1);
  const [medActiveIdx, setMedActiveIdx] = useState(-1);

  // Clinic Services Catalog States
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [baseFee, setBaseFee] = useState(800);

  const [form, setForm] = useState({
    patient_id:     prefillId,
    symptoms:       "",
    diagnosis:      "",
    fee_amount:     "800",
    follow_up_date: new Date().toISOString().split("T")[0],
    notes:          "",
  });
  const [medicines, setMedicines] = useState([{ ...EMPTY_MEDICINE }]);
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);

  // Prefill patient name if coming from profile
  useEffect(() => {
    if (prefillId) {
      const r = getPatient(prefillId);
      if (r.success) setSelectedPatient(r.data);
    }
  }, [prefillId]);

  // Load store inventory and clinic default fee/services on mount
  useEffect(() => {
    const r = getInventory();
    if (r.success) setInventory(r.data);

    const c = dbClinic.get();
    const defaultFee = c?.default_consultation_fee ?? 800;
    setBaseFee(defaultFee);
    setForm((f) => ({ ...f, fee_amount: defaultFee.toString() }));

    setAvailableServices(dbClinicServices.getAll());
  }, []);

  // Search patients for the dropdown
  useEffect(() => {
    if (!patientQuery.trim()) { setPatients([]); return; }
    const r = getPatients();
    if (r.success) {
      const q = patientQuery.toLowerCase();
      setPatients(r.data.filter((p) => p.full_name.toLowerCase().includes(q) || p.phone.includes(q)).slice(0, 8));
    }
  }, [patientQuery]);

  // Reset active patient index on new results
  useEffect(() => {
    setPatientActiveIdx(-1);
  }, [patients]);

  function selectPatient(p) {
    setSelectedPatient(p);
    setForm((f) => ({ ...f, patient_id: p.id }));
    setPatientQuery(p.full_name);
    setShowDropdown(false);
  }

  function handlePatientKeyDown(e) {
    if (!showDropdown || patients.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPatientActiveIdx((prev) => (prev + 1) % patients.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPatientActiveIdx((prev) => (prev - 1 + patients.length) % patients.length);
    } else if (e.key === "Enter") {
      if (patientActiveIdx >= 0 && patientActiveIdx < patients.length) {
        e.preventDefault();
        selectPatient(patients[patientActiveIdx]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setPatientActiveIdx(-1);
    }
  }

  function handleMedicineKeyDown(idx, e, suggestions) {
    if (focusedRow !== idx || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMedActiveIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMedActiveIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      if (medActiveIdx >= 0 && medActiveIdx < suggestions.length) {
        e.preventDefault();
        const item = suggestions[medActiveIdx];
        const updated = medicines.map((m, i) => {
          if (i === idx) {
            const next = { ...m, medicine_name: item.medicine_name };
            next.quantity = calculateDefaultQty(next.dosage, next.duration);
            return next;
          }
          return m;
        });
        setMedicines(updated);
        setFocusedRow(null);
        setMedActiveIdx(-1);
      }
    } else if (e.key === "Escape") {
      setFocusedRow(null);
      setMedActiveIdx(-1);
    }
  }

  function handleServiceToggle(service) {
    const isSelected = selectedServices.some((s) => s.id === service.id);
    let updated;
    if (isSelected) {
      updated = selectedServices.filter((s) => s.id !== service.id);
    } else {
      updated = [...selectedServices, service];
    }
    setSelectedServices(updated);

    // Sum services rates and update Grand Total dynamically
    const servicesTotal = updated.reduce((sum, s) => sum + s.price, 0);
    const newTotal = baseFee + servicesTotal;
    setForm((f) => ({ ...f, fee_amount: newTotal.toString() }));
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleMedicineChange(index, e) {
    const updated = medicines.map((m, i) => {
      if (i === index) {
        const next = { ...m, [e.target.name]: e.target.value };
        // Recalculate quantity if name or dosage/duration changed
        next.quantity = calculateDefaultQty(next.dosage, next.duration);
        return next;
      }
      return m;
    });
    setMedicines(updated);
    // Reset selection index when query changes
    if (e.target.name === "medicine_name") {
      setMedActiveIdx(-1);
    }
  }

  function addMedicine()       { setMedicines([...medicines, { ...EMPTY_MEDICINE }]); }
  function removeMedicine(idx) { if (medicines.length > 1) setMedicines(medicines.filter((_, i) => i !== idx)); }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.patient_id) { setError("Please select a patient."); return; }
    const validMedicines = medicines.filter((m) => m.medicine_name.trim());
    setLoading(true);
    const result = createVisit({ ...form, medicines: validMedicines, services: selectedServices });
    setLoading(false);
    if (result.success) {
      navigate(`/visits/${result.data.id}/print`);
    } else {
      setError(result.error.message);
    }
  }

  return (
    <div className="p-md md:p-lg flex flex-col gap-lg max-w-2xl">
      {/* Back */}
      <button
        id="back-from-new-visit"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-primary font-body-sm text-body-sm hover:underline self-start"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </button>

      <div className="glass-card p-lg flex flex-col gap-md">
        <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">New Visit / Prescription Entry</h1>

        <form id="new-visit-form" onSubmit={handleSubmit} className="flex flex-col gap-sm" noValidate>

          {/* Patient selector */}
          <div className="flex flex-col gap-xs relative">
            <label htmlFor="patient-search" className="font-label-md text-label-md text-on-surface-variant">
              Patient <span className="text-error">*</span>
            </label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 bg-secondary-container/20 border border-secondary-container rounded-lg">
                <div>
                  <p className="font-body-md text-body-md font-semibold text-on-surface">{selectedPatient.full_name}</p>
                  <p className="font-body-sm text-body-sm text-outline">{selectedPatient.phone} · Age {selectedPatient.age ?? "—"}</p>
                </div>
                <button type="button" onClick={() => { setSelectedPatient(null); setForm((f) => ({ ...f, patient_id: "" })); setPatientQuery(""); }}
                  className="text-outline hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  id="patient-search"
                  type="text"
                  placeholder="Search patient by name or phone…"
                  value={patientQuery}
                  onChange={(e) => { setPatientQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => { setShowDropdown(true); setPatientActiveIdx(-1); }}
                  onKeyDown={handlePatientKeyDown}
                  className="input-field"
                />
                {showDropdown && patients.length > 0 && (
                  <ul className="absolute top-full left-0 w-full bg-white border border-outline-variant rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {patients.map((p, index) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onMouseDown={() => selectPatient(p)}
                          className={`w-full text-left px-4 py-3 font-body-sm text-body-sm text-on-surface ${
                            index === patientActiveIdx ? "bg-primary-container/20 font-semibold text-primary" : "hover:bg-surface-container-low"
                          }`}
                        >
                          <span className="font-semibold">{p.full_name}</span>
                          <span className="text-outline ml-2">{p.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Symptoms */}
          <div className="flex flex-col gap-xs">
            <label htmlFor="symptoms" className="font-label-md text-label-md text-on-surface-variant">Symptoms</label>
            <textarea id="symptoms" name="symptoms" rows={2} placeholder="Fever, sore throat…"
              value={form.symptoms} onChange={handleFormChange} className="input-field resize-none" />
          </div>

          {/* Diagnosis */}
          <div className="flex flex-col gap-xs">
            <label htmlFor="diagnosis" className="font-label-md text-label-md text-on-surface-variant">Diagnosis</label>
            <input id="diagnosis" name="diagnosis" type="text" placeholder="Viral flu"
              value={form.diagnosis} onChange={handleFormChange} className="input-field" />
          </div>

          {/* Medicines */}
          <div className="flex flex-col gap-xs">
            <div className="flex items-center justify-between">
              <p className="font-label-md text-label-md text-on-surface-variant">Medicines</p>
              <button type="button" onClick={addMedicine}
                className="flex items-center gap-1 text-primary font-body-sm text-body-sm hover:underline">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Medicine
              </button>
            </div>
            {medicines.map((med, idx) => {
              const searchVal = med.medicine_name || "";
              const suggestions = searchVal.trim()
                ? inventory.filter((item) =>
                    item.medicine_name.toLowerCase().includes(searchVal.toLowerCase())
                  ).slice(0, 5)
                : [];

              return (
                <div key={idx} id={`medicine-row-${idx}`}
                  className="flex flex-col gap-xs p-md bg-surface-container-low rounded-lg relative border border-outline-variant/30">
                  
                  {/* Medicine Name input with suggestions */}
                  <div className="flex flex-col gap-xs relative flex-1">
                    <label className="font-label-md text-label-md text-on-surface-variant">Medicine Name</label>
                    <input
                      type="text"
                      name="medicine_name"
                      placeholder="Medicine name"
                      value={med.medicine_name}
                      onChange={(e) => handleMedicineChange(idx, e)}
                      onFocus={() => { setFocusedRow(idx); setMedActiveIdx(-1); }}
                      onBlur={() => setTimeout(() => { setFocusedRow(null); setMedActiveIdx(-1); }, 250)}
                      onKeyDown={(e) => handleMedicineKeyDown(idx, e, suggestions)}
                      className="input-field w-full"
                      autoComplete="off"
                    />
                    {focusedRow === idx && suggestions.length > 0 && (
                      <ul className="absolute top-full left-0 w-full bg-white border border-outline-variant rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto mt-1">
                        {suggestions.map((item, sIdx) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onMouseDown={() => {
                                const updated = medicines.map((m, i) => {
                                  if (i === idx) {
                                    const next = { ...m, medicine_name: item.medicine_name };
                                    next.quantity = calculateDefaultQty(next.dosage, next.duration);
                                    return next;
                                  }
                                  return m;
                                });
                                setMedicines(updated);
                              }}
                              className={`w-full text-left px-4 py-2 font-body-sm text-body-sm text-on-surface flex justify-between items-center ${
                                sIdx === medActiveIdx ? "bg-primary-container/20 font-semibold text-primary" : "hover:bg-primary-container/10"
                              }`}
                            >
                              <span className="font-semibold">{item.medicine_name}</span>
                              <span className={`text-xs ${item.stock_qty <= item.low_stock_threshold ? "text-error font-bold" : "text-outline"}`}>
                                Stock: {item.stock_qty}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Dosage, Duration, Quantity */}
                  <div className="flex flex-col md:flex-row gap-sm items-start w-full">
                    {/* Dosage */}
                    <div className="flex flex-col gap-xs flex-1 w-full">
                      <label className="font-label-md text-label-md text-on-surface-variant">Dosage</label>
                      <input
                        type="text"
                        name="dosage"
                        placeholder="Dosage"
                        value={med.dosage}
                        onChange={(e) => {
                          const updated = medicines.map((m, i) => {
                            if (i === idx) {
                              const next = { ...m, dosage: e.target.value };
                              next.quantity = calculateDefaultQty(e.target.value, next.duration);
                              return next;
                            }
                            return m;
                          });
                          setMedicines(updated);
                        }}
                        className="input-field w-full"
                      />
                      {/* Presets */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {["1-0-1", "1-1-1", "1-0-0", "0-0-1", "S.O.S"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              const updated = medicines.map((m, i) => {
                                if (i === idx) {
                                  const next = { ...m, dosage: preset };
                                  next.quantity = calculateDefaultQty(preset, next.duration);
                                  return next;
                                  }
                                  return m;
                              });
                              setMedicines(updated);
                            }}
                            className="px-2 py-0.5 bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-xs rounded transition-colors text-outline font-label-md"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="flex flex-col gap-xs flex-1 w-full">
                      <label className="font-label-md text-label-md text-on-surface-variant">Duration</label>
                      <input
                        type="text"
                        name="duration"
                        placeholder="Duration (e.g. 5 days)"
                        value={med.duration}
                        onChange={(e) => {
                          const updated = medicines.map((m, i) => {
                            if (i === idx) {
                              const next = { ...m, duration: e.target.value };
                              next.quantity = calculateDefaultQty(next.dosage, e.target.value);
                              return next;
                            }
                            return m;
                          });
                          setMedicines(updated);
                        }}
                        className="input-field w-full"
                      />
                    </div>

                    {/* Qty to deduct */}
                    <div className="flex flex-col gap-xs w-full md:w-32">
                      <label className="font-label-md text-label-md text-on-surface-variant">Qty to Deduct</label>
                      <input
                        type="number"
                        name="quantity"
                        placeholder="10"
                        min="0"
                        value={med.quantity}
                        onChange={(e) => {
                          const updated = medicines.map((m, i) => {
                            if (i === idx) {
                              return { ...m, quantity: e.target.value };
                            }
                            return m;
                          });
                          setMedicines(updated);
                        }}
                        className="input-field w-full"
                      />
                    </div>

                    {medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicine(idx)}
                        className="text-error hover:bg-error-container/20 p-2 rounded-full mt-0 md:mt-7 self-end md:self-auto flex items-center justify-center"
                        title="Remove medicine"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Follow-up date + Fee row */}
          <div className="flex flex-col sm:flex-row gap-sm">
            <div className="flex flex-col gap-xs flex-1">
              <label htmlFor="follow_up_date" className="font-label-md text-label-md text-on-surface-variant">
                Follow-up Date
              </label>
              <input id="follow_up_date" name="follow_up_date" type="date"
                value={form.follow_up_date} onChange={handleFormChange} className="input-field" />
            </div>
            <div className="flex flex-col gap-xs flex-1">
              <label htmlFor="fee_amount" className="font-label-md text-label-md text-on-surface-variant">
                Fee Amount (Rs.)
              </label>
              <input id="fee_amount" name="fee_amount" type="number" min="0" placeholder="800"
                value={form.fee_amount} onChange={handleFormChange} className="input-field" />
            </div>
          </div>

          {/* Services Checklist */}
          {availableServices.length > 0 && (
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant">Services &amp; Procedures Performed</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs p-md bg-surface-container-low rounded-lg border border-outline-variant/30">
                {availableServices.map((ser) => {
                  const isChecked = selectedServices.some((s) => s.id === ser.id);
                  return (
                    <label key={ser.id} className="flex items-center gap-xs cursor-pointer font-body-sm text-body-sm text-on-surface">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleServiceToggle(ser)}
                        className="rounded border-outline text-primary focus:ring-primary"
                      />
                      <span>{ser.service_name} (Rs. {ser.price})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-xs">
            <label htmlFor="notes" className="font-label-md text-label-md text-on-surface-variant">Notes</label>
            <textarea id="notes" name="notes" rows={2} placeholder="Advised rest and fluids…"
              value={form.notes} onChange={handleFormChange} className="input-field resize-none" />
          </div>

          {/* Error */}
          {error && <p role="alert" className="text-error font-body-sm text-body-sm">{error}</p>}

          {/* Submit */}
          <div className="flex gap-sm pt-xs">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button id="save-visit-btn" type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Saving…" : "Save Visit"}
              {!loading && <span className="material-symbols-outlined text-[18px]">save</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
