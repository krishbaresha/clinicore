import { useState, useEffect } from "react";
import { dbInventory, dbSales, dbVisits, dbPatients, dbClinic } from "../api/db.js";

function ReceiptModal({ sale, onClose }) {
  if (!sale) return null;

  const clinic = dbClinic.get();
  const isWalkIn = !sale.visit_id;
  const subtotal = sale.subtotal_amount ?? sale.items.reduce((s, i) => s + i.line_total, 0);
  const discount = sale.discount_amount ?? 0;
  const tax = sale.tax_amount ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      {/* ── 80mm thermal print CSS ── */}
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 4mm 3mm;
          }
          body > * { display: none !important; }
          #pos-thermal-receipt-root { display: block !important; }
          #pos-thermal-receipt {
            width: 74mm !important;
            max-width: 74mm !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            font-size: 11pt !important;
            color: #000 !important;
            page-break-inside: avoid;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
      <div id="pos-thermal-receipt-root" className="max-w-sm w-full">
        <div id="pos-thermal-receipt" className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-teal-100">
          {/* Receipt Header */}
        <div className="bg-gradient-to-br from-teal-600 to-teal-700 text-white p-5 text-center">
          <div className="text-base font-bold mb-0.5">{clinic?.name || "Dr. Asif Ashraf's Clinic"}</div>
          <div className="text-sm opacity-80 font-medium uppercase tracking-widest mb-1">Medical Store Receipt</div>
          <div className="text-xs opacity-75 font-semibold">
            {isWalkIn ? "🚶 Walk-in Customer" : "📋 Linked Consultation Visit"}
          </div>
          <div className="text-[10px] opacity-60 mt-1">{new Date(sale.sale_date).toLocaleString("en-PK")}</div>
        </div>

        {/* Items */}
        <div className="p-5 space-y-3">
          <div className="space-y-2 mb-3">
            {sale.items.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium text-gray-900">{item.medicine_name}</div>
                  <div className="text-xs text-gray-400">
                    {item.quantity} {item.unit_label || "unit"}{item.quantity > 1 ? "s" : ""} × Rs. {item.unit_price}
                  </div>
                </div>
                <div className="font-bold text-gray-800">Rs. {item.line_total.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="border-t border-dashed border-gray-200 pt-3 space-y-1.5 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-800">Rs. {subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-teal-700 font-medium">
                <span>Discount Applied</span>
                <span>- Rs. {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-400">
              <span>Tax (0%)</span>
              <span>Rs. {tax}</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
            <span className="font-bold text-gray-800 text-base">Total Amount</span>
            <span className="text-2xl font-black text-teal-700">Rs. {sale.total_amount.toLocaleString()}</span>
          </div>
          <div className="text-center text-[11px] text-gray-400 mt-2">Thank you · {clinic?.name || "ClinicFlow"}</div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 border border-teal-200 text-teal-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors"
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}

export default function MedicalStorePOS() {
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryResults, setInventoryResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [receipt, setReceipt] = useState(null);

  // Mode: "link" vs "walkin"
  const [customerMode, setCustomerMode] = useState("walkin"); // "walkin" or "link"
  const [visitQuery, setVisitQuery] = useState("");
  const [linkedVisit, setLinkedVisit] = useState(null);
  const [linkedPatient, setLinkedPatient] = useState(null);
  const [visitSearchResults, setVisitSearchResults] = useState([]);

  // Discount & Tax
  const [discountInput, setDiscountInput] = useState("");

  useEffect(() => {
    setInventoryResults(dbInventory.getAll());
  }, []);

  function searchInventory(q) {
    setInventoryQuery(q);
    setInventoryResults(dbInventory.search(q));
  }

  function addToCart(item) {
    setCart((prev) => {
      const existing = prev.find((c) => c.inventory_id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.inventory_id === item.id
            ? { ...c, quantity: c.quantity + 1, line_total: (c.quantity + 1) * c.unit_price }
            : c
        );
      }
      return [
        ...prev,
        {
          inventory_id: item.id,
          medicine_name: item.medicine_name,
          unit_label: item.unit_label || "unit",
          quantity: 1,
          unit_price: item.unit_price,
          line_total: item.unit_price,
          max_qty: item.stock_qty,
        },
      ];
    });
  }

  function updateQty(inventoryId, delta) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.inventory_id !== inventoryId) return c;
          const newQty = Math.max(0, Math.min(c.max_qty, c.quantity + delta));
          return { ...c, quantity: newQty, line_total: newQty * c.unit_price };
        })
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(inventoryId) {
    setCart((prev) => prev.filter((c) => c.inventory_id !== inventoryId));
  }

  const subtotal = cart.reduce((sum, c) => sum + c.line_total, 0);
  const discountVal = Math.min(subtotal, Math.max(0, Number(discountInput) || 0));
  const finalTotal = Math.max(0, subtotal - discountVal);

  function checkout() {
    if (cart.length === 0) { alert("Cart is empty."); return; }
    // Check stock
    for (const item of cart) {
      const inv = dbInventory.getById(item.inventory_id);
      if (!inv || inv.stock_qty < item.quantity) {
        alert(`Insufficient stock for ${item.medicine_name}. Available: ${inv?.stock_qty ?? 0}`);
        return;
      }
    }

    const sale = dbSales.checkout({
      visit_id: customerMode === "link" ? (linkedVisit?.id || null) : null,
      items: cart.map((c) => ({
        inventory_id: c.inventory_id,
        medicine_name: c.medicine_name,
        unit_label: c.unit_label,
        quantity: c.quantity,
        unit_price: c.unit_price,
        line_total: c.line_total,
      })),
      discount_amount: discountVal,
      tax_amount: 0,
    });

    setReceipt(sale);
    setCart([]);
    setDiscountInput("");
    setInventoryResults(dbInventory.getAll());
  }

  // Visit search (for linking)
  function searchVisits(q) {
    setVisitQuery(q);
    if (!q.trim()) { setVisitSearchResults([]); return; }
    const tokenNum = parseInt(q, 10);
    const today = new Date().toISOString().split("T")[0];
    const todayVisits = dbVisits.getTodayAll ? dbVisits.getTodayAll() : dbVisits.getAll().filter((v) => v.visit_date?.startsWith(today));
    const matches = todayVisits.filter((v) => {
      const p = dbPatients.getById(v.patient_id);
      return (
        (tokenNum && v.token_number === tokenNum) ||
        (p && p.full_name.toLowerCase().includes(q.toLowerCase()))
      );
    });
    setVisitSearchResults(matches.slice(0, 5));
  }

  function linkVisit(visit) {
    setLinkedVisit(visit);
    setLinkedPatient(dbPatients.getById(visit.patient_id));
    setVisitSearchResults([]);
    setVisitQuery("");
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {receipt && (
        <ReceiptModal
          sale={receipt}
          onClose={() => {
            setReceipt(null);
            setLinkedVisit(null);
            setLinkedPatient(null);
            setDiscountInput("");
            setInventoryQuery("");
            setInventoryResults(dbInventory.getAll());
          }}
        />
      )}

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
            Medical Store POS
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Point of Sale checkout with inventory deduction</p>
        </div>

        {/* Customer Mode Toggle */}
        <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1 border border-gray-200">
          <button
            type="button"
            onClick={() => { setCustomerMode("walkin"); setLinkedVisit(null); setLinkedPatient(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              customerMode === "walkin" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <span className="material-symbols-outlined text-base">directions_walk</span>
            Walk-in Customer
          </button>
          <button
            type="button"
            onClick={() => setCustomerMode("link")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              customerMode === "link" ? "bg-teal-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            Link to Visit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-4">
        {/* Left: Inventory + optional visit link */}
        <div className="space-y-4">
          {/* Linked Visit selector (if customerMode === 'link') */}
          {customerMode === "link" && (
            <div className="bg-white rounded-2xl border border-teal-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-teal-600 text-lg">receipt_long</span>
                <span className="text-sm font-bold text-gray-800">Linked Consultation Visit</span>
              </div>

              {linkedVisit ? (
                <div className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl p-3">
                  <div>
                    <div className="text-sm font-bold text-gray-900">Token #{linkedVisit.token_number} — {linkedPatient?.full_name}</div>
                    {linkedVisit.prescription_image_url && (
                      <a
                        href={linkedVisit.prescription_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-teal-600 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <span className="material-symbols-outlined text-sm">image</span>
                        View Prescription Photo
                      </a>
                    )}
                  </div>
                  <button onClick={() => { setLinkedVisit(null); setLinkedPatient(null); }} className="text-gray-400 hover:text-red-500 ml-2">
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={visitQuery}
                    onChange={(e) => searchVisits(e.target.value)}
                    placeholder="Search today's visits by token number or patient name..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                  />
                  {visitSearchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                      {visitSearchResults.map((v) => {
                        const p = dbPatients.getById(v.patient_id);
                        return (
                          <button
                            key={v.id}
                            onClick={() => linkVisit(v)}
                            className="w-full text-left px-4 py-2.5 hover:bg-teal-50 border-b border-gray-50 last:border-0 transition-colors"
                          >
                            <div className="text-sm font-semibold text-gray-900">Token #{v.token_number} — {p?.full_name}</div>
                            <div className="text-xs text-gray-400 capitalize">{v.status}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Medicine Search */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-2">Search Medicines</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl">medication</span>
                <input
                  type="text"
                  value={inventoryQuery}
                  onChange={(e) => searchInventory(e.target.value)}
                  placeholder="Type medicine name..."
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {inventoryResults.length === 0 && (
                <div className="text-center py-6 text-sm text-gray-400">No medicines found</div>
              )}
              {inventoryResults.map((item) => {
                const inCart = cart.find((c) => c.inventory_id === item.id);
                const isLow = item.stock_qty <= item.low_stock_threshold;
                const unitLabel = item.unit_label || "unit";
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      inCart ? "border-teal-200 bg-teal-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm truncate">{item.medicine_name}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono uppercase">
                          {unitLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 font-medium">Rs. {item.unit_price} / {unitLabel}</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          item.stock_qty === 0
                            ? "bg-red-100 text-red-700"
                            : isLow
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-50 text-green-700"
                        }`}>
                          {item.stock_qty === 0 ? "Out of Stock" : isLow ? `Low: ${item.stock_qty}` : `${item.stock_qty} in stock`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => addToCart(item)}
                      disabled={item.stock_qty === 0}
                      className={`ml-3 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        item.stock_qty === 0
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Cart */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>
              <h2 className="font-bold text-gray-900">Checkout Cart</h2>
              {cart.length > 0 && (
                <span className="ml-auto text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full font-bold">{cart.length}</span>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-4xl text-gray-200 block mb-2">shopping_cart</span>
                <div className="text-sm text-gray-400">Add medicines from the left panel</div>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.inventory_id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{item.medicine_name}</div>
                        <div className="text-xs text-gray-400">
                          Rs. {item.unit_price} / {item.unit_label}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQty(item.inventory_id, -1)}
                          className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-xs"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.inventory_id, 1)}
                          disabled={item.quantity >= item.max_qty}
                          className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-xs disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-xs font-bold text-gray-900 w-16 text-right">Rs. {item.line_total}</div>
                      <button
                        onClick={() => removeFromCart(item.inventory_id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Subtotal, Discount & Tax inputs */}
                <div className="border-t border-dashed border-gray-200 pt-3 space-y-2 mb-4 text-xs">
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-semibold">Rs. {subtotal.toLocaleString()}</span>
                  </div>

                  {/* Discount Field */}
                  <div className="flex justify-between items-center gap-2">
                    <label className="text-gray-600 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-teal-600">local_offer</span>
                      Discount (Rs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={subtotal}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder="0"
                      className="w-24 border border-gray-200 rounded-lg px-2.5 py-1 text-right text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 bg-gray-50"
                    />
                  </div>

                  {/* Tax Field (Shown but inactive/0) */}
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="flex items-center gap-1">
                      Tax (0%) <span className="text-[10px] bg-gray-100 text-gray-400 px-1 rounded">Tax-exempt</span>
                    </span>
                    <span className="font-mono">Rs. 0</span>
                  </div>

                  <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                    <span className="font-bold text-gray-800 text-sm">Final Total</span>
                    <span className="text-xl font-black text-teal-700">Rs. {finalTotal.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={checkout}
                  className="w-full bg-teal-600 text-white py-3.5 rounded-2xl font-bold text-base hover:bg-teal-700 transition-colors shadow-xl shadow-teal-600/25 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>point_of_sale</span>
                  Checkout — Rs. {finalTotal.toLocaleString()}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
