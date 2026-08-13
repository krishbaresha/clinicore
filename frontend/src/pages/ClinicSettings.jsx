import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { dbClinic, dbUsers, dbClinicServices } from "../api/db.js";

export default function ClinicSettings() {
  const { user, clinic, refreshClinic, refreshUser } = useAuth();

  const [clinicForm, setClinicForm] = useState({ name: "", address: "", logo_url: "", default_consultation_fee: "800" });
  const [saved,      setSaved]      = useState(false);
  const [staff,      setStaff]      = useState([]);

  // Services catalog state
  const [services, setServices] = useState([]);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ service_name: "", price: "" });
  const [serviceError, setServiceError] = useState("");

  // Profile fields state
  const [profileForm, setProfileForm] = useState({ name: "", email: "" });
  const [profileSaved, setProfileSaved] = useState(false);

  // Staff CRUD state
  const [editingStaff, setEditingStaff] = useState(null);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", role: "receptionist", phone: "", password: "password" });
  const [staffError, setStaffError] = useState("");

  useEffect(() => {
    const c = dbClinic.get();
    if (c) {
      setClinicForm({
        name: c.name || "",
        address: c.address || "",
        logo_url: c.logo_url || "",
        default_consultation_fee: c.default_consultation_fee?.toString() || "800",
      });
    }
    setStaff(dbUsers.getAll());
    setServices(dbClinicServices.getAll());
    
    // Load current user details
    if (user) {
      const activeUser = dbUsers.getById(user.userId);
      if (activeUser) {
        setProfileForm({ name: activeUser.name || "", email: activeUser.email || "" });
      }
    }
  }, [user]);

  function handleClinicChange(e) {
    setClinicForm({ ...clinicForm, [e.target.name]: e.target.value });
  }

  function handleClinicSave(e) {
    e.preventDefault();
    dbClinic.update({
      name: clinicForm.name.trim(),
      address: clinicForm.address.trim(),
      logo_url: clinicForm.logo_url.trim(),
      default_consultation_fee: parseInt(clinicForm.default_consultation_fee) || 800
    });
    if (refreshClinic) refreshClinic();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleAddService(e) {
    e.preventDefault();
    setServiceError("");
    if (!serviceForm.service_name.trim() || !serviceForm.price.trim()) {
      setServiceError("Please fill out all fields.");
      return;
    }
    dbClinicServices.add({
      service_name: serviceForm.service_name.trim(),
      price: parseFloat(serviceForm.price) || 0
    });
    setServices(dbClinicServices.getAll());
    setServiceForm({ service_name: "", price: "" });
    setShowServiceForm(false);
  }

  function handleDeleteService(id) {
    dbClinicServices.delete(id);
    setServices(dbClinicServices.getAll());
  }

  function roleBadge(role) {
    return role === "doctor"
      ? "bg-primary-container/20 text-primary"
      : "bg-secondary-container text-secondary";
  }

  return (
    <div className="p-md md:p-lg flex flex-col gap-lg max-w-2xl">
      <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Clinic Settings</h1>

      {/* Clinic Info Section */}
      <section className="glass-card p-lg flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">Clinic Info</h2>
        <form id="clinic-info-form" onSubmit={handleClinicSave} className="flex flex-col gap-sm" noValidate>
          <div className="flex flex-col gap-xs">
            <label htmlFor="clinic-name" className="font-label-md text-label-md text-on-surface-variant">Clinic Name</label>
            <input
              id="clinic-name"
              name="name"
              type="text"
              value={clinicForm.name}
              onChange={handleClinicChange}
              placeholder="Dr. Ahmed's Clinic"
              className="input-field"
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="clinic-address" className="font-label-md text-label-md text-on-surface-variant">Address</label>
            <textarea
              id="clinic-address"
              name="address"
              rows={2}
              value={clinicForm.address}
              onChange={handleClinicChange}
              placeholder="Auto Bhan Road, Hyderabad, Sindh, Pakistan"
              className="input-field resize-none"
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="clinic-fee" className="font-label-md text-label-md text-on-surface-variant">Default Consultation Fee (Rs.)</label>
            <input
              id="clinic-fee"
              name="default_consultation_fee"
              type="number"
              min="0"
              value={clinicForm.default_consultation_fee}
              onChange={handleClinicChange}
              placeholder="800"
              className="input-field"
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="clinic-logo" className="font-label-md text-label-md text-on-surface-variant">
              Logo URL{" "}
              <span className="text-outline text-xs font-normal">(optional — used on prescriptions)</span>
            </label>
            <input
              id="clinic-logo"
              name="logo_url"
              type="url"
              value={clinicForm.logo_url}
              onChange={handleClinicChange}
              placeholder="https://…"
              className="input-field"
            />
            {clinicForm.logo_url && (
              <img
                src={clinicForm.logo_url}
                alt="Clinic logo preview"
                className="w-24 h-24 object-contain rounded-lg border border-outline-variant mt-1"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            )}
          </div>
          {saved && (
            <p role="status" className="text-secondary font-body-sm text-body-sm">
              ✓ Clinic info saved.
            </p>
          )}
          <button id="save-clinic-btn" type="submit" className="btn-primary self-start">
            <span className="material-symbols-outlined text-[18px]">save</span>
            Save Clinic Info
          </button>
        </form>
      </section>

      {/* Doctor Profile Section */}
      <section className="glass-card p-lg flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">Doctor / Profile Info</h2>
        <form
          id="doctor-profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            const users = JSON.parse(localStorage.getItem("cf_users") || "[]");
            const updated = users.map((u) => {
              if (u.id === user.userId) {
                return { ...u, name: profileForm.name.trim(), email: profileForm.email.trim() };
              }
              return u;
            });
            localStorage.setItem("cf_users", JSON.stringify(updated));
            // Update session storage
            const session = JSON.parse(sessionStorage.getItem("cf_session") || "{}");
            session.name = profileForm.name.trim();
            sessionStorage.setItem("cf_session", JSON.stringify(session));
            // Refresh staff list and global context user state
            setStaff(updated);
            if (refreshUser) refreshUser();
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 3000);
          }}
          className="flex flex-col gap-sm"
          noValidate
        >
          <div className="flex flex-col gap-xs">
            <label htmlFor="doctor-name" className="font-label-md text-label-md text-on-surface-variant">Doctor's Name</label>
            <input
              id="doctor-name"
              name="name"
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              placeholder="Dr. Ahmed Raza"
              className="input-field"
              required
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="doctor-email" className="font-label-md text-label-md text-on-surface-variant">Email Address</label>
            <input
              id="doctor-email"
              name="email"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              placeholder="dr.ahmed@example.com"
              className="input-field"
              required
            />
          </div>
          {profileSaved && (
            <p role="status" className="text-secondary font-body-sm text-body-sm">
              ✓ Profile info saved.
            </p>
          )}
          <button id="save-profile-btn" type="submit" className="btn-primary self-start">
            <span className="material-symbols-outlined text-[18px]">save</span>
            Save Profile Info
          </button>
        </form>
      </section>

      {/* Services Catalog Section */}
      <section className="glass-card p-lg flex flex-col gap-md">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">Services &amp; Procedures Catalog</h2>
          <button
            type="button"
            onClick={() => {
              setServiceForm({ service_name: "", price: "" });
              setShowServiceForm(!showServiceForm);
              setServiceError("");
            }}
            className="btn-pill"
          >
            <span className="material-symbols-outlined text-sm">
              {showServiceForm ? "close" : "add"}
            </span>
            {showServiceForm ? "Cancel" : "Add Service"}
          </button>
        </div>

        {showServiceForm && (
          <form
            onSubmit={handleAddService}
            className="flex flex-col gap-sm p-md bg-surface-container-low rounded-lg"
          >
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Add Clinic Service</h3>
            
            <div className="flex flex-col sm:flex-row gap-sm">
              <div className="flex flex-col gap-xs flex-1">
                <label className="font-label-md text-label-md text-on-surface-variant">Service Name</label>
                <input
                  type="text"
                  value={serviceForm.service_name}
                  onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })}
                  placeholder="ECG, Nebulization, Dressing..."
                  className="input-field"
                  required
                />
              </div>
              <div className="flex flex-col gap-xs w-full sm:w-36">
                <label className="font-label-md text-label-md text-on-surface-variant">Price (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  placeholder="1500"
                  className="input-field"
                  required
                />
              </div>
            </div>
            {serviceError && <p className="text-error font-body-sm text-body-sm">{serviceError}</p>}
            <button type="submit" className="btn-primary self-start mt-xs">
              <span className="material-symbols-outlined text-[18px]">save</span>
              Save Service
            </button>
          </form>
        )}

        {/* Services List */}
        {services.length === 0 ? (
          <p className="font-body-md text-body-md text-outline">No clinic services configured.</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {services.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between p-sm bg-surface-container-low rounded-lg border border-outline-variant/30"
              >
                <div>
                  <p className="font-body-md text-body-md font-semibold text-on-surface">{s.service_name}</p>
                  <p className="font-body-sm text-body-sm text-primary font-bold">Rs. {s.price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete service "${s.service_name}"?`)) {
                      handleDeleteService(s.id);
                    }
                  }}
                  className="text-error hover:bg-error-container/20 p-2 rounded-full flex items-center justify-center"
                  title="Delete"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Staff Accounts Section (CRUD) */}
      <section className="glass-card p-lg flex flex-col gap-md">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">Staff Accounts</h2>
          <button
            type="button"
            onClick={() => {
              setEditingStaff(null);
              setStaffForm({ name: "", email: "", role: "receptionist", phone: "", password: "password" });
              setShowStaffForm(!showStaffForm);
              setStaffError("");
            }}
            className="btn-pill"
          >
            <span className="material-symbols-outlined text-sm">
              {showStaffForm ? "close" : "add"}
            </span>
            {showStaffForm ? "Cancel" : "Add Staff"}
          </button>
        </div>

        {/* Add/Edit Staff Form */}
        {showStaffForm && (
          <form
            id="staff-form"
            onSubmit={(e) => {
              e.preventDefault();
              setStaffError("");
              if (!staffForm.name.trim() || !staffForm.email.trim() || !staffForm.phone.trim()) {
                setStaffError("Please fill out all fields.");
                return;
              }
              const users = JSON.parse(localStorage.getItem("cf_users") || "[]");
              
              if (editingStaff) {
                // Update
                const updated = users.map((u) => {
                  if (u.id === editingStaff.id) {
                    return {
                      ...u,
                      name: staffForm.name.trim(),
                      email: staffForm.email.trim(),
                      phone: staffForm.phone.trim(),
                      role: staffForm.role,
                      password: staffForm.password || "password"
                    };
                  }
                  return u;
                });
                localStorage.setItem("cf_users", JSON.stringify(updated));
                setStaff(updated);
                // If updated user is the active user, refresh their session
                if (editingStaff.id === user.userId) {
                  const session = JSON.parse(sessionStorage.getItem("cf_session") || "{}");
                  session.name = staffForm.name.trim();
                  sessionStorage.setItem("cf_session", JSON.stringify(session));
                  if (refreshUser) refreshUser();
                }
              } else {
                // Create
                const newUser = {
                  id: "user_" + Date.now(),
                  clinic_id: "clinic_001",
                  name: staffForm.name.trim(),
                  email: staffForm.email.trim(),
                  phone: staffForm.phone.trim(),
                  role: staffForm.role,
                  password: staffForm.password || "password"
                };
                const updated = [...users, newUser];
                localStorage.setItem("cf_users", JSON.stringify(updated));
                setStaff(updated);
              }
              setShowStaffForm(false);
              setEditingStaff(null);
            }}
            className="flex flex-col gap-sm p-md bg-surface-container-low rounded-lg"
          >
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              {editingStaff ? "Edit Staff Account" : "Add Staff Account"}
            </h3>
            
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant">Name</label>
              <input
                type="text"
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                placeholder="Staff Member Name"
                className="input-field"
                required
              />
            </div>
            
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant">Email</label>
              <input
                type="email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                placeholder="staff@example.com"
                className="input-field"
                required
              />
            </div>

            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant">Phone</label>
              <input
                type="text"
                value={staffForm.phone}
                onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                placeholder="03001234567"
                className="input-field"
                required
              />
            </div>

            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant">Password</label>
              <input
                type="password"
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                placeholder="Password"
                className="input-field"
                required
              />
            </div>

            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant">Role</label>
              <select
                value={staffForm.role}
                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                className="input-field"
                disabled={editingStaff && editingStaff.id === user?.userId}
              >
                <option value="doctor">Doctor</option>
                <option value="receptionist">Receptionist</option>
              </select>
            </div>

            {staffError && <p className="text-error font-body-sm text-body-sm">{staffError}</p>}

            <button type="submit" className="btn-primary self-start mt-xs">
              <span className="material-symbols-outlined text-[18px]">save</span>
              Save Staff
            </button>
          </form>
        )}

        {/* Staff List */}
        {staff.length === 0 ? (
          <p className="font-body-md text-body-md text-outline">No staff accounts found.</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {staff.map((s) => (
              <li
                key={s.id}
                id={`staff-${s.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-sm gap-sm bg-surface-container-low rounded-lg"
              >
                <div className="flex items-center gap-sm">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {s.name ? s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "??"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-body-md text-body-md font-semibold text-on-surface truncate">{s.name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-sm w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/30">
                  <span className={`px-sm py-1 rounded-full font-label-md text-label-md uppercase shrink-0 ${roleBadge(s.role)}`}>
                    {s.role}
                  </span>
                  <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStaff(s);
                      setStaffForm({
                        name: s.name,
                        email: s.email,
                        role: s.role,
                        phone: s.phone || "",
                        password: s.password || ""
                      });
                      setShowStaffForm(true);
                      setStaffError("");
                    }}
                    className="text-primary hover:text-primary-container p-1"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  {user?.userId !== s.id && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${s.name}?`)) {
                          const users = JSON.parse(localStorage.getItem("cf_users") || "[]");
                          const filtered = users.filter((u) => u.id !== s.id);
                          localStorage.setItem("cf_users", JSON.stringify(filtered));
                          setStaff(filtered);
                        }
                      }}
                      className="text-error hover:text-on-error-container p-1"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
