import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSales, getInventory, recordSale } from "../api/store.js";
import { formatCurrency, formatDate } from "../utils/formatters.js";

export default function MedicalStoreSalesLog() {
  const navigate    = useNavigate();
  const [sales,     setSales]     = useState([]);
  const [inventory, setInventory] = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState({ inventory_id: "", quantity_sold: "1", linked_visit_id: "" });
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");

  function load() {
    const sr = getSales();
    if (sr.success) setSales([...sr.data].sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date)));
    const ir = getInventory();
    if (ir.success) setInventory(ir.data);
  }

  useEffect(load, []);

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  function handleRecordSale(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    const result = recordSale(form);
    if (result.success) {
      setSuccess("Sale recorded — stock updated.");
      setShowForm(false);
      setForm({ inventory_id: "", quantity_sold: "1", linked_visit_id: "" });
      load();
    } else {
      setError(result.error.message);
    }
  }

  // Summary: total sales this month
  const now = new Date();
  const thisMonthSales = sales.filter((s) => {
    const d = new Date(s.sale_date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthlySalesTotal = thisMonthSales.reduce((sum, s) => sum + (s.sale_amount || 0), 0);

  function getMedicineName(inventory_id) {
    return inventory.find((i) => i.id === inventory_id)?.medicine_name || inventory_id;
  }

  return (
    <div className="p-md md:p-lg flex flex-col gap-lg max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Medical Store</h1>
          <p className="font-body-sm text-body-sm text-outline">Sales Log</p>
        </div>
        <div className="flex gap-sm">
          <button id="view-inventory-btn" onClick={() => navigate("/store")} className="btn-secondary">
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            Inventory
          </button>
          <button id="record-sale-btn" onClick={() => setShowForm(!showForm)} className="btn-pill">
            <span className="material-symbols-outlined text-sm">add</span>
            Record Sale
          </button>
        </div>
      </div>

      {/* Monthly Summary Strip */}
      <div className="glass-card p-md flex items-center gap-md">
        <span className="material-symbols-outlined text-primary text-3xl">payments</span>
        <div>
          <p className="font-label-md text-label-md text-outline uppercase tracking-wider">Total Sales This Month</p>
          <p className="font-headline-lg text-headline-lg font-bold text-primary">{formatCurrency(monthlySalesTotal)}</p>
        </div>
        <div className="ml-lg">
          <p className="font-label-md text-label-md text-outline uppercase tracking-wider">Transactions</p>
          <p className="font-headline-md text-headline-md font-bold text-on-surface">{thisMonthSales.length}</p>
        </div>
      </div>

      {/* Record Sale Form */}
      {showForm && (
        <div className="glass-card p-md">
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-md">Record Sale</h2>
          <form id="record-sale-form" onSubmit={handleRecordSale} className="flex flex-col gap-sm" noValidate>
            <div className="flex flex-col md:flex-row gap-sm">
              <div className="flex flex-col gap-xs flex-1">
                <label htmlFor="inventory_id" className="font-label-md text-label-md text-on-surface-variant">
                  Medicine <span className="text-error">*</span>
                </label>
                <select id="inventory_id" name="inventory_id" value={form.inventory_id} onChange={handleChange} className="input-field" required>
                  <option value="">Select medicine…</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.medicine_name} (Stock: {item.stock_qty})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-xs w-full md:w-32">
                <label htmlFor="quantity_sold" className="font-label-md text-label-md text-on-surface-variant">Quantity</label>
                <input id="quantity_sold" name="quantity_sold" type="number" min="1"
                  value={form.quantity_sold} onChange={handleChange} className="input-field" />
              </div>
            </div>
            {error   && <p role="alert" className="text-error font-body-sm text-body-sm">{error}</p>}
            {success && <p role="status" className="text-secondary font-body-sm text-body-sm">{success}</p>}
            <div className="flex gap-sm">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button id="save-sale-btn" type="submit" className="btn-primary">Record Sale</button>
            </div>
          </form>
        </div>
      )}

      {/* Success toast when no form */}
      {success && !showForm && (
        <p role="status" className="text-secondary font-body-sm text-body-sm bg-secondary-container/20 px-md py-xs rounded-lg">
          {success}
        </p>
      )}

      {/* Sales Table header — desktop */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 font-label-md text-label-md text-outline uppercase tracking-wider">
        <div className="col-span-3">Date</div>
        <div className="col-span-4">Medicine Sold</div>
        <div className="col-span-2 text-right">Quantity</div>
        <div className="col-span-3 text-right">Amount</div>
      </div>

      {/* Sales rows */}
      {sales.length === 0 ? (
        <div className="glass-card p-xl text-center text-outline font-body-md">No sales recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <div
              key={sale.id}
              id={`sale-row-${sale.id}`}
              className="glass-row rounded-2xl p-4 md:px-6 md:py-4 flex flex-col md:grid md:grid-cols-12 md:items-center gap-3"
            >
              <div className="col-span-3 flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
                <span className="material-symbols-outlined text-[16px] text-outline hidden md:block">calendar_today</span>
                {formatDate(sale.sale_date)}
              </div>
              <div className="col-span-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary hidden md:block">medication</span>
                <span className="font-body-md text-body-md font-semibold text-on-surface">
                  {getMedicineName(sale.inventory_id)}
                </span>
              </div>
              <div className="col-span-2 flex items-center justify-between md:justify-end gap-2">
                <span className="md:hidden font-label-md text-outline uppercase text-xs">Qty:</span>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">{sale.quantity_sold}</span>
              </div>
              <div className="col-span-3 flex items-center justify-between md:justify-end gap-2">
                <span className="md:hidden font-label-md text-outline uppercase text-xs">Amount:</span>
                <span className="font-headline-md text-headline-md font-bold text-primary">{formatCurrency(sale.sale_amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
