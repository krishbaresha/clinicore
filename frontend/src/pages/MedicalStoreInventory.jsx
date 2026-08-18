import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getInventory, addInventoryItem } from "../api/store.js";
import { formatStockBreakdown } from "../api/db.js";
import { formatCurrency } from "../utils/formatters.js";
import ProductMovementModal from "../components/ProductMovementModal.jsx";

export default function MedicalStoreInventory() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 40;

  const [selectedMovementItem, setSelectedMovementItem] = useState(null);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [form, setForm] = useState({
    medicine_name: "",
    category: "Tablet",
    strength: "",
    has_multi_unit: true,
    box_label: "Box",
    strip_label: "Strip",
    unit_label: "Tablet",
    strips_per_box: "10",
    units_per_strip: "12",
    stock_boxes: "5",
    stock_qty: "0",
    cost_price_per_box: "600",
    box_sale_price: "900",
    strip_sale_price: "96",
    unit_sale_price: "8",
    low_stock_threshold: "20"
  });
  const [error, setError] = useState("");

  function load() {
    const r = getInventory();
    if (r.success) setInventory(r.data);
  }

  useEffect(load, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function handleAddItem(e) {
    e.preventDefault();
    setError("");

    // Calculate total base stock
    let totalBaseStock = 0;
    const stripsPerBox = parseInt(form.strips_per_box) || 1;
    const unitsPerStrip = parseInt(form.units_per_strip) || 1;

    if (form.has_multi_unit) {
      const boxes = parseInt(form.stock_boxes) || 0;
      totalBaseStock = boxes * (stripsPerBox * unitsPerStrip);
    } else {
      totalBaseStock = parseInt(form.stock_qty) || 0;
    }

    const payload = {
      ...form,
      has_multi_unit: form.has_multi_unit,
      strips_per_box: stripsPerBox,
      units_per_strip: unitsPerStrip,
      total_base_stock: totalBaseStock,
      stock_qty: totalBaseStock,
      cost_price_per_box: parseFloat(form.cost_price_per_box) || 0,
      box_sale_price: parseFloat(form.box_sale_price) || 0,
      strip_sale_price: parseFloat(form.strip_sale_price) || 0,
      unit_sale_price: parseFloat(form.unit_sale_price) || parseFloat(form.unit_price) || 0,
      unit_price: parseFloat(form.unit_sale_price) || parseFloat(form.unit_price) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 20,
    };

    const result = addInventoryItem(payload);
    if (result.success) {
      setShowForm(false);
      setForm({
        medicine_name: "",
        category: "Tablet",
        strength: "",
        has_multi_unit: true,
        box_label: "Box",
        strip_label: "Strip",
        unit_label: "Tablet",
        strips_per_box: "10",
        units_per_strip: "12",
        stock_boxes: "5",
        stock_qty: "0",
        cost_price_per_box: "600",
        box_sale_price: "900",
        strip_sale_price: "96",
        unit_sale_price: "8",
        low_stock_threshold: "20"
      });
      load();
    } else {
      setError(result.error.message);
    }
  }

  function isLowStock(item) {
    const base = item.total_base_stock ?? item.stock_qty ?? 0;
    return base <= (item.low_stock_threshold || 20);
  }

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = (item.medicine_name || "").toLowerCase().includes(q);
        const mCode = (item.item_code || "").toLowerCase().includes(q);
        const mCat = (item.category || "").toLowerCase().includes(q);
        const mGen = (item.generic_name || "").toLowerCase().includes(q);
        if (!mName && !mCode && !mCat && !mGen) return false;
      }
      return true;
    });
  }, [inventory, searchQuery, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / PAGE_SIZE));
  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInventory.slice(start, start + PAGE_SIZE);
  }, [filteredInventory, currentPage]);

  return (
    <div className="p-md md:p-lg max-w-7xl mx-auto space-y-md">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Medical Store Inventory</h1>
          <p className="font-body-sm text-body-sm text-outline">
            {filteredInventory.length} Total Medicines in Catalog · Instant Search &amp; Tiered Pricing
          </p>
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

      {/* Live Search & Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-teal-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Search by medicine name, code, category..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white text-xs font-semibold focus:outline-none focus:border-teal-600 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {["all", "Tablet", "Homeopathic Drops", "Syrup / Suspension", "Injection / IV", "Capsule"].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategoryFilter(cat);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat === "all" ? "All Items" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Add Medicine Form */}
      {showForm && (
        <div className="glass-card p-md border-2 border-teal-500/20 shadow-xl rounded-3xl">
          <div className="flex justify-between items-center mb-md border-b border-gray-100 pb-3">
            <div>
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Add New Medicine / Product</h2>
              <p className="text-xs text-gray-500">Configure packaging levels, ratios, and tiered prices</p>
            </div>
            <label htmlFor="has_multi_unit" className="flex items-center gap-2 bg-teal-50 text-teal-800 px-3 py-1.5 rounded-xl border border-teal-200 cursor-pointer font-bold text-xs">
              <input
                id="has_multi_unit"
                type="checkbox"
                name="has_multi_unit"
                checked={form.has_multi_unit}
                onChange={handleChange}
                className="accent-teal-600 w-4 h-4"
              />
              Multi-Unit Packaging (Box ➔ Strip ➔ Tablet)
            </label>
          </div>

          <form id="add-medicine-form" onSubmit={handleAddItem} className="flex flex-col gap-md" noValidate>
            {/* Row 1: Name, Category, Strength */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
              <div className="flex flex-col gap-xs">
                <label htmlFor="medicine_name" className="font-label-md text-label-md text-on-surface-variant font-bold">
                  Medicine Name <span className="text-error">*</span>
                </label>
                <input
                  id="medicine_name"
                  name="medicine_name"
                  type="text"
                  placeholder="e.g. Panadol 500mg"
                  autoComplete="off"
                  value={form.medicine_name}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="category" className="font-label-md text-label-md text-on-surface-variant font-bold">
                  Category / Form
                </label>
                <select id="category" name="category" value={form.category} onChange={handleChange} className="input-field">
                  <option value="Tablet">Tablet (Solid)</option>
                  <option value="Capsule">Capsule (Hard/Softgel)</option>
                  <option value="Syrup / Suspension">Syrup / Suspension (Liquid)</option>
                  <option value="Injection / IV">Injection / IV Drip</option>
                  <option value="Cream / Ointment / Gel">Cream / Ointment / Gel</option>
                  <option value="Eye / Ear Drops">Eye / Ear Drops</option>
                  <option value="Inhaler / Respiratory">Inhaler / Nebulizer</option>
                  <option value="Powder / Sachet">Sachet / Powder</option>
                </select>
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="strength" className="font-label-md text-label-md text-on-surface-variant font-bold">
                  Packing
                </label>
                <input
                  id="strength"
                  name="strength"
                  type="text"
                  placeholder="e.g. 500 mg, 120 ml"
                  autoComplete="off"
                  value={form.strength}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            </div>

            {/* Multi-Unit Hierarchy Config Section */}
            {form.has_multi_unit ? (
              <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100 space-y-3">
                <div className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">widgets</span>
                  Packaging Hierarchy Ratios (Box ➔ Strips ➔ Base Tablets)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
                  <div className="flex flex-col gap-xs bg-white p-3 rounded-xl border border-teal-100">
                    <label htmlFor="box_label" className="text-xs font-bold text-gray-700">1. Box / Pack Label</label>
                    <input id="box_label" name="box_label" type="text" placeholder="Box" autoComplete="off" value={form.box_label} onChange={handleChange} className="input-field text-sm" />
                    <span className="text-[10px] text-gray-400">Outer wholesale container</span>
                  </div>

                  <div className="flex flex-col gap-xs bg-white p-3 rounded-xl border border-teal-100">
                    <label htmlFor="strips_per_box" className="text-xs font-bold text-gray-700">2. Strips Per Box (Pattay)</label>
                    <input id="strips_per_box" name="strips_per_box" type="number" min="1" placeholder="10" autoComplete="off" value={form.strips_per_box} onChange={handleChange} className="input-field text-sm" />
                    <span className="text-[10px] text-gray-400">How many pattay in 1 box</span>
                  </div>

                  <div className="flex flex-col gap-xs bg-white p-3 rounded-xl border border-teal-100">
                    <label htmlFor="units_per_strip" className="text-xs font-bold text-gray-700">3. Tablets Per Strip</label>
                    <input id="units_per_strip" name="units_per_strip" type="number" min="1" placeholder="12" autoComplete="off" value={form.units_per_strip} onChange={handleChange} className="input-field text-sm" />
                    <span className="text-[10px] text-gray-400">Tablets in 1 patta/strip</span>
                  </div>
                </div>

                <div className="text-xs font-semibold text-teal-700 bg-white p-2.5 rounded-xl border border-teal-200 text-center">
                  Calculated Ratio: <strong>1 Box</strong> = <strong>{parseInt(form.strips_per_box) || 0} Strips</strong> = <strong>{(parseInt(form.strips_per_box) || 0) * (parseInt(form.units_per_strip) || 0)} Total Tablets</strong>
                </div>

                {/* Initial Stock Boxes & Prices */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-sm pt-2">
                  <div className="flex flex-col gap-xs">
                    <label htmlFor="stock_boxes" className="text-xs font-bold text-teal-900">Total Boxes In Stock</label>
                    <input id="stock_boxes" name="stock_boxes" type="number" min="0" placeholder="5" autoComplete="off" value={form.stock_boxes} onChange={handleChange} className="input-field" />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label htmlFor="box_sale_price" className="text-xs font-bold text-teal-900">Box Sale Price (Rs)</label>
                    <input id="box_sale_price" name="box_sale_price" type="number" min="0" placeholder="900" autoComplete="off" value={form.box_sale_price} onChange={handleChange} className="input-field" />
                    <span className="text-[10px] text-gray-400">Wholesale rate</span>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label htmlFor="strip_sale_price" className="text-xs font-bold text-teal-900">Strip Price (Rs)</label>
                    <input id="strip_sale_price" name="strip_sale_price" type="number" min="0" placeholder="96" autoComplete="off" value={form.strip_sale_price} onChange={handleChange} className="input-field" />
                    <span className="text-[10px] text-gray-400">Patta rate</span>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label htmlFor="unit_sale_price" className="text-xs font-bold text-teal-900">Single Tab Rate (Rs)</label>
                    <input id="unit_sale_price" name="unit_sale_price" type="number" min="0" placeholder="8" autoComplete="off" value={form.unit_sale_price} onChange={handleChange} className="input-field" />
                    <span className="text-[10px] text-gray-400">Loose tablet rate</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Single Unit Product Fields (Syrups / Drops / Tubes) */
              <div className="grid grid-cols-1 md:grid-cols-4 gap-sm bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <div className="flex flex-col gap-xs">
                  <label htmlFor="unit_label" className="font-label-md text-label-md text-on-surface-variant font-bold">Unit Type</label>
                  <select id="unit_label" name="unit_label" value={form.unit_label} onChange={handleChange} className="input-field">
                    <option value="Bottle">Bottle / Syringe</option>
                    <option value="Tube">Tube</option>
                    <option value="Vial">Vial / Ampoule</option>
                    <option value="Sachet">Sachet</option>
                    <option value="Inhaler">Inhaler Device</option>
                  </select>
                </div>

                <div className="flex flex-col gap-xs">
                  <label htmlFor="stock_qty" className="font-label-md text-label-md text-on-surface-variant font-bold">Stock Qty</label>
                  <input id="stock_qty" name="stock_qty" type="number" min="0" placeholder="40" autoComplete="off"
                    value={form.stock_qty} onChange={handleChange} className="input-field" />
                </div>

                <div className="flex flex-col gap-xs">
                  <label htmlFor="unit_sale_price" className="font-label-md text-label-md text-on-surface-variant font-bold">Retail Price (Rs)</label>
                  <input id="unit_sale_price" name="unit_sale_price" type="number" min="0" placeholder="180" autoComplete="off"
                    value={form.unit_sale_price} onChange={handleChange} className="input-field" />
                </div>

                <div className="flex flex-col gap-xs">
                  <label htmlFor="low_stock_threshold" className="font-label-md text-label-md text-on-surface-variant font-bold">Low Stock Warning At</label>
                  <input id="low_stock_threshold" name="low_stock_threshold" type="number" min="0" autoComplete="off"
                    value={form.low_stock_threshold} onChange={handleChange} className="input-field" />
                </div>
              </div>
            )}

            {error && <p role="alert" className="text-error font-body-sm text-body-sm">{error}</p>}
            <div className="flex gap-sm pt-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button id="save-medicine-btn" type="submit" className="btn-primary">Save Medicine</button>
            </div>
          </form>
        </div>
      )}

      {/* Table header — desktop */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 font-label-md text-label-md text-outline uppercase tracking-wider">
        <div className="col-span-5">Medicine &amp; Category</div>
        <div className="col-span-4 text-right">Available Stock Breakdown</div>
        <div className="col-span-3 text-center">Selling Price Tiers &amp; Actions</div>
      </div>

      {/* Inventory rows */}
      {paginatedInventory.length === 0 ? (
        <div className="glass-card p-xl text-center text-outline font-body-md">
          {searchQuery ? `No medicines found matching "${searchQuery}".` : "No medicines in inventory yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedInventory.map((item) => {
            const low = isLowStock(item);
            return (
              <div
                key={item.id}
                id={`inv-row-${item.id}`}
                className={`glass-row rounded-2xl p-4 md:px-6 md:py-4 flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 ${
                  low ? "border-l-4 border-amber-400" : ""
                }`}
              >
                {/* Name & Category */}
                <div className="col-span-5 flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-teal-600 bg-teal-50 p-2.5 rounded-xl border border-teal-100">
                    {item.has_multi_unit ? "medication" : "vaccines"}
                  </span>
                  <div>
                    <div className="font-body-md text-body-md font-bold text-on-surface flex items-center gap-2">
                      {item.medicine_name}
                      {low && <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Low Stock</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="bg-teal-50 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-teal-100">
                        {item.category || "Tablet"}
                      </span>
                      {item.strength && <span className="font-semibold text-gray-700 text-xs">{item.strength}</span>}
                      {item.item_code && <span className="text-[10px] font-mono font-bold text-teal-900 bg-gray-100 px-1.5 py-0.5 rounded">Code: {item.item_code}</span>}
                      {item.has_multi_unit && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          (1 Box = {item.strips_per_box || 10} Strips × {item.units_per_strip || 12} {item.unit_label || "Tab"})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock breakdown */}
                <div className="col-span-4 flex flex-col items-start md:items-end justify-center">
                  <span className="md:hidden font-label-md text-outline uppercase text-xs">Stock:</span>
                  <div className={`font-semibold text-sm ${low ? "text-rose-600 font-bold" : "text-gray-900"}`}>
                    {formatStockBreakdown(item)}
                  </div>
                </div>

                {/* Pricing Tiers & Movement Button */}
                <div className="col-span-3 flex flex-wrap md:flex-row items-center justify-end gap-2">
                  {item.has_multi_unit ? (
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      {item.box_sale_price > 0 && (
                        <span className="bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-100 font-medium">
                          Box: {formatCurrency(item.box_sale_price)}
                        </span>
                      )}
                      {item.unit_sale_price > 0 && (
                        <span className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded border border-purple-100 font-medium">
                          Unit: {formatCurrency(item.unit_sale_price)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="font-semibold text-sm text-gray-900">
                      {formatCurrency(item.unit_sale_price || item.unit_price || 0)}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSelectedMovementItem(item);
                      setIsMovementOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-800 text-xs font-bold flex items-center gap-1 border border-teal-200 transition-all shadow-sm"
                    title="1-Click Stock Card & Traceability"
                  >
                    <span className="material-symbols-outlined text-xs">analytics</span>
                    Stock Card
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm text-xs text-gray-600">
          <div>
            Showing Page <span className="font-bold text-gray-900">{currentPage}</span> of <span className="font-bold text-gray-900">{totalPages}</span> ({filteredInventory.length} total items)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 font-bold"
            >
              Previous
            </button>
            <span className="font-bold text-teal-800 px-2">Page {currentPage}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 font-bold"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedMovementItem && (
        <ProductMovementModal
          item={selectedMovementItem}
          isOpen={isMovementOpen}
          onClose={() => {
            setIsMovementOpen(false);
            setSelectedMovementItem(null);
          }}
          onStockUpdated={load}
        />
      )}
    </div>
  );
}
