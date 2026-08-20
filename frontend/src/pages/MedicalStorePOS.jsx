import { useState, useEffect, useRef } from "react";
import { dbInventory, dbSales, dbVisits, dbPatients, dbClinic, dbPatientLedger } from "../api/db.js";
import { printThermalReceipt } from "../utils/thermalPrinter.js";
import PhotoLightbox from "../components/PhotoLightbox.jsx";

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
  const invoiceId = sale.receipt_no || sale.id || `POS-${Math.floor(1000 + Math.random() * 9000)}`;

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
              {(clinic?.name || "Dr. Kashif Khan").charAt(0)}
            </div>
            <div className="text-base font-black text-teal-800 mt-1">
              {clinic?.name || "Dr. Muhammad Kashif Khan's Homeopathic Clinic & Store"}
            </div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              Retail Medical Store Invoice
            </div>
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-gray-400 my-2" />

          {/* Meta Details List */}
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
                <div className="font-bold text-gray-900 flex items-center justify-between">
                  <span>{item.medicine_name}</span>
                  {Number(item.disc_pct || item.discount_pct || 0) > 0 && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {item.disc_pct || item.discount_pct}% OFF
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center text-gray-600 font-medium">
                  <span>{item.quantity || 1} {item.unit_label || "Unit"} × Rs. {Number(item.unit_price || 0).toFixed(2)}</span>
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
            {sale.payment_type === "cash" ? (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Cash Paid</span>
                  <span>Rs. {Number(cashTendered).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-teal-800 font-bold">
                  <span>Change Return</span>
                  <span>Rs. {Number(changeDue).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Payment Type</span>
                <span>Credit / Udhaar (Added to Patient Ledger)</span>
              </div>
            )}
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-gray-400 my-2" />

          {/* Centered Thank You Notice */}
          <div className="text-center font-bold text-gray-900 text-xs py-1">
            Thank You For Shopping With Us.<br />Please Visit Again
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
  const [selectedInventoryIndex, setSelectedInventoryIndex] = useState(0);

  // Mode: "walkin" vs "link"
  const [customerMode, setCustomerMode] = useState("walkin");
  const [visitQuery, setVisitQuery] = useState("");
  const [linkedVisit, setLinkedVisit] = useState(null);
  const [linkedPatient, setLinkedPatient] = useState(null);
  const [visitSearchResults, setVisitSearchResults] = useState([]);

  // Discount, Payment Type, Tendered Cash
  const [discountInput, setDiscountInput] = useState("");
  const [paymentType, setPaymentType] = useState("cash"); // "cash" or "credit"
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [cashTenderedInput, setCashTenderedInput] = useState("");
  const [showRxModal, setShowRxModal] = useState(false);

  const searchInputRef = useRef(null);
  const inventoryListRef = useRef(null);

  useEffect(() => {
    if (inventoryListRef.current) {
      const activeEl = inventoryListRef.current.querySelector(`[data-index="${selectedInventoryIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedInventoryIndex]);

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
        setShowRxModal(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function searchInventory(q) {
    setInventoryQuery(q);
    setSelectedInventoryIndex(0);
    setInventoryResults(dbInventory.search(q));
  }

  function handleSearchInputKeyDown(e) {
    const visibleList = inventoryResults.slice(0, 40);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedInventoryIndex((prev) => Math.min(visibleList.length - 1, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedInventoryIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visibleList.length > 0 && visibleList[selectedInventoryIndex]) {
        addToCart(visibleList[selectedInventoryIndex], 1);
      }
    }
  }

  // Helper to calculate line total with item percentage discount
  function calculateLineTotal(unitPrice, qty, discPct = 0) {
    const gross = (Number(unitPrice) || 0) * (Number(qty) || 0);
    const discAmount = gross * ((Number(discPct) || 0) / 100);
    return parseFloat(Math.max(0, gross - discAmount).toFixed(2));
  }

  // Direct Add To Cart (Quantity and percentage discount based)
  function addToCart(item, qty = 1, discPct = 0) {
    const unitPrice = Number(item.unit_sale_price || item.sale_price || item.box_sale_price || item.unit_price) || 0;
    const unitLabel = item.unit_label || "Unit";
    const initialDiscPct = Math.max(0, Math.min(100, parseFloat(discPct) || 0));

    setCart((prev) => {
      const existing = prev.find((c) => c.inventory_id === item.id);
      if (existing) {
        const newQty = existing.quantity + qty;
        const currentDisc = existing.disc_pct || 0;
        return prev.map((c) =>
          c.inventory_id === item.id
            ? {
                ...c,
                quantity: newQty,
                base_units_deducted: newQty,
                line_total: calculateLineTotal(unitPrice, newQty, currentDisc),
              }
            : c
        );
      }
      return [
        ...prev,
        {
          inventory_id: item.id,
          medicine_name: item.medicine_name,
          unit_label: unitLabel,
          quantity: qty,
          base_units_deducted: qty,
          unit_price: unitPrice,
          disc_pct: initialDiscPct,
          line_total: calculateLineTotal(unitPrice, qty, initialDiscPct),
          batch_no: item.batch_no || item.item_code || "",
          expiry_date: item.expiry_date || null,
        },
      ];
    });
  }

  function updateQty(inventoryId, delta) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.inventory_id !== inventoryId) return c;
          const newQty = Math.max(0, c.quantity + delta);
          return {
            ...c,
            quantity: newQty,
            base_units_deducted: newQty,
            line_total: calculateLineTotal(c.unit_price, newQty, c.disc_pct || 0),
          };
        })
        .filter((c) => c.quantity > 0)
    );
  }

  function setExactQty(inventoryId, exactQty) {
    const q = Math.max(1, parseInt(exactQty) || 1);
    setCart((prev) =>
      prev.map((c) => {
        if (c.inventory_id !== inventoryId) return c;
        return {
          ...c,
          quantity: q,
          base_units_deducted: q,
          line_total: calculateLineTotal(c.unit_price, q, c.disc_pct || 0),
        };
      })
    );
  }

  function setItemDiscount(inventoryId, discPct) {
    const pct = Math.max(0, Math.min(100, parseFloat(discPct) || 0));
    setCart((prev) =>
      prev.map((c) => {
        if (c.inventory_id !== inventoryId) return c;
        return {
          ...c,
          disc_pct: pct,
          line_total: calculateLineTotal(c.unit_price, c.quantity, pct),
        };
      })
    );
  }

  function removeFromCart(inventoryId) {
    setCart((prev) => prev.filter((c) => c.inventory_id !== inventoryId));
  }

  const grossItemsSubtotal = cart.reduce((sum, c) => sum + (c.unit_price * c.quantity), 0);
  const totalItemDiscounts = cart.reduce(
    (sum, c) => sum + (c.unit_price * c.quantity * ((c.disc_pct || 0) / 100)),
    0
  );
  const subtotal = cart.reduce((sum, c) => sum + c.line_total, 0);
  const discountVal = Math.min(subtotal, Math.max(0, Number(discountInput) || 0));
  const finalTotal = Math.max(0, subtotal - discountVal);

  const tenderedCashVal = Number(cashTenderedInput) || finalTotal;
  const changeDueVal = Math.max(0, tenderedCashVal - finalTotal);

  function checkout() {
    if (cart.length === 0) {
      alert("Cart is empty. Please add items to checkout.");
      return;
    }
    if (paymentType === "credit" && customerMode !== "link" && !linkedPatient) {
      alert("Credit / Udhaar sale requires linking to a registered Patient.");
      return;
    }

    // Check stock
    for (const cartItem of cart) {
      const inv = dbInventory.getById(cartItem.inventory_id);
      const available = inv ? (inv.store_stock ?? inv.stock_qty ?? inv.total_base_stock ?? 0) : 0;
      if (available < cartItem.quantity) {
        const proceed = confirm(`⚠️ Warning: ${cartItem.medicine_name} has only ${available} units in Store Counter stock, but you are selling ${cartItem.quantity}.\n\nDo you want to proceed anyway?`);
        if (!proceed) return;
      }
    }

    const paidVal = paymentType === "cash" ? finalTotal : Math.min(finalTotal, Number(amountPaidInput) || 0);
    const balanceDue = Math.max(0, finalTotal - paidVal);

    const sale = dbSales.checkout({
      visit_id: customerMode === "link" ? (linkedVisit?.id || null) : null,
      patient_id: customerMode === "link" ? (linkedPatient?.id || null) : null,
      patient_name: linkedPatient?.full_name || "Walk-in Patient",
      items: cart,
      subtotal_amount: subtotal,
      discount_amount: discountVal,
      total_amount: finalTotal,
      paid_amount: paidVal,
      balance_due: balanceDue,
      payment_type: paymentType,
      cash_tendered: paymentType === "cash" ? tenderedCashVal : paidVal,
      change_due: paymentType === "cash" ? changeDueVal : 0,
      cashier_name: "Store Staff",
    });

    if (paymentType === "credit" && linkedPatient) {
      dbPatientLedger.addCredit(
        linkedPatient.id,
        linkedPatient.full_name,
        balanceDue,
        `Pharmacy POS Invoice #${sale.receipt_no || sale.id}`
      );
    }

    setReceipt(sale);
    setCart([]);
    setDiscountInput("");
    setCashTenderedInput("");
    setAmountPaidInput("");
    setLinkedVisit(null);
    setLinkedPatient(null);
    setInventoryResults(dbInventory.getAll());
  }

  function searchVisits(q) {
    setVisitQuery(q);
    if (!q.trim()) {
      setVisitSearchResults([]);
      return;
    }
    const today = dbVisits.getTodayAll();
    const allPat = dbPatients.getAll();
    const matches = today.filter((v) => {
      const pat = allPat.find((p) => p.id === v.patient_id);
      return (
        String(v.token_number).includes(q) ||
        (pat?.full_name || "").toLowerCase().includes(q.toLowerCase()) ||
        (pat?.phone || "").includes(q)
      );
    });
    setVisitSearchResults(matches);
  }

  function linkVisit(v) {
    setLinkedVisit(v);
    const pat = dbPatients.getById(v.patient_id);
    setLinkedPatient(pat);
    setVisitQuery("");
    setVisitSearchResults([]);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-24 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              point_of_sale
            </span>
            Medical Store POS Counter
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Fast Walk-in &amp; OPD Prescription Dispensing Terminal</p>
        </div>

        {/* Customer Mode Switcher */}
        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setCustomerMode("walkin")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              customerMode === "walkin"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Walk-In Customer
          </button>
          <button
            type="button"
            onClick={() => setCustomerMode("link")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              customerMode === "link"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Link OPD Patient (F4)
          </button>
        </div>
      </div>

      {/* Linked Patient Bar (If linked mode is active) */}
      {customerMode === "link" && (
        <div className="bg-teal-50/70 border border-teal-200 p-3.5 rounded-2xl space-y-2">
          {!linkedPatient ? (
            <div>
              <label className="block text-xs font-bold text-teal-900 mb-1.5">
                Search Today&apos;s OPD Queue Patient (By Name, Token # or Phone):
              </label>
              <input
                type="text"
                value={visitQuery}
                onChange={(e) => searchVisits(e.target.value)}
                placeholder="Type patient name or token #..."
                className="w-full bg-white border border-teal-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {visitSearchResults.length > 0 && (
                <div className="mt-2 bg-white rounded-xl border border-gray-200 shadow-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                  {visitSearchResults.map((v) => {
                    const p = dbPatients.getById(v.patient_id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => linkVisit(v)}
                        className="w-full text-left p-2 hover:bg-teal-50 rounded-lg text-xs flex items-center justify-between"
                      >
                        <span className="font-bold text-gray-900">Token #{v.token_number} — {p?.full_name}</span>
                        <span className="text-gray-500">{p?.phone || "No phone"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700">person</span>
                <span className="font-black text-teal-950 text-sm">{linkedPatient.full_name}</span>
                <span className="text-xs bg-teal-200/60 text-teal-900 font-bold px-2 py-0.5 rounded-full">
                  Token #{linkedVisit.token_number}
                </span>
                {linkedVisit.prescription_image_url && (
                  <button
                    type="button"
                    onClick={() => setShowRxModal(true)}
                    className="text-xs bg-white text-teal-800 border border-teal-300 px-2 py-0.5 rounded font-bold hover:bg-teal-100 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">visibility</span>
                    View Dr. Prescription
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setLinkedPatient(null);
                  setLinkedVisit(null);
                }}
                className="text-xs text-rose-600 font-bold hover:underline"
              >
                Unlink
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Products on Left (7 cols), Cart on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Product Search & Inventory Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={inventoryQuery}
                onChange={(e) => searchInventory(e.target.value)}
                onKeyDown={handleSearchInputKeyDown}
                placeholder="Search medicine by name or code (F2)... [↑ / ↓ to navigate, Enter to add]"
                className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-600 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none transition-all"
              />
            </div>

            {/* Inventory List */}
            <div ref={inventoryListRef} className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto pr-1">
              {inventoryResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No medicine matches &quot;{inventoryQuery}&quot;.
                </div>
              ) : (
                <>
                  {inventoryResults.slice(0, 40).map((item, idx) => {
                    const stock = item.store_stock ?? item.stock_qty ?? item.total_base_stock ?? 0;
                    const price = item.unit_sale_price || item.sale_price || item.box_sale_price || item.unit_price || 0;
                    const isLow = stock <= (item.low_stock_threshold || 6);
                    const isHighlighted = idx === selectedInventoryIndex;

                    return (
                      <div
                        key={item.id}
                        data-index={idx}
                        onClick={() => {
                          setSelectedInventoryIndex(idx);
                          addToCart(item, 1);
                        }}
                        className={`py-3 px-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                          isHighlighted
                            ? "bg-teal-50 border-2 border-teal-500 shadow-sm"
                            : "hover:bg-gray-50 border border-transparent"
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="font-bold text-sm text-gray-900 truncate flex items-center gap-2">
                            {item.medicine_name}
                            {isHighlighted && (
                              <span className="text-[10px] bg-teal-600 text-white font-bold px-1.5 py-0.2 rounded font-mono">
                                ↵ Enter
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            <span className="font-bold text-teal-800">Rs. {price}</span>
                            <span>·</span>
                            <span className={`font-semibold ${stock === 0 ? "text-rose-600 font-bold" : isLow ? "text-amber-700" : "text-gray-600"}`}>
                              Stock: {stock} {item.unit_label || "Units"}
                            </span>
                            {item.item_code && (
                              <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-mono">
                                {item.item_code}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Add Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInventoryIndex(idx);
                            addToCart(item, 1);
                          }}
                          className={`font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-sm transition-all shrink-0 ${
                            isHighlighted
                              ? "bg-teal-700 text-white shadow-teal-700/20"
                              : "bg-teal-600 hover:bg-teal-700 text-white"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                          Add
                        </button>
                      </div>
                    );
                  })}
                  {inventoryResults.length > 40 && (
                    <div className="py-2 text-center text-[11px] text-gray-400 font-medium bg-gray-50/50 rounded-lg my-1">
                      Showing top 40 of {inventoryResults.length} matching items. Type to narrow search.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Cart */}
        <div className="lg:col-span-5">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="font-black text-gray-900 flex items-center gap-1.5 text-base">
                <span className="material-symbols-outlined text-teal-600">shopping_cart</span>
                Checkout Cart
              </div>
              <span className="text-xs bg-teal-50 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                {cart.length} item{cart.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <span className="material-symbols-outlined text-4xl text-gray-300">shopping_cart</span>
                <p className="text-xs">Cart is empty. Click &quot;Add&quot; on any medicine.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.inventory_id}
                    className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 flex flex-col gap-2.5 shadow-2xs hover:border-teal-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-gray-900 truncate">
                          {item.medicine_name}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium mt-0.5">
                          <span>Rs. {item.unit_price} / {item.unit_label || "unit"}</span>
                          {(item.disc_pct || 0) > 0 && (
                            <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                              {item.disc_pct}% OFF
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Line Total */}
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-teal-950 font-mono">
                          Rs. {item.line_total}
                        </div>
                        {(item.disc_pct || 0) > 0 && (
                          <div className="text-[10px] text-gray-400 line-through">
                            Rs. {(item.unit_price * item.quantity).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Controls Row: Qty + Disc% + Remove */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200/50">
                      {/* Quantity Input Box & Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQty(item.inventory_id, -1)}
                          className="w-6 h-6 bg-white border border-gray-300 hover:bg-gray-100 rounded-md text-gray-700 font-black text-xs flex items-center justify-center transition-colors shadow-2xs"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => setExactQty(item.inventory_id, e.target.value)}
                          className="w-10 bg-white border border-gray-300 rounded-md py-0.5 text-center text-xs font-black text-gray-900 focus:outline-none focus:border-teal-600"
                          title="Quantity"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(item.inventory_id, 1)}
                          className="w-6 h-6 bg-white border border-gray-300 hover:bg-gray-100 rounded-md text-gray-700 font-black text-xs flex items-center justify-center transition-colors shadow-2xs"
                        >
                          +
                        </button>
                      </div>

                      {/* Percentage Discount Field */}
                      <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-amber-300 shadow-2xs">
                        <label className="text-[10px] text-amber-900 font-bold uppercase tracking-tight">Disc%:</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.disc_pct === 0 ? "" : (item.disc_pct || "")}
                          placeholder="0%"
                          onChange={(e) => setItemDiscount(item.inventory_id, e.target.value)}
                          className="w-10 text-center text-xs font-black text-amber-950 focus:outline-none bg-transparent"
                          title="Medicine Discount Percentage (%)"
                        />
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.inventory_id)}
                        className="text-[11px] text-rose-600 hover:text-rose-800 hover:underline font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Calculations & Payment Options */}
            {cart.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-gray-600">
                  <span>Gross Items Total:</span>
                  <span className="font-bold text-gray-900">Rs. {grossItemsSubtotal.toLocaleString()}</span>
                </div>

                {totalItemDiscounts > 0 && (
                  <div className="flex justify-between items-center text-amber-700 font-bold">
                    <span>Medicine Line Discounts:</span>
                    <span>- Rs. {totalItemDiscounts.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-gray-600">
                  <span>Items Subtotal:</span>
                  <span className="font-bold text-gray-900">Rs. {subtotal.toLocaleString()}</span>
                </div>

                {/* Additional Overall Bill Discount */}
                <div className="flex items-center justify-between gap-2 bg-amber-50/70 p-2 rounded-xl border border-amber-200">
                  <span className="text-amber-900 font-bold">Additional Bill Discount (Rs):</span>
                  <input
                    type="number"
                    min="0"
                    max={subtotal}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="0"
                    className="w-24 bg-white border border-amber-300 rounded-lg px-2 py-1 text-right text-xs font-black text-amber-950 focus:outline-none focus:border-amber-600 shadow-2xs"
                  />
                </div>

                {/* Grand Total */}
                <div className="flex justify-between items-center bg-teal-50 p-3.5 rounded-2xl border border-teal-200">
                  <div>
                    <span className="font-bold text-teal-950 text-sm block">Net Payable:</span>
                    <span className="text-[10px] text-teal-700 font-medium">Final total to collect</span>
                  </div>
                  <span className="font-black text-teal-950 text-xl font-mono">Rs. {finalTotal.toLocaleString()}</span>
                </div>

                {/* Payment Method Switch */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentType("cash")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      paymentType === "cash"
                        ? "bg-teal-700 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    💵 Cash Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("credit")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      paymentType === "credit"
                        ? "bg-amber-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    📒 Udhaar / Credit
                  </button>
                </div>

                {/* Cash Tendered & Change Return */}
                {paymentType === "cash" ? (
                  <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="pos-cash-tendered-input" className="text-gray-700 font-bold">
                        Cash Given (F8):
                      </label>
                      <input
                        id="pos-cash-tendered-input"
                        type="number"
                        min="0"
                        value={cashTenderedInput}
                        onChange={(e) => setCashTenderedInput(e.target.value)}
                        placeholder={finalTotal.toString()}
                        className="w-28 bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-right text-sm font-black focus:outline-none focus:border-teal-600"
                      />
                    </div>
                    {changeDueVal > 0 && (
                      <div className="flex justify-between items-center text-teal-800 font-bold text-xs pt-1 border-t border-gray-200">
                        <span>Change to Return:</span>
                        <span className="text-sm font-black">Rs. {changeDueVal.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold">Patient Credit / Udhaar Sale</div>
                    <p className="text-[11px] text-amber-700">
                      Balance will be automatically posted to {linkedPatient ? linkedPatient.full_name : "Linked Patient"}&apos;s credit ledger.
                    </p>
                  </div>
                )}

                {/* Checkout Action */}
                <button
                  id="pos-checkout-btn"
                  type="button"
                  onClick={checkout}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-teal-700/25 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">receipt_long</span>
                  Complete Sale &amp; Print (F9)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HD Prescription Viewer Modal */}
      {showRxModal && linkedVisit && linkedVisit.prescription_image_url && (
        <PhotoLightbox
          src={linkedVisit.prescription_image_url}
          alt={`Doctor Prescription (Token #${linkedVisit.token_number} - ${linkedPatient?.full_name || "Patient"})`}
          onClose={() => setShowRxModal(false)}
        />
      )}

      {/* Receipt Output Modal */}
      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
