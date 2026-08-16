import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { dbClinic, dbUsers, dbClinicServices, exportFullDatabase, importFullDatabase, resetDatabaseToDemoData } from "../api/db.js";

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
        backup_email: c.backup_email || "",
        backup_frequency: c.backup_frequency || "daily",
        resend_api_key: c.resend_api_key || "",
        emailjs_service_id: c.emailjs_service_id || "",
        emailjs_template_id: c.emailjs_template_id || "",
        emailjs_public_key: c.emailjs_public_key || "",
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
    <div className="p-3 sm:p-5 md:p-8 flex flex-col gap-lg max-w-4xl mx-auto w-full">
      <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Clinic Settings</h1>

      {/* Clinic Info Section — Restricted strictly to Principal Owner Doctor */}
      {user?.is_owner ? (
        <section className="glass-card p-lg flex flex-col gap-md">
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">Clinic Setup &amp; Branding</h2>
          <form id="clinic-info-form" onSubmit={handleClinicSave} className="flex flex-col gap-sm" noValidate>
            <div className="flex flex-col gap-xs">
              <label htmlFor="clinic-name" className="font-label-md text-label-md text-on-surface-variant">Clinic Name</label>
              <input
                id="clinic-name"
                name="name"
                type="text"
                value={clinicForm.name}
                onChange={handleClinicChange}
                placeholder="Dr. Asif Ashraf's Clinic"
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
                placeholder="Lajpat Road, Hyderabad"
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
      ) : (
        <section className="glass-card p-md flex items-center justify-between bg-teal-50/50 border border-teal-100">
          <div>
            <div className="font-bold text-gray-900 text-sm">{clinicForm.name || "ClinicFlow"}</div>
            <div className="text-xs text-gray-500">{clinicForm.address}</div>
          </div>
          <span className="text-xs font-bold text-teal-800 bg-teal-100 px-3 py-1 rounded-full">
            Registered Clinic Facility
          </span>
        </section>
      )}

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
              placeholder="Dr. Asif Ashraf"
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
              placeholder="dr.asif@example.com"
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
          {user?.is_owner && (
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
          )}
        </div>

        {user?.is_owner && showServiceForm && (
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
                {user?.is_owner && (
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
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Staff Accounts Section (CRUD) — Restricted strictly to Principal Owner Doctor */}
      {user?.is_owner && (
        <section className="glass-card p-lg flex flex-col gap-md">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">Staff Accounts &amp; Permissions</h2>
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
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">Email</label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  placeholder="email@clinicflow.com"
                  className="input-field"
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">Phone Number</label>
                <input
                  type="tel"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  placeholder="03001234567"
                  className="input-field"
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">System Role</label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="input-field"
                >
                  <option value="receptionist">Receptionist / Front Desk</option>
                  <option value="doctor">Doctor / Consultant</option>
                  <option value="pharmacist">Pharmacist / Store Staff</option>
                </select>
              </div>

              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">Account Password</label>
                <input
                  type="password"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  placeholder="Leave blank to keep unchanged"
                  className="input-field"
                />
              </div>

              {staffError && (
                <p className="font-body-sm text-body-sm text-error">{staffError}</p>
              )}

              <div className="flex justify-end gap-xs mt-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffForm(false);
                    setEditingStaff(null);
                  }}
                  className="btn-pill"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill">
                  {editingStaff ? "Save Changes" : "Create Account"}
                </button>
              </div>
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
                    {s.is_owner ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        ⭐ Principal Owner
                      </span>
                    ) : (
                      <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={!!s.can_view_financials}
                          onChange={() => {
                            const updatedVal = !s.can_view_financials;
                            dbUsers.update(s.id, { can_view_financials: updatedVal });
                            setStaff(dbUsers.getAll());
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span>📊 Financial Reports Access</span>
                      </label>
                    )}
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
      )}

      {/* Database Backup, Disaster Recovery & Local Data Management (Owner / Doctor Access) */}
      {(user?.is_owner || user?.role === "doctor") && (
        <section className="bg-gradient-to-br from-slate-900 to-teal-950 text-white rounded-3xl p-6 shadow-xl border border-teal-800 space-y-4">
          <div className="flex items-center justify-between border-b border-teal-800/80 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-teal-400 text-2xl">cloud_sync</span>
              <div>
                <h3 className="font-bold text-lg leading-tight">Database Backup &amp; Disaster Recovery</h3>
                <p className="text-xs text-teal-200/80">Protect your clinic against data loss, PC crash or browser cache clearing</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Automated Email Backup Configuration */}
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10 space-y-3 col-span-1 md:col-span-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h4 className="font-bold text-sm text-teal-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">mark_email_unread</span>
                    Automated Email Backup Dispatch Settings
                  </h4>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Configure your primary email address for automatic 24-Hour / Weekly / Monthly clinic database backups.
                  </p>
                </div>
                {clinic?.last_email_backup && (
                  <span className="text-[11px] bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-lg border border-teal-500/40 font-mono">
                    Last Sent: {new Date(clinic.last_email_backup).toLocaleString("en-PK")}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label htmlFor="backup_email" className="block text-xs font-bold text-teal-200 mb-1">Target Backup Email(s) *</label>
                  <input
                    id="backup_email"
                    type="text"
                    placeholder="dr.asif@gmail.com, partner@gmail.com"
                    value={clinicForm.backup_email || ""}
                    onChange={(e) => setClinicForm({ ...clinicForm, backup_email: e.target.value })}
                    className="w-full border border-teal-700 bg-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold"
                  />
                  <span className="text-[10px] text-teal-300/70">Single email or multiple comma-separated emails</span>
                </div>

                <div>
                  <label htmlFor="backup_frequency" className="block text-xs font-bold text-teal-200 mb-1">Automatic Schedule</label>
                  <select
                    id="backup_frequency"
                    value={clinicForm.backup_frequency || "daily"}
                    onChange={(e) => setClinicForm({ ...clinicForm, backup_frequency: e.target.value })}
                    className="w-full border border-teal-700 bg-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="daily">⏰ Every 24 Hours (Daily Night Backup)</option>
                    <option value="weekly">📅 Every Week (Weekly Backup)</option>
                    <option value="monthly">🗓️ Every Month (Monthly Backup)</option>
                    <option value="manual">🖐️ Manual Dispatch Only</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!clinicForm.backup_email?.trim()) {
                        alert("Please enter a valid backup email address first.");
                        return;
                      }
                      
                      // Save settings first
                      dbClinic.update({
                        backup_email: clinicForm.backup_email.trim(),
                        backup_frequency: clinicForm.backup_frequency || "daily",
                        resend_api_key: clinicForm.resend_api_key?.trim() || "",
                        emailjs_service_id: clinicForm.emailjs_service_id?.trim() || "",
                        emailjs_template_id: clinicForm.emailjs_template_id?.trim() || "",
                        emailjs_public_key: clinicForm.emailjs_public_key?.trim() || "",
                        last_email_backup: new Date().toISOString()
                      });

                      const backup = exportFullDatabase();
                      const backupStr = JSON.stringify(backup, null, 2);

                      // Always trigger local JSON file download safeguard
                      const blob = new Blob([backupStr], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `ClinicFlow_Backup_${new Date().toISOString().split("T")[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);

                      const targetEmails = clinicForm.backup_email.split(",").map((e) => e.trim()).filter(Boolean);

                      // Option A: If Resend API Key is provided, send real .json attachment via Resend API!
                      if (clinicForm.resend_api_key?.trim()) {
                        try {
                          const base64Content = btoa(unescape(encodeURIComponent(backupStr)));
                          const resendPayload = {
                            from: "ClinicFlow Backup <onboarding@resend.dev>",
                            to: targetEmails,
                            subject: `🏥 ClinicFlow Full Database Backup - ${clinicForm.name || "Clinic"} (${new Date().toLocaleDateString("en-PK")})`,
                            html: `
                              <div style="font-family: sans-serif; padding: 20px; background: #f8fafc; border-radius: 12px;">
                                <h2 style="color: #0f766e;">🏥 ClinicFlow Full Database Backup</h2>
                                <p><strong>Clinic:</strong> ${clinicForm.name || "ClinicFlow Clinic"}</p>
                                <p><strong>Date & Time:</strong> ${new Date().toLocaleString("en-PK")}</p>
                                <p><strong>Summary:</strong> Patients: ${backup.data.patients?.length || 0} | Sales: ${backup.data.sales?.length || 0} | Purchases: ${backup.data.purchases?.length || 0}</p>
                                <p style="background: #e0f2fe; color: #0369a1; padding: 12px; border-radius: 8px; font-weight: bold;">
                                  📎 Your full un-truncated database backup is attached to this email as a <code>.json</code> file!
                                </p>
                              </div>
                            `,
                            attachments: [
                              {
                                filename: `ClinicFlow_Backup_${new Date().toISOString().split("T")[0]}.json`,
                                content: base64Content
                              }
                            ]
                          };

                          const res = await fetch("https://api.resend.com/emails", {
                            method: "POST",
                            headers: {
                              "Authorization": `Bearer ${clinicForm.resend_api_key.trim()}`,
                              "Content-Type": "application/json"
                            },
                            body: JSON.stringify(resendPayload)
                          });

                          if (res.ok) {
                            alert(`✅ Resend API Success! Full Database Backup .json attachment silently delivered to inbox (${targetEmails.join(", ")}).`);
                          } else {
                            const errTxt = await res.text();
                            alert(`⚠️ Resend HTTP error (${res.status}): ${errTxt}. Local backup JSON was downloaded.`);
                          }
                        } catch (err) {
                          alert(`⚠️ Resend Dispatch Error: ${err.message}. Local backup JSON was downloaded.`);
                        }
                      } 
                      // Option B: Fallback to EmailJS API if configured
                      else if (clinicForm.emailjs_service_id && clinicForm.emailjs_template_id && clinicForm.emailjs_public_key) {
                        try {
                          const payload = {
                            service_id: clinicForm.emailjs_service_id.trim(),
                            template_id: clinicForm.emailjs_template_id.trim(),
                            user_id: clinicForm.emailjs_public_key.trim(),
                            template_params: {
                              to_email: clinicForm.backup_email.trim(),
                              clinic_name: clinicForm.name || "ClinicFlow Clinic",
                              backup_date: new Date().toLocaleString("en-PK"),
                              backup_summary: `Patients: ${backup.data.patients?.length || 0}, Sales: ${backup.data.sales?.length || 0}, Purchases: ${backup.data.purchases?.length || 0}`,
                              backup_json: backupStr.slice(0, 30000)
                            }
                          };

                          const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                          });

                          if (res.ok) {
                            alert(`✅ EmailJS Success! Database Backup summary delivered to inbox (${clinicForm.backup_email}).`);
                          } else {
                            const errTxt = await res.text();
                            alert(`⚠️ EmailJS HTTP error (${res.status}): ${errTxt}. Local backup JSON was downloaded.`);
                          }
                        } catch (err) {
                          alert(`⚠️ EmailJS Dispatch Error: ${err.message}. Local backup JSON was downloaded.`);
                        }
                      } else {
                        alert(`📧 Backup generated & downloaded to PC! Add your free Resend API Key (re_...) below to enable 100% direct .json file attachment delivery to ${clinicForm.backup_email}.`);
                      }

                      if (refreshClinic) refreshClinic();
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                    Send Instant Email Backup Now
                  </button>
                </div>
              </div>

              {/* API Credentials for Direct Cloud Inbox File Attachment Delivery */}
              <div className="pt-2 border-t border-teal-800/50 space-y-2">
                <div className="text-xs font-bold text-teal-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">key</span>
                  Recommended: Resend.com API Key (For Direct .json File Attachment Inbox Delivery)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-4 bg-teal-950/60 p-2.5 rounded-xl border border-teal-800/80">
                    <label htmlFor="resend_api_key" className="block text-xs font-bold text-teal-200 mb-1 flex items-center justify-between">
                      <span>Resend.com API Key (Free 3,000 Emails/Month with .json File Attachments)</span>
                      <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-[10px] text-teal-400 hover:underline">Get Free Key at Resend.com ➔</a>
                    </label>
                    <input
                      id="resend_api_key"
                      type="password"
                      placeholder="re_123456789_abcdef..."
                      value={clinicForm.resend_api_key || ""}
                      onChange={(e) => setClinicForm({ ...clinicForm, resend_api_key: e.target.value })}
                      className="w-full border border-teal-700 bg-slate-900 text-teal-200 font-mono text-xs rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Export Backup Card */}
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10 space-y-3">
              <div>
                <h4 className="font-bold text-sm text-teal-200 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">download</span>
                  1-Click Export Database Backup
                </h4>
                <p className="text-xs text-gray-300 mt-1">
                  Download all Patients, Visits, Prescriptions, Pharmacy Sales, Stock &amp; Khata Ledgers into a timestamped JSON file.
                </p>
              </div>
              <button
                onClick={() => {
                  const backup = exportFullDatabase();
                  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `ClinicFlow_Backup_${new Date().toISOString().split("T")[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  alert("✅ Database Backup downloaded successfully! Keep this file in a safe folder / USB.");
                }}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Download Backup (.json)
              </button>
            </div>

            {/* Restore Backup Card */}
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10 space-y-3">
              <div>
                <h4 className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  Restore / Import Backup File
                </h4>
                <p className="text-xs text-gray-300 mt-1">
                  Restore all database records from a previously saved ClinicFlow backup file.
                </p>
              </div>
              <label className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md text-center">
                <span className="material-symbols-outlined text-base">upload</span>
                Select Backup File to Restore
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const parsed = JSON.parse(event.target.result);
                        if (confirm(`⚠️ Restore Database from ${file.name}?\n\nThis will replace current data with the backup contents. Proceed?`)) {
                          importFullDatabase(parsed);
                          alert("✅ Database restored successfully! Reloading page...");
                          window.location.reload();
                        }
                      } catch (err) {
                        alert("❌ Error restoring backup: Invalid JSON file format.");
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-teal-800/60 flex justify-between items-center flex-wrap gap-2 text-xs">
            <span className="text-gray-400">Want to reset test records back to default demo data?</span>
            <button
              onClick={() => {
                if (confirm("⚠️ Are you sure you want to RESET all data back to clean factory demo state? All custom added patients and sales will be reset!")) {
                  resetDatabaseToDemoData();
                  alert("Factory reset complete. Reloading app...");
                  window.location.reload();
                }
              }}
              className="bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 px-3 py-1.5 rounded-xl font-bold transition-colors"
            >
              Reset to Factory Demo Data
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
