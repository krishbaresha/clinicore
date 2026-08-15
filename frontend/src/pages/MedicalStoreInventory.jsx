import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getInventory, addInventoryItem } from "../api/store.js";
import { formatCurrency } from "../utils/formatters.js";

export default function MedicalStoreInventory() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState({ medicine_name: "", stock_qty: "", unit_price: "", low_stock_threshold: "10" });
  const [error,     setError]     = useState("");

  function load() {
    const r = getInventory();
    if (r.success) setInventory(r.data);
  }

  useEffect(load, []);

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  function handleAddItem(e) {
    e.preventDefault();
    setError("");
    const result = addInventoryItem(form);
    if (result.success) {
      setShowForm(false);
      setForm({ medicine_name: "", stock_qty: "", unit_price: "", low_stock_threshold: "10" });
      load();
    } else {
      setError(result.error.message);
    }
  }

  function isLowStock(item) { return item.stock_qty <= item.low_stock_threshold; }

  return (
    <div className="p-3 sm:p-5 md:p-8 flex flex-col gap-lg max-w-4xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Medical Store</h1>
          <p className="font-body-sm text-body-sm text-outline">Inventory</p>
        </div>
        <div className="flex gap-sm">
          <button
            id="view-sales-btn"
            onClick={() => navigate("/store/sales")}
            className="btn-secondary"
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            Sales Log
          </button>
          <button
            id="add-medicine-btn"
            onClick={() => setShowForm(!showForm)}
            className="btn-pill"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Medicine
          </button>
        </div>
      </div>

      {/* Add Medicine Form */}
      {showForm && (
        <div className="glass-card p-md">
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-md">Add New Medicine</h2>
          <form id="add-medicine-form" onSubmit={handleAddItem} className="flex flex-col gap-sm" noValidate>
            <div className="flex flex-col md:flex-row gap-sm">
              <div className="flex flex-col gap-xs flex-1">
                <label htmlFor="medicine_name" className="font-label-md text-label-md text-on-surface-variant">
                  Medicine Name <span className="text-error">*</span>
                </label>
                <input id="medicine_name" name="medicine_name" type="text" placeholder="Panadol"
                  value={form.medicine_name} onChange={handleChange} className="input-field" />
              </div>
              <div className="flex flex-col gap-xs w-full md:w-32">
                <label htmlFor="stock_qty" className="font-label-md text-label-md text-on-surface-variant">Stock Qty</label>
                <input id="stock_qty" name="stock_qty" type="number" min="0" placeholder="100"
                  value={form.stock_qty} onChange={handleChange} className="input-field" />
              </div>
              <div className="flex flex-col gap-xs w-full md:w-32">
                <label htmlFor="unit_price" className="font-label-md text-label-md text-on-surface-variant">Unit Price</label>
                <input id="unit_price" name="unit_price" type="number" min="0" placeholder="8"
                  value={form.unit_price} onChange={handleChange} className="input-field" />
              </div>
              <div className="flex flex-col gap-xs w-full md:w-36">
                <label htmlFor="low_stock_threshold" className="font-label-md text-label-md text-on-surface-variant">Low Stock At</label>
                <input id="low_stock_threshold" name="low_stock_threshold" type="number" min="0"
                  value={form.low_stock_threshold} onChange={handleChange} className="input-field" />
              </div>
            </div>
            {error && <p role="alert" className="text-error font-body-sm text-body-sm">{error}</p>}
            <div className="flex gap-sm">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button id="save-medicine-btn" type="submit" className="btn-primary">Save Medicine</button>
            </div>
          </form>
        </div>
      )}

      {/* Table header — desktop */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 font-label-md text-label-md text-outline uppercase tracking-wider">
        <div className="col-span-5">Medicine Name</div>
        <div className="col-span-2 text-right">Stock Qty</div>
        <div className="col-span-2 text-right">Unit Price</div>
        <div className="col-span-3 text-center">Status</div>
      </div>

      {/* Inventory rows */}
      {inventory.length === 0 ? (
        <div className="glass-card p-xl text-center text-outline font-body-md">No medicines in inventory yet.</div>
      ) : (
        <div className="space-y-3">
          {inventory.map((item) => {
            const low = isLowStock(item);
            return (
              <div
                key={item.id}
                id={`inv-row-${item.id}`}
                className={`glass-row rounded-2xl p-4 md:px-6 md:py-4 flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 ${
                  low ? "border-l-4 border-amber-400" : ""
                }`}
              >
                <div className="col-span-5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">medication</span>
                  <span className="font-body-md text-body-md font-semibold text-on-surface">{item.medicine_name}</span>
                </div>
                <div className="col-span-2 flex items-center justify-between md:justify-end gap-2">
                  <span className="md:hidden font-label-md text-outline uppercase text-xs">Stock:</span>
                  <span className={`font-headline-md text-headline-md font-bold ${low ? "text-error" : "text-on-surface"}`}>
                    {item.stock_qty}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-between md:justify-end gap-2">
                  <span className="md:hidden font-label-md text-outline uppercase text-xs">Price:</span>
                  <span className="font-body-md text-body-md text-on-surface-variant">{formatCurrency(item.unit_price)}</span>
                </div>
                <div className="col-span-3 flex justify-between md:justify-center items-center gap-2">
                  <span className="md:hidden font-label-md text-outline uppercase text-xs">Status:</span>
                  <span className={low ? "badge-low-stock" : "badge-in-stock"}>
                    {low ? "Low Stock" : "In Stock"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
