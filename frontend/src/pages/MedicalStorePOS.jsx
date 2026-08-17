import { useState, useEffect, useRef } from "react";
import { dbInventory, dbSales, dbVisits, dbPatients, dbClinic, dbPatientLedger, formatStockBreakdown, formatStockShort } from "../api/db.js";
import { printThermalReceipt } from "../utils/thermalPrinter.js";

function ReceiptModal({ sale, onClose }) {
  if (!sale) return null;

  const clinic = dbClinic.get();
  const subtotal = sale.subtotal_amount ?? sale.items.reduce((s, i) => s + i.line_total, 0);
  const discount = sale.discount_amount ?? 0;
  const cashTendered = sale.cash_tendered ?? sale.total_amount;
  const changeDue = sale.change_due ?? Math.max(0, cashTendered - sale.total_amount);
  
  const rawDate = sale.sale_date ? new Date(sale.sale_date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-PK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const cashierName = sale.cashier_name || sale.user_name || "Cashier Desk";
  const customerName = sale.patient_name || (sale.visit_id ? "Linked Patient" : "Walk-In-Customer");
  const invoiceId = sale.id || `SL_${Math.floor(1000 + Math.random() * 9000)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-md w-full my-6">
        {/* Receipt Voucher Window Container */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200 text-gray-800 text-xs font-sans space-y-4 relative">
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors print:hidden"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>

          {/* Top Clinic Branding & Logo */}
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-600 to-teal-800 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md shadow-teal-200">
              {(clinic?.name || "Dr. Asif Ashraf's Clinic").charAt(0)}
            </div>
            <div className="text-base font-black text-teal-800 mt-1">
              {clinic?.name || "Dr. Asif Ashraf's Clinic"}
            </div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              Medical Store Tax Invoice
            </div>
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-gray-400 my-2" />

          {/* Meta Details List (Relevant Only) */}
          <div className="text-xs text-gray-800 font-semibold space-y-1 leading-relaxed">
            <div><span className="text-gray-500 font-medium">Date &amp; Time :</span> {dateTimeStr}</div>
            <div><span className="text-gray-500 font-medium">Cashier :</span> {cashierName}</div>
            <div><span className="text-gray-500 font-medium">Customer :</span> {customerName}</div>
            <div><span className="text-gray-500 font-medium">Invoice # :</span> {invoiceId}</div>
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-gray-400 my-2" />

          {/* Purchased Items List */}
          <div className="space-y-2">
            {sale.items.map((item, i) => (
              <div key={i} className="text-xs space-y-0.5">
                <div className="font-bold text-gray-900">{item.medicine_name}</div>
                <div className="flex justify-between items-center text-gray-600 font-medium">
                  <span>{Number(item.quantity || 1).toFixed(2)} {item.unit_label || "Pc"} X {Number(item.unit_price || 0).toFixed(2)}</span>
                  <span className="font-extrabold text-gray-900">Rs. {Number(item.line_total || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-gray-400 my-2" />

          {/* Summary Breakdown */}
          <div className="space-y-1 text-xs text-gray-700 font-semibold">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>Rs. {Number(subtotal).toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-teal-700 font-bold">
                <span>Discount</span>
                <span>- Rs. {Number(discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-gray-900 pt-1">
              <span>Grand Total</span>
              <span>Rs. {Number(sale.total_amount || subtotal).toFixed(2)}</span>
            </div>
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-gray-400 my-2" />

          {/* Payment Method Table */}
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200">
                <tr>
                  <th className="px-2 py-1.5">Paid By:</th>
                  <th className="px-2 py-1.5 text-center">Amount:</th>
                  <th className="px-2 py-1.5 text-right">Change Return:</th>
                </tr>
              </thead>
              <tbody className="font-semibold text-gray-800">
                <tr>
                  <td className="px-2 py-1.5 capitalize font-bold">{sale.payment_type || "Cash"}</td>
                  <td className="px-2 py-1.5 text-center">{Number(cashTendered).toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right">{Number(changeDue).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-gray-400 my-2" />

          {/* Centered Thank You Notice */}
          <div className="text-center font-bold text-gray-900 text-xs py-1">
            Thank You For Shopping With Us .<br />Please Come Again
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-gray-400 my-2" />

          {/* Developer Branding & Contact Footer */}
          <div className="text-center text-[11px] font-bold text-gray-700 space-y-0.5 pt-1">
            <div>Software Powered by: K.B Software</div>
            <div className="text-teal-700 font-mono font-black text-xs">
              📞 Contact: 03142291356
            </div>
          </div>

          {/* Interactive Print Button */}
          <div className="pt-2 flex justify-start print:hidden">
            <button
              onClick={() => printThermalReceipt(sale, clinic)}
              className="border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Print Receipt (80mm)
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

  // Discount, Payment Type, Tendered Cash & Patient Credit
  const [discountInput, setDiscountInput] = useState("");
  const [paymentType, setPaymentType] = useState("cash"); // "cash" or "credit"
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [cashTenderedInput, setCashTenderedInput] = useState("");

  // Barcode, Rx Viewer & Unit Selection Modals
  const [barcodeModalItem, setBarcodeModalItem] = useState(null);
  const [barcodePrintQty, setBarcodePrintQty] = useState(1);
  const [showRxModal, setShowRxModal] = useState(false);

  // Multi-Unit Selection Modal State
  const [unitModalItem, setUnitModalItem] = useState(null);
  const [modalUnitType, setModalUnitType] = useState("strip"); // "box", "strip", "unit"
  const [modalQty, setModalQty] = useState(1);

  const searchInputRef = useRef(null);

  useEffect(() => {
    setInventoryResults(dbInventory.getAll());

    function handleKeyDown(e) {
      if (e.key === "F2") {
        e.preventDefault();
        if (searchInputRef.current) searchInputRef.current.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        setCustomerMode((prev) => (prev === "walkin" ? "link" : "walkin"));
      } else if (e.key === "F8") {
        e.preventDefault();
        const cashEl = document.getElementById("pos-cash-tendered-input");
        if (cashEl) cashEl.focus();
      } else if (e.key === "F9" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        const checkoutBtn = document.getElementById("pos-checkout-btn");
        if (checkoutBtn) checkoutBtn.click();
      } else if (e.key === "Escape") {
        setUnitModalItem(null);
        setBarcodeModalItem(null);
        setShowRxModal(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function searchInventory(q) {
    setInventoryQuery(q);
    setInventoryResults(dbInventory.search(q));
  }

  function handleOpenAddModal(item) {
    if (!item.has_multi_unit) {
      // Direct add for single packaging items (Syrups, Drops, Injections)
      addToCartWithUnit(item, "unit", 1);
    } else {
      setUnitModalItem(item);
      setModalUnitType("strip"); // default to Patta / Strip
      setModalQty(1);
    }
  }

  function addToCartWithUnit(item, selectedUnitType, quantity) {
    const qty = Math.max(1, Number(quantity) || 1);
    const stripsPerBox = Number(item.strips_per_box) || 10;
    const unitsPerStrip = Number(item.units_per_strip) || 12;

    let baseUnitsDeducted = qty;
    let unitPrice = Number(item.unit_sale_price || item.unit_price) || 0;
    let unitLabel = item.unit_label || "tablet";

    if (item.has_multi_unit) {
      if (selectedUnitType === "box") {
        baseUnitsDeducted = qty * (stripsPerBox * unitsPerStrip);
        unitPrice = Number(item.box_sale_price) || (item.unit_price * stripsPerBox * unitsPerStrip);
        unitLabel = item.box_label || "Box";
      } else if (selectedUnitType === "strip") {
        baseUnitsDeducted = qty * unitsPerStrip;
        unitPrice = Number(item.strip_sale_price) || (item.unit_price * unitsPerStrip);
        unitLabel = item.strip_label || "Strip";
      } else {
        baseUnitsDeducted = qty;
        unitPrice = Number(item.unit_sale_price || item.unit_price) || 0;
        unitLabel = item.unit_label || "Tablet";
      }
    }

    const cartKey = `${item.id}_${selectedUnitType}`;
    const lineTotal = parseFloat((unitPrice * qty).toFixed(2));

    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.cart_key === cartKey);
      if (existingIndex > -1) {
        const updated = [...prev];
        const ex = updated[existingIndex];
        const newQty = ex.quantity + qty;
        const perUnitBase = baseUnitsDeducted / qty;
        updated[existingIndex] = {
          ...ex,
          quantity: newQty,
          base_units_deducted: perUnitBase * newQty,
          line_total: parseFloat((unitPrice * newQty).toFixed(2))
        };
        return updated;
      }
      return [
        ...prev,
        {
          cart_key: cartKey,
          inventory_id: item.id,
          medicine_name: item.medicine_name,
          selected_unit_type: selectedUnitType,
          unit_label: unitLabel,
          quantity: qty,
          base_units_deducted: baseUnitsDeducted,
          unit_price: unitPrice,
          line_total: lineTotal,
          batch_no: item.batch_no || "BAT-DEF",
          expiry_date: item.expiry_date || null,
        },
      ];
    });

    setUnitModalItem(null);
  }

  function updateQty(cartKey, delta) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.cart_key !== cartKey && c.inventory_id !== cartKey) return c;
          const inv = dbInventory.getById(c.inventory_id);
          const perUnitBase = c.base_units_deducted / c.quantity;
          const newQty = Math.max(0, c.quantity + delta);
          return {
            ...c,
            quantity: newQty,
            base_units_deducted: perUnitBase * newQty,
            line_total: parseFloat((c.unit_price * newQty).toFixed(2))
          };
        })
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(cartKey) {
    setCart((prev) => prev.filter((c) => c.cart_key !== cartKey && c.inventory_id !== cartKey));
  }

  const subtotal = cart.reduce((sum, c) => sum + c.line_total, 0);
  const discountVal = Math.min(subtotal, Math.max(0, Number(discountInput) || 0));
  const finalTotal = Math.max(0, subtotal - discountVal);

  const tenderedCashVal = Number(cashTenderedInput) || finalTotal;
  const changeDueVal = Math.max(0, tenderedCashVal - finalTotal);

  function checkout() {
    if (cart.length === 0) { alert("Cart is empty."); return; }
    if (paymentType === "credit" && customerMode !== "link" && !linkedPatient) {
      alert("Credit / Udhaar sale requires linking to a registered Patient.");
      return;
    }

    // Check base stock
    for (const cartItem of cart) {
      const inv = dbInventory.getById(cartItem.inventory_id);
      const availableBaseStock = inv ? (inv.total_base_stock ?? inv.stock_qty ?? 0) : 0;
      if (!inv || availableBaseStock < cartItem.base_units_deducted) {
        alert(`Insufficient stock for ${cartItem.medicine_name}. Available base stock: ${availableBaseStock} ${inv?.unit_label || "units"}.`);
        return;
      }
    }

    const paidVal = paymentType === "cash" ? finalTotal : Math.min(finalTotal, Number(amountPaidInput) || 0);
    const balanceDue = Math.max(0, finalTotal - paidVal);

    const sale = dbSales.checkout({
      visit_id: customerMode === "link" ? (linkedVisit?.id || null) : null,
      patient_name: linkedPatient?.full_name || null,
      payment_type: paymentType,
      amount_paid: paidVal,
      balance_due: balanceDue,
      cash_tendered: paymentType === "cash" ? tenderedCashVal : paidVal,
      change_due: paymentType === "cash" ? changeDueVal : 0,
      items: cart.map((c) => ({
        inventory_id: c.inventory_id,
        medicine_name: c.medicine_name,
        selected_unit_type: c.selected_unit_type,
        unit_label: c.unit_label,
        quantity: c.quantity,
        base_units_deducted: c.base_units_deducted,
        unit_price: c.unit_price,
        line_total: c.line_total,
        batch_no: c.batch_no,
      })),
      discount_amount: discountVal,
      tax_amount: 0,
    });

    // Record in Patient Ledger if Udhaar
    if (balanceDue > 0 && linkedPatient) {
      dbPatientLedger.addCredit(
        linkedPatient.id,
        linkedPatient.full_name,
        balanceDue,
        `Pharmacy POS Sale Udhaar (#${sale.id})`
      );
    }

    setReceipt(sale);
    setCart([]);
    setDiscountInput("");
    setAmountPaidInput("");
    setCashTenderedInput("");
    setPaymentType("cash");
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
    <div className="p-3 sm:p-5 md:p-8 max-w-6xl mx-auto w-full mobile-safe-bottom touch-scroll overflow-x-hidden">
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 md:gap-6">
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
                    <div className="text-sm font-bold text-gray-900">
                      Token #{linkedVisit.token_number} — {linkedPatient?.full_name}
                      <span className="ml-2 text-[10px] bg-teal-200 text-teal-800 px-1.5 py-0.5 rounded font-mono">
                        ID: {linkedPatient?.id}
                      </span>
                    </div>
                    {linkedVisit.prescription_image_url ? (
                      <button
                        type="button"
                        onClick={() => setShowRxModal(true)}
                        className="text-xs text-teal-700 hover:text-teal-900 font-bold underline flex items-center gap-1 mt-1 bg-white px-2.5 py-1 rounded-lg border border-teal-200 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        View Prescription Photo
                      </button>
                    ) : (
                      <span className="text-[11px] text-amber-700 italic block mt-0.5">No prescription photo attached for today&apos;s visit</span>
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
                  ref={searchInputRef}
                  type="text"
                  value={inventoryQuery}
                  onChange={(e) => searchInventory(e.target.value)}
                  placeholder="Type medicine name (Press F2 to focus)..."
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {inventoryResults.length === 0 && (
                <div className="text-center py-6 text-sm text-gray-400">No medicines found</div>
              )}
              {inventoryResults.map((item) => {
                const inCart = cart.some((c) => c.inventory_id === item.id);
                const baseStock = item.total_base_stock ?? item.stock_qty ?? 0;
                const isLow = baseStock <= (item.low_stock_threshold || 20);
                const unitLabel = item.unit_label || "Tablet";

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      inCart ? "border-teal-200 bg-teal-50/50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAddModal(item)}
                          className="font-bold text-gray-900 text-sm truncate hover:text-teal-700 hover:underline text-left"
                          title="Click to open custom quantity options"
                        >
                          {item.medicine_name}
                        </button>
                        <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold uppercase">
                          {item.category || "Tablet"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600 font-bold">
                          {item.has_multi_unit
                            ? `Tab: Rs. ${item.unit_sale_price || item.unit_price} | Strip: Rs. ${item.strip_sale_price || "-"}`
                            : `Rs. ${item.unit_sale_price || item.unit_price} / ${unitLabel}`}
                        </span>
                        {item.batch_no && (
                          <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                            {item.batch_no}
                          </span>
                        )}
                        {item.expiry_date && (() => {
                          const exp = new Date(item.expiry_date);
                          const today = new Date();
                          const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
                          if (diffDays < 0) {
                            return (
                              <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.5 rounded font-bold">
                                ⛔ Expired ({item.expiry_date})
                              </span>
                            );
                          } else if (diffDays <= 45) {
                            return (
                              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                                ⚠️ Exp: {diffDays}d ({item.expiry_date})
                              </span>
                            );
                          }
                          return null;
                        })()}
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          baseStock === 0
                            ? "bg-red-100 text-red-700"
                            : isLow
                            ? "bg-amber-100 text-amber-700 font-bold"
                            : "bg-emerald-50 text-emerald-800"
                        }`}>
                          {baseStock === 0 ? "Out of Stock" : formatStockShort(item)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3">
                      <button
                        type="button"
                        onClick={() => setBarcodeModalItem(item)}
                        title="Generate & Print Custom Barcode Sticker"
                        className="p-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">qr_code_2</span>
                      </button>

                      {item.has_multi_unit ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => addToCartWithUnit(item, "strip", 1)}
                            disabled={baseStock === 0}
                            title="Add 1 Strip (Patta) directly to cart"
                            className="bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg shadow-sm flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[13px]">add</span>
                            Strip
                          </button>
                          <button
                            type="button"
                            onClick={() => addToCartWithUnit(item, "unit", 1)}
                            disabled={baseStock === 0}
                            title="Add 1 Single Tablet directly to cart"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg shadow-sm flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[13px]">add</span>
                            Tab
                          </button>
                          <button
                            type="button"
                            onClick={() => addToCartWithUnit(item, "box", 1)}
                            disabled={baseStock === 0}
                            title="Add 1 Box directly to cart"
                            className="bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg shadow-sm flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[13px]">add</span>
                            Box
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCartWithUnit(item, "unit", 1)}
                          disabled={baseStock === 0}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            baseStock === 0
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                          Add
                        </button>
                      )}
                    </div>
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
                    <div key={item.cart_key || item.inventory_id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{item.medicine_name}</div>
                        <div className="text-xs text-teal-800 font-bold">
                          {item.quantity} {item.unit_label}{item.quantity > 1 ? "s" : ""} × Rs. {item.unit_price}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQty(item.cart_key || item.inventory_id, -1)}
                          className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.cart_key || item.inventory_id, 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-xs font-bold text-gray-900 w-16 text-right">Rs. {item.line_total}</div>
                      <button
                        onClick={() => removeFromCart(item.cart_key || item.inventory_id)}
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

                  {/* Discount Field with Quick Presets */}
                  <div className="space-y-1">
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
                    {subtotal > 0 && (
                      <div className="flex gap-1 justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={() => setDiscountInput(Math.round(subtotal * 0.05).toString())}
                          className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded font-bold hover:bg-teal-100"
                        >
                          5%
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountInput(Math.round(subtotal * 0.10).toString())}
                          className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded font-bold hover:bg-teal-100"
                        >
                          10%
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountInput(Math.round(subtotal * 0.15).toString())}
                          className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded font-bold hover:bg-teal-100"
                        >
                          15%
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountInput("50")}
                          className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold hover:bg-amber-100"
                        >
                          -50 Rs
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tax Field (Shown but inactive/0) */}
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="flex items-center gap-1">
                      Tax (0%) <span className="text-[10px] bg-gray-100 text-gray-400 px-1 rounded">Tax-exempt</span>
                    </span>
                    <span className="font-mono">Rs. 0</span>
                  </div>

                  {/* Payment Type Selection (Cash vs Credit/Udhaar) */}
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Payment Method</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentType("cash")}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                          paymentType === "cash"
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">payments</span> Cash Full
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType("credit")}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                          paymentType === "credit"
                            ? "bg-rose-50 border-rose-300 text-rose-800"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">credit_score</span> Credit / Udhaar
                      </button>
                    </div>

                    {paymentType === "cash" && (
                      <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label htmlFor="pos-cash-tendered-input" className="font-semibold text-emerald-900">Cash Given by Patient (F8):</label>
                          <input
                            id="pos-cash-tendered-input"
                            type="number"
                            value={cashTenderedInput}
                            onChange={(e) => setCashTenderedInput(e.target.value)}
                            placeholder={finalTotal.toString()}
                            className="w-24 border border-emerald-300 rounded px-2 py-0.5 text-right font-bold text-xs bg-white"
                          />
                        </div>
                        {/* Quick Cash Note Presets */}
                        <div className="flex gap-1 justify-end flex-wrap">
                          <button
                            type="button"
                            onClick={() => setCashTenderedInput(finalTotal.toString())}
                            className="text-[10px] bg-white border border-emerald-300 text-emerald-800 px-1.5 py-0.5 rounded font-bold hover:bg-emerald-100"
                          >
                            Exact
                          </button>
                          {[100, 500, 1000, 5000].map((note) => (
                            <button
                              key={note}
                              type="button"
                              onClick={() => setCashTenderedInput(note.toString())}
                              className="text-[10px] bg-white border border-emerald-300 text-emerald-800 px-1.5 py-0.5 rounded font-bold hover:bg-emerald-100"
                            >
                              Rs. {note}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-emerald-800 pt-1 border-t border-emerald-200/50">
                          <span>Change Returned (Baqaya):</span>
                          <span>Rs. {changeDueVal.toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {paymentType === "credit" && (
                      <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-rose-900">Cash Received Now:</span>
                          <input
                            type="number"
                            value={amountPaidInput}
                            onChange={(e) => setAmountPaidInput(e.target.value)}
                            placeholder="0"
                            className="w-20 border border-rose-300 rounded px-2 py-0.5 text-right font-bold text-xs"
                          />
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-rose-700">
                          <span>Added to Patient Khata:</span>
                          <span>Rs. {Math.max(0, finalTotal - (Number(amountPaidInput) || 0)).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
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

      {/* Barcode Generator Modal */}
      {barcodeModalItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          {/* Print CSS for Barcode Sticker */}
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #barcode-sticker-print-area, #barcode-sticker-print-area * { visibility: visible !important; }
              #barcode-sticker-print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
              }
            }
          `}</style>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl text-center flex flex-col max-h-[85vh]">
            <h3 className="text-lg font-bold text-gray-900 flex items-center justify-center gap-2 mb-3">
              <span className="material-symbols-outlined text-teal-600">qr_code_2</span>
              Print Custom Barcode Stickers
            </h3>

            {/* Sticker Quantity Control */}
            <div className="bg-teal-50 p-3 rounded-2xl border border-teal-100 flex items-center justify-between mb-3 shrink-0">
              <span className="text-xs font-bold text-gray-700">Stickers Quantity to Print:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBarcodePrintQty(Math.max(1, barcodePrintQty - 1))}
                  className="w-8 h-8 bg-white rounded-lg border border-gray-200 font-bold text-sm hover:bg-gray-50 flex items-center justify-center shadow-sm"
                >
                  -
                </button>
                <span className="font-black text-sm w-8 text-center">{barcodePrintQty}</span>
                <button
                  type="button"
                  onClick={() => setBarcodePrintQty(barcodePrintQty + 1)}
                  className="w-8 h-8 bg-white rounded-lg border border-gray-200 font-bold text-sm hover:bg-gray-50 flex items-center justify-center shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Printable Sticker Sheet Area */}
            <div id="barcode-sticker-print-area" className="space-y-2 overflow-y-auto max-h-[50vh] p-1 my-1 print:max-h-none print:overflow-visible pr-1">
              {Array.from({ length: barcodePrintQty }).map((_, idx) => (
                <div
                  key={idx}
                  className="border-2 border-dashed border-gray-300 rounded-2xl p-3 bg-gray-50 text-center space-y-0.5 font-mono print:border-none print:bg-white"
                >
                  <div className="text-xs font-bold text-gray-900 truncate">{barcodeModalItem.medicine_name}</div>
                  <div className="text-[10px] text-gray-600 font-semibold">
                    {barcodeModalItem.category ? `${barcodeModalItem.category} · ` : ""}
                    {barcodeModalItem.strength ? `${barcodeModalItem.strength} · ` : ""}
                    Rs. {barcodeModalItem.unit_price}
                  </div>
                  <div className="bg-white p-1.5 rounded border border-gray-200 inline-block my-0.5 shadow-inner">
                    <div className="h-8 w-40 flex items-center justify-between px-2 bg-black text-white text-[8px] tracking-widest font-black uppercase">
                      ||||| | |||| ||| |||| |
                    </div>
                    <div className="text-[9px] text-gray-700 font-bold mt-0.5">
                      {barcodeModalItem.batch_no || `BAR-${barcodeModalItem.id.slice(-6).toUpperCase()}`}
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-400">Exp: {barcodeModalItem.expiry_date || "N/A"}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-3 mt-auto shrink-0 border-t border-gray-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-teal-700 transition-colors flex items-center justify-center gap-1 shadow-md shadow-teal-600/20"
              >
                <span className="material-symbols-outlined text-sm">print</span> Print {barcodePrintQty} Sticker{barcodePrintQty > 1 ? "s" : ""}
              </button>
              <button
                type="button"
                onClick={() => { setBarcodeModalItem(null); setBarcodePrintQty(1); }}
                className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Viewer Modal */}
      {showRxModal && linkedVisit?.prescription_image_url && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Doctor Prescription Photo</h3>
                <p className="text-xs text-gray-500">Token #{linkedVisit.token_number} — {linkedPatient?.full_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRxModal(false)}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center max-h-[65vh]">
              <img
                src={linkedVisit.prescription_image_url}
                alt="Doctor Prescription"
                className="max-h-[60vh] w-full object-contain"
              />
            </div>

            <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
              <span>Date: {new Date(linkedVisit.visit_date).toLocaleDateString("en-PK")}</span>
              <button
                type="button"
                onClick={() => setShowRxModal(false)}
                className="bg-teal-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-teal-700"
              >
                Done / Back to Billing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Unit Selling Selection Modal */}
      {unitModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-teal-100 space-y-5">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{unitModalItem.medicine_name}</h3>
                <p className="text-xs text-teal-700 font-semibold mt-0.5">
                  Available Stock: {formatStockBreakdown(unitModalItem)}
                </p>
              </div>
              <button onClick={() => setUnitModalItem(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Select Selling Unit Format *
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {/* Box Option */}
                <button
                  type="button"
                  onClick={() => setModalUnitType("box")}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    modalUnitType === "box"
                      ? "border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20 font-bold"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="text-2xl">📦</span>
                  <span className="text-xs font-bold">{unitModalItem.box_label || "Box"}</span>
                  <span className="text-[11px] font-black text-teal-700">
                    Rs. {unitModalItem.box_sale_price || (unitModalItem.unit_price * (unitModalItem.strips_per_box || 10) * (unitModalItem.units_per_strip || 12))}
                  </span>
                </button>

                {/* Strip Option */}
                <button
                  type="button"
                  onClick={() => setModalUnitType("strip")}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    modalUnitType === "strip"
                      ? "border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20 font-bold"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="text-2xl">💊</span>
                  <span className="text-xs font-bold">{unitModalItem.strip_label || "Strip"}</span>
                  <span className="text-[11px] font-black text-teal-700">
                    Rs. {unitModalItem.strip_sale_price || (unitModalItem.unit_price * (unitModalItem.units_per_strip || 12))}
                  </span>
                </button>

                {/* Single Unit Option */}
                <button
                  type="button"
                  onClick={() => setModalUnitType("unit")}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    modalUnitType === "unit"
                      ? "border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20 font-bold"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="text-2xl">💊</span>
                  <span className="text-xs font-bold">{unitModalItem.unit_label || "Tablet"}</span>
                  <span className="text-[11px] font-black text-teal-700">
                    Rs. {unitModalItem.unit_sale_price || unitModalItem.unit_price}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-teal-50/50 p-3.5 rounded-2xl border border-teal-100">
              <label className="text-xs font-bold text-gray-700">Quantity to Sell:</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-xl bg-white border border-gray-300 font-bold text-gray-700 hover:bg-gray-100 flex items-center justify-center text-sm shadow-sm"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={modalQty}
                  onChange={(e) => setModalQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 text-center border border-gray-300 rounded-xl py-1 text-sm font-black bg-white"
                />
                <button
                  type="button"
                  onClick={() => setModalQty((q) => q + 1)}
                  className="w-8 h-8 rounded-xl bg-white border border-gray-300 font-bold text-gray-700 hover:bg-gray-100 flex items-center justify-center text-sm shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Line Item Total:</span>
                <span className="text-xl font-black text-teal-700">
                  Rs. {(
                    (modalUnitType === "box"
                      ? (unitModalItem.box_sale_price || (unitModalItem.unit_price * (unitModalItem.strips_per_box || 10) * (unitModalItem.units_per_strip || 12)))
                      : modalUnitType === "strip"
                      ? (unitModalItem.strip_sale_price || (unitModalItem.unit_price * (unitModalItem.units_per_strip || 12)))
                      : (unitModalItem.unit_sale_price || unitModalItem.unit_price)) * modalQty
                  ).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUnitModalItem(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => addToCartWithUnit(unitModalItem, modalUnitType, modalQty)}
                  className="bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-teal-700 shadow-md flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POS Rapid Rush-Hour Hotkey Legend Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900 text-teal-200 px-4 py-2 text-xs font-mono font-bold flex items-center justify-around overflow-x-auto border-t border-teal-800/80 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <kbd className="bg-teal-700 text-white px-2 py-0.5 rounded shadow text-[10px]">F2</kbd> Search Medicine
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <kbd className="bg-teal-700 text-white px-2 py-0.5 rounded shadow text-[10px]">F4</kbd> Switch Customer Mode
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <kbd className="bg-teal-700 text-white px-2 py-0.5 rounded shadow text-[10px]">F8</kbd> Tender Cash Input
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <kbd className="bg-emerald-600 text-white px-2 py-0.5 rounded shadow text-[10px]">F9 / Ctrl+Enter</kbd> Instant Sale &amp; Print
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <kbd className="bg-slate-700 text-white px-2 py-0.5 rounded shadow text-[10px]">Esc</kbd> Close / Clear
        </div>
      </div>
    </div>
  );
}
