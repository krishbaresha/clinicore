import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { dbInventory, dbSales, dbVisits, dbPatients, dbClinic, dbPatientLedger, dbSuppliers, dbUsers, dbSalesmen } from "../api/db.js";
import { printThermalReceipt } from "../utils/thermalPrinter.js";
import PhotoLightbox from "../components/PhotoLightbox.jsx";

// Company brand color config for badges
const COMPANY_COLORS = {
  "BM": { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200", short: "BM" },
  "PAUL BROOKS": { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", short: "PAUL" },
  "SCHWABE": { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200", short: "SCHW" },
  "MEKTUM": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", short: "MEKT" },
  "BLOSSOM": { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", short: "BLOS" },
};

function CompanyBadge({ companyName, small = false }) {
  if (!companyName) return null;
  const key = companyName.toUpperCase();
  const cfg = COMPANY_COLORS[key] || {
    bg: "bg-teal-50",
    text: "text-teal-900",
    border: "border-teal-200/80",
    short: companyName.slice(0, 4).toUpperCase(),
  };
  return (
    <span className={`inline-flex items-center font-black border rounded-full px-2 py-0.5 shadow-2xs ${cfg.bg} ${cfg.text} ${cfg.border} ${small ? "text-[9.5px]" : "text-[11px]"}`}>
      [{small ? cfg.short : companyName}]
    </span>
  );
}

function ReceiptModal({ sale, onClose }) {
  if (!sale) return null;

  const clinic = dbClinic.get();
  const subtotal = sale.subtotal_amount ?? sale.items.reduce((s, i) => s + i.line_total, 0);
  const discount = sale.discount_amount ?? 0;
  const cashTendered = sale.cash_tendered ?? sale.total_amount;
  const changeDue = sale.change_due ?? Math.max(0, cashTendered - sale.total_amount);
  
  const rawDate = sale.sale_date ? new Date(sale.sale_date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const cashierName = sale.cashier_name || sale.user_name || "Cashier Desk";
  const customerName = sale.patient_name || (sale.visit_id ? "Linked Patient" : "Walk-In-Customer");
  const invoiceId = sale.receipt_no || sale.id || `POS-${Math.floor(1000 + Math.random() * 9000)}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-md w-full my-6">
        {/* Receipt Voucher Window Container */}
        <div className="glass-modal p-6 border border-slate-200/80 text-slate-800 text-xs font-sans space-y-4 relative">
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors print:hidden cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>

          {/* Top Clinic Branding & Logo */}
          <div className="text-center flex flex-col items-center">
            <img
              src="/clinic-logo.png"
              alt="Clinic Logo"
              className="h-10 w-auto object-contain mx-auto drop-shadow-xs mb-1"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <div className="text-base font-black text-slate-900">
              {clinic?.name || "Dr. Muhammad Asif Ashraf Khan Clinic & Store"}
            </div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mt-0.5">
              Retail Medical Store Invoice
            </div>
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-slate-300 my-2" />

          {/* Meta Details List */}
          <div className="text-xs text-slate-800 font-semibold space-y-1 leading-relaxed">
            <div><span className="text-slate-500 font-medium">Date &amp; Time :</span> {dateTimeStr}</div>
            <div><span className="text-slate-500 font-medium">Cashier :</span> {cashierName}</div>
            <div><span className="text-slate-500 font-medium">Customer :</span> {customerName}</div>
            <div><span className="text-slate-500 font-medium">Invoice # :</span> {invoiceId}</div>
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-slate-300 my-2" />

          {/* Purchased Items List */}
          <div className="space-y-2">
            {sale.items.map((item, i) => (
              <div key={i} className="text-xs space-y-0.5">
                <div className="font-black text-slate-900 flex items-center justify-between">
                  <span>{item.medicine_name}</span>
                  {Number(item.disc_pct || item.discount_pct || 0) > 0 && (
                    <span className="text-[10px] font-black text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {item.disc_pct || item.discount_pct}% OFF
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>{item.quantity || 1} {item.unit_label || "Unit"} × Rs. {Number(item.unit_price || 0).toFixed(2)}</span>
                  <span className="font-black text-slate-950 font-mono">Rs. {Number(item.line_total || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-slate-300 my-2" />

          {/* Summary Breakdown */}
          <div className="space-y-1 text-xs text-slate-700 font-semibold">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono">Rs. {Number(subtotal).toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-teal-700 font-bold">
                <span>Discount</span>
                <span className="font-mono">- Rs. {Number(discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
              <span>Grand Total</span>
              <span className="font-mono">Rs. {Number(sale.total_amount || subtotal).toFixed(2)}</span>
            </div>
            {sale.payment_type === "cash" ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Cash Paid</span>
                  <span className="font-mono">Rs. {Number(cashTendered).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-teal-800 font-bold">
                  <span>Change Return</span>
                  <span className="font-mono">Rs. {Number(changeDue).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-amber-800 font-bold">
                <span>Payment Type</span>
                <span>Credit / Udhaar (Added to Patient Ledger)</span>
              </div>
            )}
          </div>

          {/* Dotted Line */}
          <div className="border-t border-dotted border-slate-300 my-2" />

          {/* Centered Thank You Notice */}
          <div className="text-center font-bold text-slate-800 text-xs py-1">
            Thank You For Shopping With Us.<br />Please Visit Again
          </div>

          {/* Interactive Print Button */}
          <div className="pt-2 flex justify-start print:hidden">
            <button
              onClick={() => printThermalReceipt(sale, clinic)}
              className="border border-teal-500 text-teal-800 bg-teal-50 hover:bg-teal-100 min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Print Receipt (80mm)</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function MedicalStorePOS() {
  const { user } = useAuth();
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

  // Active POS Operator Switcher (Single-login multi-cashier workflow)
  const [activeOperator, setActiveOperator] = useState(() => {
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("cf_pos_active_operator") : null;
      if (saved) return JSON.parse(saved);
    } catch {}
    if (user?.name) return { id: user.userId || user.id, name: user.name, role: user.role || "Cashier" };
    return { id: "op_default", name: "Counter Staff", role: "Cashier" };
  });

  const availableOperators = useMemo(() => {
    const users = dbUsers.getActiveStaff ? dbUsers.getActiveStaff("wh_str") : dbUsers.getAll();
    const salesmen = dbSalesmen.getAll ? dbSalesmen.getAll() : [];
    const list = [
      ...users.map((u) => ({ id: u.id, name: u.display_label || u.name, role: u.role || "Staff" })),
      ...salesmen.map((s) => ({ id: s.id, name: s.name, role: "Salesman" })),
    ];
    const unique = [];
    const names = new Set();
    for (const op of list) {
      if (op.name && !names.has(op.name.toLowerCase())) {
        names.add(op.name.toLowerCase());
        unique.push(op);
      }
    }
    return unique.length > 0 ? unique : [{ id: "op_default", name: "Counter Staff", role: "Cashier" }];
  }, []);

  const handleOperatorChange = (op) => {
    setActiveOperator(op);
    try {
      localStorage.setItem("cf_pos_active_operator", JSON.stringify(op));
    } catch {}
  };

  const handleReprintLastReceipt = () => {
    const allSales = dbSales.getAll();
    if (!allSales || allSales.length === 0) {
      alert("No previous sales found to reprint.");
      return;
    }
    const lastSale = allSales[0];
    printThermalReceipt(lastSale, dbClinic.get());
  };

  const searchInputRef = useRef(null);
  const inventoryListRef = useRef(null);
  const cartContainerRef = useRef(null);

  // Dual-Mode Medicine Search
  const [searchMode, setSearchMode] = useState("global"); // "company" | "global"
  const [posCompanyCode, setPosCompanyCode] = useState("ALL");
  const [posCompanyFilter, setPosCompanyFilter] = useState(""); // resolved full company name or ""

  const activeCompanyList = useMemo(() => {
    const fromSuppliers = (dbSuppliers.getAll() || []).map((s) => s.name).filter(Boolean);
    const fromInventory = (inventoryResults || []).map((i) => i.company_name).filter(Boolean);
    const set = Array.from(new Set([...fromSuppliers, ...fromInventory]));
    return set.map((name) => ({ code: name.slice(0, 4).toUpperCase(), name }));
  }, [inventoryResults]);

  useEffect(() => {
    if (inventoryListRef.current) {
      const activeEl = inventoryListRef.current.querySelector(`[data-index="${selectedInventoryIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedInventoryIndex]);

  const posStateRef = useRef({ cart, showRxModal, receipt, inventoryQuery });
  posStateRef.current = { cart, showRxModal, receipt, inventoryQuery };

  useEffect(() => {
    const refreshData = () => {
      setInventoryResults(dbInventory.getAll());
    };
    refreshData();
    window.addEventListener("clinicflow_status_update", refreshData);

    function handleKeyDown(e) {
      // 1. F1 or Alt+S: Focus Medicine Search Bar
      if (e.key === "F1" || (e.altKey && (e.key === "s" || e.key === "S"))) {
        e.preventDefault();
        if (searchInputRef.current) searchInputRef.current.focus();
      }
      // 2. F2, F9 or Ctrl+Enter: Fast Checkout & Print Bill
      else if (e.key === "F2" || e.key === "F9" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        const checkoutBtn = document.getElementById("pos-checkout-btn");
        if (checkoutBtn) checkoutBtn.click();
      }
      // 3. F3: Toggle Company / Brand Filter
      else if (e.key === "F3") {
        e.preventDefault();
        setSearchMode((prev) => {
          const next = prev === "global" ? "company" : "global";
          if (next === "global") { setPosCompanyCode("ALL"); setPosCompanyFilter(""); }
          return next;
        });
      }
      // 4. F4: Toggle Walk-In vs Link OPD Doctor Prescription
      else if (e.key === "F4") {
        e.preventDefault();
        setCustomerMode((prev) => (prev === "walkin" ? "link" : "walkin"));
      }
      // 5. F6: Toggle Payment Method (Cash vs Credit / Udhaar)
      else if (e.key === "F6") {
        e.preventDefault();
        setPaymentType((prev) => (prev === "cash" ? "credit" : "cash"));
      }
      // 6. F7: Focus Bill Discount (Rs)
      else if (e.key === "F7") {
        e.preventDefault();
        const discEl = document.getElementById("pos-discount-input");
        if (discEl) {
          discEl.focus();
          discEl.select();
        }
      }
      // 7. F8: Focus Cash Given (Tendered Cash)
      else if (e.key === "F8") {
        e.preventDefault();
        const cashEl = document.getElementById("pos-cash-tendered-input");
        if (cashEl) {
          cashEl.focus();
          cashEl.select();
        }
      }
      // 8. F10: Instant Reprint Last Bill
      else if (e.key === "F10") {
        e.preventDefault();
        handleReprintLastReceipt();
      }
      // 9. F11 or Alt+C: Clear Cart / New Bill
      else if (e.key === "F11" || (e.altKey && (e.key === "c" || e.key === "C"))) {
        e.preventDefault();
        const currentCart = posStateRef.current.cart;
        if (currentCart && currentCart.length > 0) {
          if (confirm("Clear current cart and start a fresh bill (F11)?")) {
            setCart([]);
            setDiscountInput("");
            setCashTenderedInput("");
            if (searchInputRef.current) searchInputRef.current.focus();
          }
        }
      }
      // 10. Escape: Close Modals or Clear Search
      else if (e.key === "Escape") {
        const { showRxModal: sRx, receipt: rec, inventoryQuery: invQ } = posStateRef.current;
        if (sRx) {
          setShowRxModal(false);
        } else if (rec) {
          setReceipt(null);
        } else if (invQ) {
          setInventoryQuery("");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("clinicflow_status_update", refreshData);
    };
  }, []);

  function searchInventory(q) {
    setInventoryQuery(q);
    setSelectedInventoryIndex(0);
    // In Company mode, filter strictly by active company; in Global mode search all
    const companyArg = searchMode === "company" && posCompanyFilter ? posCompanyFilter : "all";
    setInventoryResults(dbInventory.search(q, companyArg));
  }

  function handleSearchInputKeyDown(e) {
    const visibleList = inventoryResults.slice(0, 40);
    if (e.key === "ArrowDown") {
      if (visibleList.length > 0) {
        e.preventDefault();
        setSelectedInventoryIndex((prev) => Math.min(visibleList.length - 1, prev + 1));
      } else if (cart.length > 0) {
        e.preventDefault();
        const firstCartQty = document.getElementById("pos-cart-qty-0");
        if (firstCartQty) { firstCartQty.focus(); firstCartQty.select(); }
      }
    } else if (e.key === "ArrowUp") {
      if (visibleList.length > 0) {
        e.preventDefault();
        setSelectedInventoryIndex((prev) => Math.max(0, prev - 1));
      }
    } else if (e.key === "ArrowRight") {
      if (cart.length > 0 && (!inventoryQuery || inventoryQuery.length === 0)) {
        e.preventDefault();
        const firstCartQty = document.getElementById("pos-cart-qty-0");
        if (firstCartQty) { firstCartQty.focus(); firstCartQty.select(); }
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visibleList.length > 0 && visibleList[selectedInventoryIndex]) {
        addToCart(visibleList[selectedInventoryIndex], 1);
      }
    }
  }

  function handleCartInputKeyDown(e, index, field) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (index < cart.length - 1) {
        const nextEl = document.getElementById(`pos-cart-${field}-${index + 1}`);
        if (nextEl) { nextEl.focus(); nextEl.select(); }
      } else {
        const discEl = document.getElementById("pos-discount-input");
        if (discEl) { discEl.focus(); discEl.select(); }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) {
        const prevEl = document.getElementById(`pos-cart-${field}-${index - 1}`);
        if (prevEl) { prevEl.focus(); prevEl.select(); }
      } else {
        if (searchInputRef.current) { searchInputRef.current.focus(); searchInputRef.current.select(); }
      }
    } else if (e.key === "ArrowRight" && field === "qty") {
      e.preventDefault();
      const discEl = document.getElementById(`pos-cart-disc-${index}`);
      if (discEl) { discEl.focus(); discEl.select(); }
    } else if (e.key === "ArrowLeft" && field === "disc") {
      e.preventDefault();
      const qtyEl = document.getElementById(`pos-cart-qty-${index}`);
      if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
    } else if (e.key === "ArrowLeft" && field === "qty") {
      e.preventDefault();
      if (searchInputRef.current) { searchInputRef.current.focus(); searchInputRef.current.select(); }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (field === "qty") {
        const discEl = document.getElementById(`pos-cart-disc-${index}`);
        if (discEl) { discEl.focus(); discEl.select(); }
      } else {
        if (index < cart.length - 1) {
          const nextQtyEl = document.getElementById(`pos-cart-qty-${index + 1}`);
          if (nextQtyEl) { nextQtyEl.focus(); nextQtyEl.select(); }
        } else {
          const cashEl = document.getElementById("pos-cash-tendered-input");
          if (cashEl) { cashEl.focus(); cashEl.select(); }
        }
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
    setTimeout(() => {
      if (cartContainerRef.current) {
        cartContainerRef.current.scrollTop = cartContainerRef.current.scrollHeight;
      }
    }, 40);
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

    // Check stock: Strict Anti-Theft Guard
    for (const cartItem of cart) {
      const inv = dbInventory.getById(cartItem.inventory_id);
      const available = inv ? (inv.store_stock ?? inv.stock_qty ?? inv.total_base_stock ?? 0) : 0;
      if (available < cartItem.quantity) {
        alert(`🚫 Anti-Theft Guard: '${cartItem.medicine_name}' has only ${available} units available in Store Counter stock. Cannot sell ${cartItem.quantity} units.\n\nPlease request a stock transfer from Main Godown first.`);
        return;
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
      cashier_id: activeOperator.id,
      cashier_name: activeOperator.name,
      warehouse_id: "wh_str",
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
    const filtered = (today || []).filter((v) => {
      const p = allPat.find((pt) => pt.id === v.patient_id);
      const name = p?.full_name?.toLowerCase() || "";
      const phone = p?.phone || "";
      const token = String(v.token_number || "");
      const match = q.toLowerCase();
      return name.includes(match) || phone.includes(match) || token.includes(match);
    });
    setVisitSearchResults(filtered);
  }

  function linkVisit(v) {
    setLinkedVisit(v);
    const pat = dbPatients.getById(v.patient_id);
    setLinkedPatient(pat);
    setVisitQuery("");
    setVisitSearchResults([]);
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-5 pb-24 font-sans zero-horizontal-overflow">
      {/* ── Top Header Banner & Operator Quick Controls ── */}
      <div className="glass-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-teal-600 text-2xl sm:text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              point_of_sale
            </span>
            <span>Medical Store POS Counter</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Fast Walk-in Counter &amp; OPD Prescription Dispensing Terminal
          </p>
        </div>

        {/* Right Controls: Operator Switcher + Reprint + Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Cashier / Operator Quick Switcher */}
          <div className="flex items-center gap-2 bg-teal-50/80 border border-teal-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="material-symbols-outlined text-teal-700 text-base">badge</span>
            <span className="text-[11px] font-black text-teal-950 uppercase tracking-tight">Operator:</span>
            <select
              value={activeOperator.id}
              onChange={(e) => {
                const found = availableOperators.find((op) => op.id === e.target.value);
                if (found) handleOperatorChange(found);
              }}
              className="bg-white text-teal-950 font-black text-xs px-2.5 py-1 rounded-lg border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
            >
              {availableOperators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name} ({op.role})
                </option>
              ))}
            </select>
          </div>

          {/* Instant Reprint Last Bill (F10) */}
          <button
            type="button"
            onClick={handleReprintLastReceipt}
            title="Instant reprint last printed receipt (Hotkey: F10)"
            className="touch-pill min-h-[40px] text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base text-amber-700">print</span>
            <span>Reprint (F10)</span>
          </button>

          {/* Customer Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setCustomerMode("walkin")}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                customerMode === "walkin"
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Walk-In
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode("link")}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                customerMode === "link"
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Link OPD (F4)
            </button>
          </div>
        </div>
      </div>

      {/* ── Linked Patient Bar (If linked mode is active) ── */}
      {customerMode === "link" && (
        <div className="glass-card bg-teal-50/80 border-teal-200/80 p-4 rounded-2xl space-y-2.5">
          {!linkedPatient ? (
            <div>
              <label className="block text-xs font-black text-teal-950 mb-1.5">
                Search Today&apos;s OPD Queue Patient (By Name, Token # or Phone):
              </label>
              <input
                type="text"
                value={visitQuery}
                onChange={(e) => searchVisits(e.target.value)}
                placeholder="Type patient name or token #..."
                className="w-full bg-white border border-teal-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
              {visitSearchResults.length > 0 && (
                <div className="mt-2 bg-white rounded-xl border border-slate-200 shadow-xl p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                  {visitSearchResults.map((v) => {
                    const p = dbPatients.getById(v.patient_id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => linkVisit(v)}
                        className="w-full text-left p-2 hover:bg-teal-50 rounded-lg text-xs flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-bold text-slate-900">Token #{v.token_number} — {p?.full_name}</span>
                        <span className="text-slate-500 font-medium">{p?.phone || "No phone"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="material-symbols-outlined text-teal-700">person</span>
                <span className="font-black text-slate-900 text-sm">{linkedPatient.full_name}</span>
                <span className="text-xs bg-teal-200/70 text-teal-950 font-bold px-2.5 py-0.5 rounded-full">
                  Token #{linkedVisit.token_number}
                </span>
                {linkedVisit.prescription_image_url && (
                  <button
                    type="button"
                    onClick={() => setShowRxModal(true)}
                    className="text-xs bg-white text-teal-900 border border-teal-300 px-3 py-1 rounded-lg font-bold hover:bg-teal-100 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    <span>View Dr. Prescription</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setLinkedPatient(null);
                  setLinkedVisit(null);
                }}
                className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
              >
                Unlink Patient
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Main Split-Screen Layout: Medicine Matrix (Left 7 Cols) + Checkout Cart (Right 5 Cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── Left Column: Search & Inventory Matrix ── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card p-4 sm:p-5 space-y-3.5">
            {/* Dual-Mode Search Mode Switcher */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setSearchMode("company"); }}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    searchMode === "company" ? "bg-teal-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🏢 Company Mode
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchMode("global"); setPosCompanyCode("ALL"); setPosCompanyFilter(""); setInventoryResults(dbInventory.getAll()); }}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    searchMode === "global" ? "bg-teal-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🌐 Global Search
                </button>
              </div>
              <span className="text-[11px] text-slate-400 font-mono font-bold">Hotkey: F3 to toggle</span>
            </div>

            {/* Company Selector Dropdown (Company Mode) */}
            {searchMode === "company" && (
              <div className="flex gap-2.5 mb-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Select Manufacturer / Company
                  </label>
                  <select
                    value={posCompanyCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setPosCompanyCode(code);
                      const resolved = code === "ALL" ? "" : code;
                      setPosCompanyFilter(resolved);
                      setInventoryQuery("");
                      const results = resolved ? dbInventory.getByCompany(resolved) : dbInventory.getAll();
                      setInventoryResults(results);
                      setSelectedInventoryIndex(0);
                      setTimeout(() => searchInputRef.current?.focus(), 50);
                    }}
                    className="w-full min-h-[44px] border border-teal-300/90 rounded-xl px-3.5 py-2 text-xs font-bold bg-teal-50/70 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">🌐 All Companies (Global Inventory)</option>
                    {activeCompanyList.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {posCompanyFilter && (
                  <div className="flex items-end pb-1">
                    <CompanyBadge companyName={posCompanyFilter} />
                  </div>
                )}
              </div>
            )}

            {/* Search Input with F2 shortcut */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={inventoryQuery}
                onChange={(e) => searchInventory(e.target.value)}
                onKeyDown={handleSearchInputKeyDown}
                placeholder={searchMode === "company" && posCompanyFilter
                  ? `Search inside ${posCompanyFilter}... (↑↓ to navigate, Enter to add)`
                  : "Search medicine by name or code (F1)... [↑ / ↓ to navigate, Enter to add]"}
                className="w-full min-h-[46px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-600 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium focus:outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Inventory Results Matrix */}
            <div ref={inventoryListRef} className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
              {inventoryResults.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-medium">
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
                        className={`py-3 px-3.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                          isHighlighted
                            ? "bg-teal-50/80 border-2 border-teal-500 shadow-xs"
                            : "hover:bg-slate-50 border border-transparent"
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="font-bold text-sm text-slate-900 truncate flex items-center gap-2 flex-wrap">
                            <span>{item.medicine_name}</span>
                            {/* Global mode: show company brand tag */}
                            {item.company_name && (
                              <CompanyBadge companyName={item.company_name} small />
                            )}
                            {isHighlighted && (
                              <span className="text-[10px] bg-teal-700 text-white font-black px-1.5 py-0.2 rounded font-mono">
                                ↵ Enter
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                            <span className="font-black text-teal-800 font-mono">Rs. {price}</span>
                            <span>·</span>
                            <span className={`font-bold ${stock === 0 ? "text-rose-600" : isLow ? "text-amber-700" : "text-slate-600"}`}>
                              Stock: {stock} {item.unit_label || "Units"}
                            </span>
                            {item.item_code && (
                              <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                                {item.item_code}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Add Button with 44px touch area */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInventoryIndex(idx);
                            addToCart(item, 1);
                          }}
                          className={`touch-target-44 min-h-[44px] min-w-[70px] font-black text-xs px-3.5 py-2 rounded-xl flex items-center justify-center gap-1 shadow-xs transition-all shrink-0 cursor-pointer active:scale-95 ${
                            isHighlighted
                              ? "bg-teal-700 text-white shadow-teal-700/20"
                              : "bg-teal-600 hover:bg-teal-700 text-white"
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">add</span>
                          <span>Add</span>
                        </button>
                      </div>
                    );
                  })}
                  {inventoryResults.length > 40 && (
                    <div className="py-2 text-center text-[11px] text-slate-400 font-medium bg-slate-50/50 rounded-lg my-1">
                      Showing top 40 of {inventoryResults.length} matching items. Type to narrow search.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column: Touch-Friendly Checkout Cart ── */}
        <div className="lg:col-span-5">
          <div className="glass-card p-4 sm:p-5 sticky top-20 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <div className="font-black text-slate-900 flex items-center gap-2 text-base">
                <span className="material-symbols-outlined text-teal-600 text-xl">shopping_cart</span>
                <span>Checkout Cart</span>
              </div>
              <span className="text-xs bg-teal-50 text-teal-900 font-black px-2.5 py-0.5 rounded-full border border-teal-200">
                {cart.length} item{cart.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <span className="material-symbols-outlined text-4xl text-slate-300">shopping_cart</span>
                <p className="text-xs font-medium">Cart is empty. Tap &quot;Add&quot; on any medicine.</p>
              </div>
            ) : (
              <div ref={cartContainerRef} className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                {cart.map((item, idx) => (
                  <div
                    key={item.inventory_id}
                    className="p-3 bg-white/80 rounded-xl border border-slate-200/80 flex flex-col gap-2.5 shadow-2xs hover:border-teal-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-xs text-slate-900 truncate">
                          {item.medicine_name}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
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
                          <div className="text-[10px] text-slate-400 line-through font-mono">
                            Rs. {(item.unit_price * item.quantity).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Controls Row: 44px Touch Steppers + 44px Disc% + Remove */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                      {/* Quantity Stepper (+ / -) with 44px ergonomic touch bounds */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQty(item.inventory_id, -1)}
                          className="touch-target-44 w-10 h-10 min-h-[40px] min-w-[40px] bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-base rounded-xl flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer border border-slate-200"
                          title="Decrease Quantity"
                        >
                          -
                        </button>
                        <input
                          id={`pos-cart-qty-${idx}`}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => setExactQty(item.inventory_id, e.target.value)}
                          onKeyDown={(e) => handleCartInputKeyDown(e, idx, "qty")}
                          className="w-12 h-10 min-h-[40px] bg-white border border-slate-300 rounded-xl text-center text-xs font-black text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono shadow-2xs"
                          title="Quantity (Navigate with Arrow Keys ↑ ↓ ← →)"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(item.inventory_id, 1)}
                          className="touch-target-44 w-10 h-10 min-h-[40px] min-w-[40px] bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-base rounded-xl flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer border border-slate-200"
                          title="Increase Quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* Percentage Discount Field (44px target) */}
                      <div className="flex items-center gap-1.5 bg-amber-50/80 px-2.5 h-10 min-h-[40px] rounded-xl border border-amber-300 shadow-2xs">
                        <label className="text-[10px] text-amber-950 font-black uppercase tracking-tight">Disc%:</label>
                        <input
                          id={`pos-cart-disc-${idx}`}
                          type="number"
                          min="0"
                          max="100"
                          value={item.disc_pct === 0 ? "" : (item.disc_pct || "")}
                          placeholder="0%"
                          onChange={(e) => setItemDiscount(item.inventory_id, e.target.value)}
                          onKeyDown={(e) => handleCartInputKeyDown(e, idx, "disc")}
                          className="w-10 text-center text-xs font-black text-amber-950 focus:outline-none bg-transparent font-mono"
                          title="Medicine Discount Percentage (%) (Navigate with Arrow Keys ↑ ↓ ← →)"
                        />
                      </div>

                      {/* Remove Button with 44px target */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.inventory_id)}
                        className="touch-target-44 w-10 h-10 min-h-[40px] min-w-[40px] text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200 rounded-xl font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center shadow-2xs"
                        title="Remove item"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Calculations & Payment Summary HUD */}
            {cart.length > 0 && (
              <div className="border-t border-slate-200/60 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>Gross Items Total:</span>
                  <span className="font-black text-slate-900 font-mono">Rs. {grossItemsSubtotal.toLocaleString()}</span>
                </div>

                {totalItemDiscounts > 0 && (
                  <div className="flex justify-between items-center text-amber-800 font-bold">
                    <span>Medicine Line Discounts:</span>
                    <span className="font-mono">- Rs. {totalItemDiscounts.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>Items Subtotal:</span>
                  <span className="font-black text-slate-900 font-mono">Rs. {subtotal.toLocaleString()}</span>
                </div>

                {/* Additional Overall Bill Discount */}
                <div className="flex items-center justify-between gap-2 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                  <label htmlFor="pos-discount-input" className="text-amber-900 font-black text-xs">
                    Bill Discount (F7) (Rs):
                  </label>
                  <input
                    id="pos-discount-input"
                    type="number"
                    min="0"
                    max={subtotal}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" || e.key === "Enter") {
                        e.preventDefault();
                        const cashEl = document.getElementById("pos-cash-tendered-input");
                        if (cashEl) { cashEl.focus(); cashEl.select(); }
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        if (cart.length > 0) {
                          const lastQty = document.getElementById(`pos-cart-qty-${cart.length - 1}`);
                          if (lastQty) { lastQty.focus(); lastQty.select(); }
                        } else if (searchInputRef.current) {
                          searchInputRef.current.focus();
                        }
                      }
                    }}
                    placeholder="0"
                    className="w-24 bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-right text-xs font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono shadow-2xs"
                  />
                </div>

                {/* Grand Total Net Payable */}
                <div className="flex justify-between items-center bg-gradient-to-r from-teal-50 to-emerald-50 p-3.5 rounded-2xl border border-teal-200/80 shadow-xs">
                  <div>
                    <span className="font-black text-teal-950 text-sm block">Net Payable:</span>
                    <span className="text-[10px] text-teal-700 font-bold">Final amount to collect</span>
                  </div>
                  <span className="font-black text-teal-950 text-xl font-mono">Rs. {finalTotal.toLocaleString()}</span>
                </div>

                {/* Payment Method Switch Pills */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentType("cash")}
                    className={`flex-1 min-h-[44px] py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      paymentType === "cash"
                        ? "bg-teal-700 text-white shadow-sm ring-2 ring-teal-500/30"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    💵 Cash Sale (F6)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("credit")}
                    className={`flex-1 min-h-[44px] py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      paymentType === "credit"
                        ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/30"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    📒 Udhaar (F6)
                  </button>
                </div>

                {/* Cash Tendered & Change Return */}
                {paymentType === "cash" ? (
                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="pos-cash-tendered-input" className="text-slate-700 font-bold text-xs">
                        Cash Given (F8):
                      </label>
                      <input
                        id="pos-cash-tendered-input"
                        type="number"
                        min="0"
                        value={cashTenderedInput}
                        onChange={(e) => setCashTenderedInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            const discEl = document.getElementById("pos-discount-input");
                            if (discEl) { discEl.focus(); discEl.select(); }
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            const checkoutBtn = document.getElementById("pos-checkout-btn");
                            if (checkoutBtn) checkoutBtn.focus();
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            checkout();
                          }
                        }}
                        placeholder={finalTotal.toString()}
                        className="w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono shadow-2xs"
                      />
                    </div>
                    {changeDueVal > 0 && (
                      <div className="flex justify-between items-center text-teal-800 font-bold text-xs pt-1.5 border-t border-slate-200">
                        <span>Change to Return:</span>
                        <span className="text-sm font-black font-mono">Rs. {changeDueVal.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="font-black">Patient Credit / Udhaar Sale</div>
                      <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-md">Udhaar</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-amber-200/60">
                      <span className="font-bold text-slate-700">Down Payment (Rs):</span>
                      <input
                        id="pos-credit-paid-input"
                        type="number"
                        min="0"
                        max={finalTotal}
                        value={amountPaidInput}
                        onChange={(e) => setAmountPaidInput(e.target.value)}
                        placeholder="0"
                        className="w-28 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-right text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono shadow-2xs"
                      />
                    </div>
                    <p className="text-[11px] text-amber-700 font-medium">
                      Remaining balance of Rs. {Math.max(0, finalTotal - (Number(amountPaidInput) || 0)).toLocaleString()} will be posted to {linkedPatient ? linkedPatient.full_name : "Linked Patient"}&apos;s credit ledger.
                    </p>
                  </div>
                )}

                {/* Prominent Checkout Action with 44px+ hit area */}
                <button
                  id="pos-checkout-btn"
                  type="button"
                  onClick={checkout}
                  className="w-full min-h-[48px] bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-black py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <span className="material-symbols-outlined text-lg">receipt_long</span>
                  <span>Complete Sale &amp; Print (F2 / Ctrl+↵)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Ultra-Fast Keyboard Command Deck (Sticky Bottom Hotkey Bar) ── */}
      <div className="bg-slate-900/95 text-white backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700 shadow-xl flex items-center justify-between flex-wrap gap-2 text-[11px] font-bold">
        <div className="flex items-center gap-1 text-teal-400 font-black uppercase tracking-wider text-[10px]">
          <span className="material-symbols-outlined text-sm">keyboard</span>
          <span>Keyboard Power Deck:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-200">
            <kbd className="bg-teal-700 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">F1</kbd> Search
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-200">
            <kbd className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">F2 / ↵</kbd> Print Bill
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-200">
            <kbd className="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">F3</kbd> Brand Filter
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-200">
            <kbd className="bg-teal-600 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">F4</kbd> Link OPD
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-200">
            <kbd className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">F6</kbd> Cash/Udhaar
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-200">
            <kbd className="bg-amber-700 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">F7</kbd> Discount
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-200">
            <kbd className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">F8</kbd> Cash Given
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-200">
            <kbd className="bg-slate-700 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">F10</kbd> Reprint
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-rose-300">
            <kbd className="bg-rose-700 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">F11</kbd> Clear
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-400">
            <kbd className="bg-slate-600 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-black">Esc</kbd> Close
          </span>
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

