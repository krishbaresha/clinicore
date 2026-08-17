import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPatient } from "../api/patients.js";

export default function AddNewPatient() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    relation_type: "father",
    relation_name: "",
    phone: "",
    age: "",
    gender: "male",
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
        className="flex items-center gap-1 text-primary font-body-sm text-body-sm hover:underline self-start font-bold"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Patients
      </button>

      <div className="glass-card p-6 md:p-8 rounded-3xl flex flex-col gap-md">
        <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Add New Patient</h1>

        <form id="add-patient-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {/* Full Name */}
          <div className="flex flex-col gap-xs">
            <label htmlFor="full_name" className="font-label-md text-label-md text-on-surface-variant font-bold">
              Patient Full Name <span className="text-error">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              placeholder="e.g. Muhammad Bilal"
              value={form.full_name}
              onChange={handleChange}
              required
              className="input-field font-semibold"
            />
          </div>

          {/* Relation S/O, W/O, D/O */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-xs sm:col-span-1">
              <label htmlFor="relation_type" className="font-label-md text-label-md text-on-surface-variant font-bold">
                Relation Type
              </label>
              <select
                id="relation_type"
                name="relation_type"
                value={form.relation_type}
                onChange={handleChange}
                className="input-field font-semibold bg-gray-50"
              >
                <option value="father">S/O (Son/Daughter)</option>
                <option value="husband">W/O (Wife of)</option>
                <option value="wife">H/O (Husband of)</option>
                <option value="mother">D/O (Mother)</option>
              </select>
            </div>
            <div className="flex flex-col gap-xs sm:col-span-2">
              <label htmlFor="relation_name" className="font-label-md text-label-md text-on-surface-variant font-bold">
                Father / Guardian / Husband Name
              </label>
              <input
                id="relation_name"
                name="relation_name"
                type="text"
                placeholder="e.g. Abdul Rasheed"
                value={form.relation_name}
                onChange={handleChange}
                className="input-field"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-xs">
            <label htmlFor="phone" className="font-label-md text-label-md text-on-surface-variant font-bold">
              Phone Number <span className="text-error">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="03XXXXXXXXX"
              value={form.phone}
              onChange={handleChange}
              required
              className="input-field font-mono"
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
