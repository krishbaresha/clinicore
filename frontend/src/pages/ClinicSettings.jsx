import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { dbClinic, dbUsers, dbClinicServices, exportFullDatabase, importFullDatabase, clearAllTransactionalData, hashPassword } from "../api/db.js";

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
  const [transferModal, setTransferModal] = useState(null);
  const [transferSuccessMsg, setTransferSuccessMsg] = useState("");

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
            <div className="font-bold text-gray-900 text-sm">{clinicForm.name || "CliniCore"}</div>
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
                      const updatedUser = {
                        ...u,
                        name: staffForm.name.trim(),
                        email: staffForm.email.trim(),
                        phone: staffForm.phone.trim(),
                        role: staffForm.role,
                      };
                      // Only update password if a new one was entered
                      if (staffForm.password.trim()) {
                        updatedUser.password = hashPassword(staffForm.password.trim());
                      }
                      return updatedUser;
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
                  // Create — hash password before storage
                  const newUser = {
                    id: "user_" + Date.now(),
                    clinic_id: "clinic_001",
                    name: staffForm.name.trim(),
                    email: staffForm.email.trim(),
                    phone: staffForm.phone.trim(),
                    role: staffForm.role,
                    password: hashPassword(staffForm.password.trim() || "password")
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
                  <option value="cashier">Cashier / POS Operator</option>
                  <option value="receptionist">Receptionist / Front Desk</option>
                  <option value="doctor">Doctor / Consultant</option>
                  <option value="pharmacist">Pharmacist / Store Staff</option>
                  <option value="salesman">Salesman / Order Booker</option>
                  <option value="admin">Branch Administrator</option>
                </select>
              </div>

              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">Assigned Location / Warehouse</label>
                <select
                  value={staffForm.assigned_warehouse_id || ""}
                  onChange={(e) => setStaffForm({ ...staffForm, assigned_warehouse_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">All Locations / Central Staff</option>
                  <option value="wh_str">Medical Store Counter (POS)</option>
                  <option value="wh_001">Main Godown (Lajpat Road)</option>
                  <option value="wh_002">Secondary Godown (Site Area)</option>
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
              {staff.map((s) => {
                const isInactive = s.status === "inactive" || s.status === "deactivated";
                return (
                  <li
                    key={s.id}
                    id={`staff-${s.id}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-sm gap-sm rounded-xl border transition-all ${
                      isInactive ? "bg-gray-100/70 border-gray-300 opacity-75" : "bg-surface-container-low border-outline-variant/30"
                    }`}
                  >
                    <div className="flex items-center gap-sm">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        isInactive ? "bg-gray-300 text-gray-700" : "bg-secondary-container text-primary"
                      }`}>
                        {s.name ? s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "??"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-body-md text-body-md font-semibold text-on-surface truncate">{s.name}</p>
                          {isInactive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                              Inactive (Soft-Deleted)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{s.email} {s.phone ? `• ${s.phone}` : ""}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-sm w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/30 flex-wrap">
                      {s.is_owner ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          ⭐ Principal Owner (Super Admin)
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
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
                            <span>📊 Financials Access</span>
                          </label>
                        </div>
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
                              assigned_warehouse_id: s.assigned_warehouse_id || "",
                              password: ""
                            });
                            setShowStaffForm(true);
                            setStaffError("");
                          }}
                          className="text-primary hover:text-primary-container p-1 rounded-lg hover:bg-gray-100"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>

                        {user?.userId !== s.id && (
                          <>
                            {isInactive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  dbUsers.reactivate(s.id);
                                  setStaff(dbUsers.getAll());
                                }}
                                className="text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                                title="Re-activate staff member"
                              >
                                <span className="material-symbols-outlined text-sm">replay</span>
                                Re-Activate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Deactivate staff member "${s.name}"? Past records will remain safe, but they will be hidden from new billing dropdowns.`)) {
                                    dbUsers.deactivate(s.id);
                                    setStaff(dbUsers.getAll());
                                  }
                                }}
                                className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                                title="Deactivate (Soft-Delete) staff member"
                              >
                                <span className="material-symbols-outlined text-sm">block</span>
                                Deactivate
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Principal Doctor Transfer Confirmation Modal */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 text-2xl font-bold">
                <span className="material-symbols-outlined text-3xl">workspace_premium</span>
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-lg">Transfer Principal Doctor</h3>
                <p className="text-xs text-gray-500 font-medium">Clinic Ownership &amp; Admin Privileges</p>
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200/80 p-4 rounded-2xl text-xs text-amber-950 space-y-2">
              <p>
                Are you sure you want to designate <strong>{transferModal.name}</strong> as the <strong>Principal Doctor / Clinic Owner</strong>?
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-900 font-medium text-[11px]">
                <li>They will receive full administrative control over clinic settings &amp; branding.</li>
                <li>They will have full access to financial reports &amp; staff permissions.</li>
                <li>You will remain an active Doctor / Consultant in the clinic.</li>
              </ul>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTransferModal(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  dbUsers.setPrincipalDoctor(transferModal.id);
                  setStaff(dbUsers.getAll());
                  const targetName = transferModal.name;
                  setTransferModal(null);
                  setTransferSuccessMsg(`Principal Doctor ownership successfully transferred to ${targetName}!`);
                  if (refreshUser) refreshUser();
                  setTimeout(() => setTransferSuccessMsg(""), 5000);
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-teal-950 py-2.5 rounded-xl font-black text-xs shadow-md shadow-amber-500/25 transition-all flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-base">check</span>
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {transferSuccessMsg && (
        <div className="fixed bottom-6 right-6 bg-teal-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-teal-700 text-xs font-bold flex items-center gap-2 z-50 animate-bounce">
          <span className="material-symbols-outlined text-amber-400 text-base">workspace_premium</span>
          {transferSuccessMsg}
        </div>
      )}

      {/* Services & Procedures Catalog Manager (Live CRUD) */}
      <section className="glass-card p-lg border border-teal-100 shadow-sm rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-teal-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-teal-600 text-2xl bg-teal-50 p-2 rounded-xl">medical_services</span>
            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Clinic Services &amp; Procedures Catalog</h3>
              <p className="text-xs text-gray-500">Configure clinic procedure charges (ECG, Dressing, Nebulization, Blood Tests, etc.) for token billing and EMR notes</p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowServiceForm(!showServiceForm);
              setServiceForm({ service_name: "", price: "" });
              setServiceError("");
            }}
            className="btn-pill bg-teal-600 text-white font-bold text-xs flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add New Service
          </button>
        </div>

        {/* Add Service Form */}
        {showServiceForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!serviceForm.service_name.trim()) {
                setServiceError("Service name is required");
                return;
              }
              if (!serviceForm.price || Number(serviceForm.price) <= 0) {
                setServiceError("Valid service price (Rs.) is required");
                return;
              }
              dbClinicServices.add({
                service_name: serviceForm.service_name.trim(),
                price: Number(serviceForm.price)
              });
              setServices(dbClinicServices.getAll());
              setShowServiceForm(false);
              setServiceForm({ service_name: "", price: "" });
              setServiceError("");
            }}
            className="bg-teal-50/70 p-4 rounded-2xl border border-teal-100 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Service / Procedure Name *</label>
                <input
                  type="text"
                  placeholder="e.g. ECG, Dressing, Blood Test, Ultrasound"
                  value={serviceForm.service_name}
                  onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })}
                  className="input-field text-xs bg-white font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Standard Charge / Price (Rs.) *</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 1500"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  className="input-field text-xs bg-white font-bold"
                />
              </div>
            </div>
            {serviceError && <p className="text-xs text-rose-600 font-bold">{serviceError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowServiceForm(false)}
                className="btn-pill"
              >
                Cancel
              </button>
              <button type="submit" className="btn-pill bg-teal-600 text-white font-bold">
                Save Service
              </button>
            </div>
          </form>
        )}

        {/* Services List */}
        {services.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No custom services added yet. Default clinic services are active.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {services.map((srv) => (
              <div key={srv.id} className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-gray-900">{srv.service_name}</div>
                  <div className="text-xs font-mono font-bold text-teal-700">Rs. {srv.price}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete service "${srv.service_name}"?`)) {
                      dbClinicServices.delete(srv.id);
                      setServices(dbClinicServices.getAll());
                    }
                  }}
                  className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50"
                  title="Delete Service"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Database Backup, Disaster Recovery & Local Data Management (Doctor & Cashier Access) */}
      {(user?.is_owner || user?.role === "doctor" || user?.role === "cashier" || user?.role === "receptionist" || user?.role === "pharmacist") && (
        <section className="glass-card p-lg border-2 border-teal-500/20 shadow-xl rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-teal-100 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-teal-600 text-3xl bg-teal-50 p-2 rounded-2xl border border-teal-100">cloud_sync</span>
              <div>
                <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Database Backup &amp; Disaster Recovery</h3>
                <p className="text-xs text-gray-500">Protect your clinic against data loss, PC crash or browser cache clearing</p>
              </div>
            </div>
            {clinic?.last_email_backup && (
              <span className="text-[11px] bg-teal-50 text-teal-800 px-3 py-1 rounded-xl border border-teal-200 font-mono font-bold">
                Last Backup Sent: {new Date(clinic.last_email_backup).toLocaleString("en-PK")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Automated Email Backup Configuration */}
            <div className="bg-teal-50/60 rounded-2xl p-4 border border-teal-100 space-y-3 col-span-1 md:col-span-2">
              <div>
                <h4 className="font-bold text-sm text-teal-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-teal-700 text-base">mark_email_unread</span>
                  Automated Email Backup Dispatch Settings
                </h4>
                <p className="text-xs text-teal-800/80 mt-0.5">
                  Configure your primary email address for automatic 24-Hour / Weekly / Monthly clinic database backups.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label htmlFor="backup_email" className="block text-xs font-bold text-gray-700 mb-1">Target Backup Email(s) *</label>
                  <input
                    id="backup_email"
                    type="text"
                    placeholder="dr.asif@gmail.com, partner@gmail.com"
                    value={clinicForm.backup_email || ""}
                    onChange={(e) => setClinicForm({ ...clinicForm, backup_email: e.target.value })}
                    className="input-field text-xs font-bold bg-white"
                  />
                  <span className="text-[10px] text-gray-500">Single email or comma-separated emails</span>
                </div>

                <div>
                  <label htmlFor="backup_frequency" className="block text-xs font-bold text-gray-700 mb-1">Automatic Schedule (Interval)</label>
                  <select
                    id="backup_frequency"
                    value={clinicForm.backup_frequency || "daily"}
                    onChange={(e) => {
                      const val = e.target.value;
                      let hrs = 24;
                      if (val === "1h") hrs = 1;
                      else if (val === "2h") hrs = 2;
                      else if (val === "6h") hrs = 6;
                      else if (val === "12h") hrs = 12;
                      else if (val === "daily") hrs = 24;
                      else if (val === "weekly") hrs = 168;
                      else if (val === "monthly") hrs = 720;
                      setClinicForm({ ...clinicForm, backup_frequency: val, backup_interval_hours: hrs });
                    }}
                    className="input-field text-xs font-bold bg-white"
                  >
                    <option value="1h">Every 1 Hour (Ultra-Fast Auto Backup)</option>
                    <option value="2h">Every 2 Hours</option>
                    <option value="6h">Every 6 Hours</option>
                    <option value="12h">Every 12 Hours (Twice Daily)</option>
                    <option value="daily">Every 24 Hours (Daily Backup)</option>
                    <option value="weekly">Every Week (Weekly Backup)</option>
                    <option value="manual">Manual Dispatch Only</option>
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
                        last_email_backup: new Date().toISOString()
                      });

                      // Export encrypted .cfbak payload
                      const encryptedBackupStr = exportFullDatabase(true);

                      // Trigger local .cfbak encrypted file download safeguard
                      const blob = new Blob([encryptedBackupStr], { type: "application/octet-stream" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      const dateStr = new Date().toISOString().split("T")[0];
                      a.download = `CliniCore_Encrypted_Backup_${dateStr}.cfbak`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);

                      const targetEmails = clinicForm.backup_email.split(",").map((e) => e.trim()).filter(Boolean);

                      // Option A: If Resend API Key is provided, send real encrypted .cfbak attachment via Resend API!
                      if (clinicForm.resend_api_key?.trim()) {
                        try {
                          const base64Content = btoa(unescape(encodeURIComponent(encryptedBackupStr)));
                          const resendPayload = {
                            from: "CliniCore Backup <onboarding@resend.dev>",
                            to: targetEmails,
                            subject: `🏥 CliniCore Encrypted Vault Backup - ${clinicForm.name || "Clinic"} (${new Date().toLocaleDateString("en-PK")})`,
                            html: `
                              <div style="font-family: sans-serif; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #ccfbf1;">
                                <h2 style="color: #0f766e; margin-top: 0;">🏥 CliniCore Encrypted Database Backup</h2>
                                <p><strong>Clinic:</strong> ${clinicForm.name || "CliniCore Clinic"}</p>
                                <p><strong>Date & Time:</strong> ${new Date().toLocaleString("en-PK")}</p>
                                <p style="background: #e0f2fe; color: #0369a1; padding: 12px; border-radius: 8px; font-weight: bold;">
                                  🔒 Your full encrypted database vault is attached as a secure <code>.cfbak</code> file! Only CliniCore Software can restore this file.
                                </p>
                              </div>
                            `,
                            attachments: [
                              {
                                filename: `CliniCore_Encrypted_Backup_${dateStr}.cfbak`,
                                content: base64Content
                              }
                            ]
                          };

                          let res;
                          try {
                            const apiUrl = import.meta.env.VITE_API_URL || "https://api.clinicore.me";
                            res = await fetch(`${apiUrl}/api/v1/system/send-email`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json"
                              },
                              body: JSON.stringify({
                                api_key: clinicForm.resend_api_key.trim(),
                                to: targetEmails,
                                subject: resendPayload.subject,
                                html: resendPayload.html,
                                attachments: resendPayload.attachments,
                              })
                            });
                          } catch (fetchErr) {
                            alert(`⚠️ Email send failed: ${fetchErr.message}. Local encrypted .cfbak file was downloaded.`);
                            if (refreshClinic) refreshClinic();
                            return;
                          }

                          const data = await res.json().catch(() => null);
                          if (res.ok && data?.success) {
                            alert(`✅ Resend API Success! Encrypted Database Backup (.cfbak) delivered to inbox (${targetEmails.join(", ")}).`);
                          } else {
                            const errTxt = data?.message || data?.error || JSON.stringify(data);
                            if (errTxt.includes("You can only send testing emails to your own email address") || errTxt.includes("only send testing emails")) {
                              alert(`💡 Resend Testing Mode Notice:\n\nResend Sandbox Key currently allows delivering emails to the email address registered with your Resend account.\n\nTo send to ${clinicForm.backup_email}, verify your domain on https://resend.com/domains!\n\nLocal encrypted .cfbak backup was downloaded to your computer.`);
                            } else {
                              alert(`⚠️ Resend HTTP error (${res.status}): ${errTxt}. Local encrypted .cfbak backup was downloaded.`);
                            }
                          }
                        } catch (err) {
                          alert(`⚠️ Resend Dispatch Error: ${err.message}. Local backup JSON was downloaded.`);
                        }
                      } else {
                        alert(`📧 Backup generated & downloaded to PC! Add your free Resend API Key (re_...) below to enable 100% direct .json file attachment delivery to ${clinicForm.backup_email}.`);
                      }

                      if (refreshClinic) refreshClinic();
                    }}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                    Send Instant Email Backup Now
                  </button>
                </div>
              </div>

              {/* API Credentials Configuration */}
              <div className="pt-2 border-t border-teal-200/60 space-y-2">
                <div className="text-xs font-bold text-teal-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-teal-700">key</span>
                  Resend.com API Key (For Direct .json File Attachment Inbox Delivery)
                </div>
                <div className="bg-white p-3 rounded-xl border border-teal-200">
                  <label htmlFor="resend_api_key" className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Resend.com API Key (Free 3,000 Emails/Month with .json File Attachments)</span>
                    <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-[10px] text-teal-600 hover:underline font-bold">Get Free Key at Resend.com ➔</a>
                  </label>
                  <input
                    id="resend_api_key"
                    type="password"
                    placeholder="re_123456789_abcdef..."
                    value={clinicForm.resend_api_key || ""}
                    onChange={(e) => setClinicForm({ ...clinicForm, resend_api_key: e.target.value })}
                    className="input-field text-xs font-mono text-gray-800 bg-gray-50"
                  />
                </div>
              </div>
            </div>

            {/* Export Backup Card */}
            <div className="bg-teal-50/60 rounded-2xl p-4 border border-teal-100 space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm text-teal-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-teal-700 text-base">enhanced_encryption</span>
                  1-Click Export Encrypted Backup (.cfbak)
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  Download all Patients, Visits, Prescriptions, Pharmacy Sales, Stock &amp; Khata Ledgers into a secure encrypted <strong>.cfbak</strong> file.
                </p>
              </div>
              <button
                onClick={() => {
                  exportFullDatabase();
                  alert("✅ Encrypted .cfbak Backup downloaded successfully! Keep this file in a safe folder / USB.");
                }}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">lock</span>
                Download Backup (.cfbak)
              </button>
            </div>

            {/* Restore Backup Card */}
            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200 space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm text-amber-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-700 text-base">upload_file</span>
                  Restore / Import Backup File (.cfbak / .json)
                </h4>
                <p className="text-xs text-amber-800/80 mt-1">
                  Restore all database records from a previously saved CliniCore <strong>.cfbak</strong> encrypted backup file.
                </p>
              </div>
              <label className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm text-center">
                <span className="material-symbols-outlined text-base">upload</span>
                Select .cfbak File to Restore
                <input
                  type="file"
                  accept=".cfbak,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const content = event.target?.result;
                        if (typeof content === "string") {
                          const result = importFullDatabase(content);
                          if (result.success) {
                            alert("✅ Database restored successfully! Reloading...");
                            window.location.reload();
                          } else {
                            alert("⚠️ Failed to restore backup: " + (result.error || "Corrupted file"));
                          }
                        }
                      } catch (err) {
                        alert("⚠️ Failed to restore backup: " + err.message);
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-teal-100 flex justify-between items-center flex-wrap gap-2 text-xs">
            <span className="text-gray-500 font-medium">Database Maintenance &amp; Setup Modes:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (confirm("🧹 Detach all mock transactions and activate Clean Setup (0 dummy queue patients/bills)?\n\nYour Clinic Profile, Staff Users, Accounts, and Medicine Catalog will stay 100% intact.")) {
                    clearAllTransactionalData();
                    alert("✅ Mock data detached successfully! Database is now completely clean (0 transactions). Reloading app...");
                    window.location.reload();
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">cleaning_services</span>
                Detach Mock Data (0 Transactions)
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
