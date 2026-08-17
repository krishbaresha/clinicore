import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPatient } from "../api/patients.js";

export default function AddNewPatient() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    age: "",
    gender: "",
  });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = createPatient(form);
    setLoading(false);
    if (result.success) {
      navigate(`/patients/${result.data.id}`);
    } else {
      setError(result.error.message);
    }
  }

  return (
    <div className="p-3 sm:p-5 md:p-8 flex flex-col gap-lg max-w-xl mx-auto w-full">
      {/* Back */}
      <button
        id="back-from-add-patient"
        onClick={() => navigate("/patients")}
        className="flex items-center gap-1 text-primary font-body-sm text-body-sm hover:underline self-start"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Patients
      </button>

      <div className="glass-card p-lg flex flex-col gap-md">
        <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Add New Patient</h1>

        <form id="add-patient-form" onSubmit={handleSubmit} className="flex flex-col gap-sm" noValidate>
          {/* Full Name */}
          <div className="flex flex-col gap-xs">
            <label htmlFor="full_name" className="font-label-md text-label-md text-on-surface-variant">
              Full Name <span className="text-error">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              placeholder="Muhammad Bilal"
              value={form.full_name}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-xs">
            <label htmlFor="phone" className="font-label-md text-label-md text-on-surface-variant">
              Phone <span className="text-error">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="03XXXXXXXXX"
              value={form.phone}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>

          {/* Age + Gender row */}
          <div className="flex flex-col sm:flex-row gap-sm">
            <div className="flex flex-col gap-xs flex-1">
              <label htmlFor="age" className="font-label-md text-label-md text-on-surface-variant">Age</label>
              <input
                id="age"
                name="age"
                type="number"
                min="0"
                max="120"
                placeholder="34"
                value={form.age}
                onChange={handleChange}
                className="input-field"
              />
            </div>
            <div className="flex flex-col gap-xs flex-1">
              <label htmlFor="gender" className="font-label-md text-label-md text-on-surface-variant">Gender</label>
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="input-field"
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-error font-body-sm text-body-sm">
              {error}
            </p>
          )}

          {/* Submit */}
          <div className="flex gap-sm pt-xs">
            <button type="button" onClick={() => navigate("/patients")} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button
              id="save-patient-btn"
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? "Saving…" : "Save Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
