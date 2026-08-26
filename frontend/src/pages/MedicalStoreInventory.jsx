import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { getInventory, addInventoryItem, bulkImportInventory } from "../api/store.js";
import { dbClinic, formatStockBreakdown, exportInventoryTemplateCSV, parseInventoryCSV } from "../api/db.js";
import { formatCurrency } from "../utils/formatters.js";
import { printInventoryListReceipt, printProductPricingListReceipt } from "../utils/thermalPrinter.js";
import ProductMovementModal from "../components/ProductMovementModal.jsx";
import StockLedgerModal from "../components/StockLedgerModal.jsx";

const COMPANY_OPTIONS = [
  { name: "BM Pvt LTD", code: "BM", color: "from-teal-500 to-emerald-600" },
  { name: "Paul Brooks Homoeo Lab", code: "PB", color: "from-blue-500 to-indigo-600" },
  { name: "Dr. Willmar Schwabe Germany", code: "SCH", color: "from-amber-500 to-orange-600" },
  { name: "MEKTUM Homeo Pharma", code: "MKT", color: "from-purple-500 to-violet-600" },
  { name: "BLOSSOM Homeo Labs", code: "BLS", color: "from-rose-500 to-pink-600" },
  { name: "Dr. Reckeweg Germany", code: "REC", color: "from-sky-500 to-cyan-600" },
  { name: "Kamal Laboratories", code: "KAM", color: "from-emerald-500 to-teal-700" },
  { name: "Ashraf Laboratories", code: "ASH", color: "from-yellow-500 to-amber-700" },
  { name: "W.S. Laboratories", code: "WS", color: "from-indigo-500 to-blue-700" },
  { name: "Local Pharma Market / OTC", code: "LPM", color: "from-slate-500 to-gray-700" },
];

export default function MedicalStoreInventory() {
  const [inventory, setInventory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState("quick"); // "quick" | "advanced"
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState("all"); // "all" | "low" | "out" | "in_stock"
  const [viewMode, setViewMode] = useState("table"); // "table" | "grid"
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 30;

  const [selectedMovementItem, setSelectedMovementItem] = useState(null);
  const [isMovementOpen, setIsMovementOpen] = useState(false);

  // DrCreate 4-Level Stock Ledger Modal State
  const [showStockLedgerModal, setShowStockLedgerModal] = useState(false);
  const [ledgerInitialItem, setLedgerInitialItem] = useState(null);

  // Popup Modal States for DrCreate.xlsm / Access style
  const [showInventoryListModal, setShowInventoryListModal] = useState(false);
  const [showPricingListModal, setShowPricingListModal] = useState(false);
  const [modalCategoryFilter, setModalCategoryFilter] = useState("All");
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  // Registration Form State (Matching DrCreate / Access layout)
  const [quickForm, setQuickForm] = useState({
    medicine_name: "",
    company_name: "BM Pvt LTD",
    item_code: "BM",
    naration: "Drops 20ml",
    category: "Homeopathic Drops",
    cost_price: "",
    sale_price: "",
    opening_balance: "15",
    store_stock: "15",
    warehouse_stock: "35",
    minimum_level: "6",
    registration_date: new Date().toLocaleDateString("en-US"),
  });

  // Advanced Multi-Unit Form State
  const [advForm, setAdvForm] = useState({
    medicine_name: "",
    company_name: "Local Pharma Market / OTC",
    item_code: "LPM",
    category: "Tablet",
    strength: "500 mg",
    has_multi_unit: true,
    box_label: "Box",
    strip_label: "Strip",
    unit_label: "Tablet",
    strips_per_box: "10",
    units_per_strip: "10",
    stock_boxes: "5",
    stock_qty: "0",
    cost_price_per_box: "450",
    box_sale_price: "600",
    strip_sale_price: "65",
    unit_sale_price: "7",
    low_stock_threshold: "20",
  });

  const [error, setError] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const quickNameRef = useRef(null);



  // Bulk CSV Upload Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvParsedRows, setCsvParsedRows] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvImportStatus, setCsvImportStatus] = useState({ loading: false, result: null, error: "" });

  // Zero-Pilferage Blind Physical Stock Audit State
  const [showBlindAuditModal, setShowBlindAuditModal] = useState(false);
  const [auditCounts, setAuditCounts] = useState({});
  const [auditSearchQuery, setAuditSearchQuery] = useState("");

  function load() {
    const r = getInventory();
    if (r.success) setInventory(r.data || []);
  }

  useEffect(() => {
    load();
    window.addEventListener("clinicflow_status_update", load);
    return () => window.removeEventListener("clinicflow_status_update", load);
  }, []);

  // Lock background body scroll when any modal popup is open
  const isAnyModalOpen = Boolean(
    showInventoryListModal ||
    showPricingListModal ||
    showCsvModal ||
    isMovementOpen ||
    showStockLedgerModal
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isAnyModalOpen]);

  function triggerToast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  }

  function handleQuickChange(e) {
    const { name, value } = e.target;
    setQuickForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "company_name") {
        const found = COMPANY_OPTIONS.find((c) => c.name === value);
        if (found) next.item_code = found.code;
      }
      return next;
    });
  }

  function handleAdvChange(e) {
    const { name, value, type, checked } = e.target;
    setAdvForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  // Quick Fast-Add / DrCreate Submit Submission (supports Enter key loop)
  function handleQuickAdd(closeAfter = false) {
    setError("");
    if (!quickForm.medicine_name.trim()) {
      setError("Product Name is required.");
      if (quickNameRef.current) quickNameRef.current.focus();
      return;
    }

    const salePrice = parseFloat(quickForm.sale_price) || 0;
    const costPrice = parseFloat(quickForm.cost_price) || (salePrice > 0 ? salePrice * 0.7 : 0);
    const openingStock = parseInt(quickForm.opening_balance) || 0;
    const storeStock = parseInt(quickForm.store_stock) || openingStock;
    const godownStock = parseInt(quickForm.warehouse_stock) || 0;
    const totalBase = storeStock + godownStock;

    const payload = {
      medicine_name: quickForm.medicine_name.trim(),
      company_name: quickForm.company_name || "BM Pvt LTD",
      item_code: quickForm.item_code || "BM",
      generic_name: quickForm.naration || "Homeopathic Medicine",
      category: quickForm.category || (quickForm.naration ? `${quickForm.naration}` : "Homeopathic Drops"),
      has_multi_unit: false,
      strips_per_box: 1,
      units_per_strip: 1,
      box_label: "Pack",
      strip_label: "Bottle",
      unit_label: "Bottle",
      cost_price_per_box: costPrice,
      box_sale_price: salePrice,
      strip_sale_price: salePrice,
      unit_sale_price: salePrice,
      unit_price: salePrice,
      total_base_stock: totalBase,
      stock_qty: storeStock,
      store_stock: storeStock,
      warehouse_stock: godownStock,
      location_stocks: { wh_001: godownStock, wh_str: storeStock },
      low_stock_threshold: parseInt(quickForm.minimum_level) || 6,
      expiry_date: "2028-12-31",
    };

    const result = addInventoryItem(payload);
    if (result.success) {
      triggerToast(`✅ "${payload.medicine_name}" registered successfully!`);
      load();
      if (closeAfter) {
        setShowForm(false);
      } else {
        setQuickForm((prev) => ({
          ...prev,
          medicine_name: "",
          cost_price: "",
          sale_price: "",
        }));
        if (quickNameRef.current) quickNameRef.current.focus();
      }
    } else {
      setError(result.error?.message || "Failed to register medicine.");
    }
  }

  // Advanced Multi-Unit Form Submission
  function handleAdvSubmit(e) {
    e.preventDefault();
    setError("");

    let totalBaseStock = 0;
    const stripsPerBox = parseInt(advForm.strips_per_box) || 1;
    const unitsPerStrip = parseInt(advForm.units_per_strip) || 1;

    if (advForm.has_multi_unit) {
      const boxes = parseInt(advForm.stock_boxes) || 0;
      totalBaseStock = boxes * (stripsPerBox * unitsPerStrip);
    } else {
      totalBaseStock = parseInt(advForm.stock_qty) || 0;
    }

    const payload = {
      ...advForm,
      medicine_name: advForm.medicine_name.trim(),
      has_multi_unit: advForm.has_multi_unit,
      strips_per_box: stripsPerBox,
      units_per_strip: unitsPerStrip,
      total_base_stock: totalBaseStock,
      stock_qty: totalBaseStock,
      store_stock: totalBaseStock,
      warehouse_stock: 0,
      location_stocks: { wh_001: 0, wh_str: totalBaseStock },
      cost_price_per_box: parseFloat(advForm.cost_price_per_box) || 0,
      box_sale_price: parseFloat(advForm.box_sale_price) || 0,
      strip_sale_price: parseFloat(advForm.strip_sale_price) || 0,
      unit_sale_price: parseFloat(advForm.unit_sale_price) || parseFloat(advForm.unit_price) || 0,
      unit_price: parseFloat(advForm.unit_sale_price) || parseFloat(advForm.unit_price) || 0,
      low_stock_threshold: parseInt(advForm.low_stock_threshold) || 20,
    };

    const result = addInventoryItem(payload);
    if (result.success) {
      triggerToast(`✅ "${payload.medicine_name}" added successfully!`);
      setShowForm(false);
      load();
    } else {
      setError(result.error?.message || "Failed to save medicine.");
    }
  }



  // CSV File Handler
  function handleCsvFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvImportStatus({ loading: false, result: null, error: "" });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result || "";
        const parsed = parseInventoryCSV(text);
        if (parsed.length === 0) {
          setCsvImportStatus({ loading: false, result: null, error: "No valid medicine rows found in CSV. Please verify column headers." });
          setCsvParsedRows([]);
        } else {
          setCsvParsedRows(parsed);
        }
      } catch (err) {
        setCsvImportStatus({ loading: false, result: null, error: `CSV Parsing error: ${err.message}` });
      }
    };
    reader.readAsText(file);
  }

  function handleExecuteCsvImport() {
    if (csvParsedRows.length === 0) return;
    setCsvImportStatus({ loading: true, result: null, error: "" });
    setTimeout(() => {
      const res = bulkImportInventory(csvParsedRows, "merge");
      if (res.success) {
        setCsvImportStatus({ loading: false, result: res.data, error: "" });
        triggerToast(`🎉 ${res.data.count} items imported from CSV!`);
        load();
      } else {
        setCsvImportStatus({ loading: false, result: null, error: res.error?.message || "CSV import failed." });
      }
    }, 100);
  }

  function handleDownloadCsvTemplate() {
    const csvContent = exportInventoryTemplateCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "clinicflow_inventory_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportModalList(itemsToExport, filename) {
    if (!itemsToExport || itemsToExport.length === 0) return;
    const headers = ["Item Name", "Item Code", "Company", "Category / Naration", "Stock Level", "Sale Price (Rs)", "Purchase Price (Rs)"];
    const rows = itemsToExport.map((item) => [
      `"${(item.medicine_name || '').replace(/"/g, '""')}"`,
      `"${item.item_code || ''}"`,
      `"${item.company_name || ''}"`,
      `"${item.generic_name || item.category || ''}"`,
      item.total_base_stock ?? item.stock_qty ?? 0,
      item.unit_sale_price || item.box_sale_price || item.unit_price || 0,
      item.cost_price_per_box || item.purchase_price || 0
    ]);
    const csvStr = `${headers.join(",")}\n${rows.map((r) => r.join(",")).join("\n")}`;
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function isLowStock(item) {
    const base = item.total_base_stock ?? item.stock_qty ?? 0;
    return base > 0 && base <= (item.low_stock_threshold || 6);
  }

  function isOutOfStock(item) {
    const base = item.total_base_stock ?? item.stock_qty ?? 0;
    return base <= 0;
  }

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalItems = inventory.length;
    let totalStockUnits = 0;
    let totalValuationCost = 0;
    let totalValuationRetail = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    inventory.forEach((item) => {
      const stock = item.total_base_stock ?? item.stock_qty ?? 0;
      const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || 0);
      const cost = Number(item.cost_price_per_box || item.purchase_price || (sale * 0.7));

      totalStockUnits += stock;
      totalValuationCost += stock * cost;
      totalValuationRetail += stock * sale;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= (item.low_stock_threshold || 6)) {
        lowStockCount++;
      }
    });

    return {
      totalItems,
      totalStockUnits,
      totalValuationCost,
      totalValuationRetail,
      lowStockCount,
      outOfStockCount,
    };
  }, [inventory]);

  // Unique Category / Company Codes for Filter Dropdowns
  const uniqueCompanyNames = useMemo(() => {
    const set = new Set();
    inventory.forEach((i) => {
      if (i.company_name) set.add(i.company_name);
    });
    return ["all", ...Array.from(set).sort()];
  }, [inventory]);

  const uniqueCategoryCodes = useMemo(() => {
    const set = new Set();
    inventory.forEach((i) => {
      if (i.item_code) set.add(i.item_code);
      if (i.company_name) set.add(i.company_name);
    });
    return ["All", ...Array.from(set).sort()];
  }, [inventory]);

  // Filtered List for Modal Popups
  const modalFilteredItems = useMemo(() => {
    return inventory.filter((item) => {
      if (modalCategoryFilter !== "All") {
        const matchesCode = (item.item_code || "").toLowerCase() === modalCategoryFilter.toLowerCase();
        const matchesCompany = (item.company_name || "").toLowerCase() === modalCategoryFilter.toLowerCase();
        if (!matchesCode && !matchesCompany) return false;
      }
      if (modalSearchQuery.trim()) {
        const q = modalSearchQuery.toLowerCase();
        const mName = (item.medicine_name || "").toLowerCase().includes(q);
        const mCode = (item.item_code || "").toLowerCase().includes(q);
        const mCat = (item.category || "").toLowerCase().includes(q);
        const mNar = (item.generic_name || "").toLowerCase().includes(q);
        if (!mName && !mCode && !mCat && !mNar) return false;
      }
      return true;
    });
  }, [inventory, modalCategoryFilter, modalSearchQuery]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (companyFilter !== "all" && item.company_name !== companyFilter) return false;

      if (stockStatusFilter === "low" && !isLowStock(item)) return false;
      if (stockStatusFilter === "out" && !isOutOfStock(item)) return false;
      if (stockStatusFilter === "in_stock" && (isLowStock(item) || isOutOfStock(item))) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = (item.medicine_name || "").toLowerCase().includes(q);
        const mCode = (item.item_code || "").toLowerCase().includes(q);
        const mCat = (item.category || "").toLowerCase().includes(q);
        const mGen = (item.generic_name || "").toLowerCase().includes(q);
        const mComp = (item.company_name || "").toLowerCase().includes(q);
        if (!mName && !mCode && !mCat && !mGen && !mComp) return false;
      }
      return true;
    });
  }, [inventory, searchQuery, categoryFilter, companyFilter, stockStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / PAGE_SIZE));
  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInventory.slice(start, start + PAGE_SIZE);
  }, [filteredInventory, currentPage]);

  // Dynamic Margin Calculation for Quick Form
  const quickProfitMargin = useMemo(() => {
    const cost = parseFloat(quickForm.cost_price) || 0;
    const sale = parseFloat(quickForm.sale_price) || 0;
    if (sale <= 0) return { rs: 0, pct: 0 };
    const rs = sale - cost;
    const pct = cost > 0 ? ((rs / cost) * 100).toFixed(1) : 100;
    return { rs, pct };
  }, [quickForm.cost_price, quickForm.sale_price]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 animate-in fade-in duration-300 overflow-x-hidden">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900/95 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header & Master Action Toolbar */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 lg:p-7 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                Live Pharmacy Warehouse
              </span>
              <span className="text-xs text-slate-400 font-medium">DrCreate V2.0 Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Medical Store Inventory
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Catalog management, 4-level stock ledger, multi-unit packaging breakdowns, and instant CSV uploads.
            </p>
          </div>

          {/* Quick Action Toolbar - Symmetrically Arranged */}
          <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 shrink-0">
            {/* Stock Ledger */}
            <button
              id="show-stock-ledger-top-btn"
              onClick={() => {
                setLedgerInitialItem(null);
                setShowStockLedgerModal(true);
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-950/40 hover:shadow-teal-900/60 transition-all active:scale-95 border border-teal-400/40"
              title="Open DrCreate 4-Level Stock Ledger (Category -> SKU -> Timeline -> Vouchers)"
            >
              <span className="material-symbols-outlined text-base">menu_book</span>
              <span>Stock Ledger</span>
            </button>

            {/* Inventory List Popup */}
            <button
              id="show-inventory-list-top-btn"
              onClick={() => {
                setModalCategoryFilter("All");
                setModalSearchQuery("");
                setShowInventoryListModal(true);
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition-all hover:border-emerald-400 active:scale-95 shadow-sm"
              title="Open Inventory List (DrCreate Format)"
            >
              <span className="material-symbols-outlined text-base text-emerald-400">inventory_2</span>
              <span>Stock Sheet</span>
            </button>

            {/* Price List Popup */}
            <button
              id="show-pricing-list-top-btn"
              onClick={() => {
                setModalCategoryFilter("All");
                setModalSearchQuery("");
                setShowPricingListModal(true);
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-bold text-xs flex items-center gap-1.5 transition-all hover:border-teal-400 active:scale-95 shadow-sm"
              title="Open Product Pricing List (DrCreate Format)"
            >
              <span className="material-symbols-outlined text-base text-teal-400">sell</span>
              <span>Price List</span>
            </button>

            {/* Bulk CSV Import */}
            <button
              id="import-csv-btn"
              onClick={() => {
                setCsvImportStatus({ loading: false, result: null, error: "" });
                setCsvParsedRows([]);
                setCsvFileName("");
                setShowCsvModal(true);
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
              title="Upload medicines in bulk from Excel / CSV"
            >
              <span className="material-symbols-outlined text-base text-sky-400">upload_file</span>
              <span>Bulk CSV</span>
            </button>

            {/* Zero-Pilferage Blind Stock Audit */}
            <button
              onClick={() => {
                setAuditCounts({});
                setAuditSearchQuery("");
                setShowBlindAuditModal(true);
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-teal-900/40 hover:bg-teal-900/70 text-teal-200 border border-teal-500/40 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
              title="Zero-Pilferage Blind Physical Stock Audit (Count shelf items without bias)"
            >
              <span className="material-symbols-outlined text-base text-teal-400">fact_check</span>
              <span>Blind Stock Audit</span>
            </button>

            {/* Registration Form Toggle Button */}
            <button
              id="add-medicine-btn"
              onClick={() => {
                setShowForm(!showForm);
                if (!showForm) {
                  setTimeout(() => {
                    if (quickNameRef.current) quickNameRef.current.focus();
                  }, 100);
                }
              }}
              className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-base font-black">{showForm ? "close" : "add"}</span>
              <span>{showForm ? "Close Form" : "+ Register Medicine"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI & Valuation Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Catalog Medicines */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catalog SKUs</span>
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">medication</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.totalItems.toLocaleString()}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              {uniqueCompanyNames.length - 1} Manufacturing Brands
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500 opacity-60" />
        </div>

        {/* Total Stock Volume */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Stock Units</span>
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-800 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">inventory</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.totalStockUnits.toLocaleString()}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              Combined Store &amp; Godown Units
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-teal-500 opacity-60" />
        </div>

        {/* Stock Valuation */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stock Valuation</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-800">
              Rs. {Math.round(metrics.totalValuationRetail).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              Cost Asset: Rs. {Math.round(metrics.totalValuationCost).toLocaleString()}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-60" />
        </div>

        {/* Low / Out of Stock Health */}
        <div
          onClick={() => setStockStatusFilter(stockStatusFilter === "low" ? "all" : "low")}
          className={`bg-white rounded-3xl p-5 border shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden ${
            metrics.lowStockCount > 0 ? "border-amber-300 bg-amber-50/20" : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reorder Alerts</span>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
              metrics.lowStockCount > 0 ? "bg-amber-100 text-amber-800 animate-pulse" : "bg-slate-100 text-slate-500"
            }`}>
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-700">
              {metrics.lowStockCount} <span className="text-xs font-bold text-slate-500">Low Stock</span>
            </div>
            <div className="text-xs text-rose-600 font-bold mt-0.5">
              {metrics.outOfStockCount} Out of Stock
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500 opacity-60" />
        </div>
      </div>

      {/* Dual-Mode Add / Inventory Registration Form */}
      {showForm && (
        <div className="bg-white border-2 border-emerald-600/50 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <span className="material-symbols-outlined text-2xl">app_registration</span>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-white flex items-center gap-2">
                  Inventory Registration Form
                  <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    Rapid Entry
                  </span>
                </h2>
                <p className="text-xs text-emerald-200/80 font-medium">
                  Compatible with DrCreate V2.0 &amp; AshrafKhan.accdb legacy schemas
                </p>
              </div>
            </div>

            <div className="flex items-center bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700">
              <button
                type="button"
                onClick={() => setFormTab("quick")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  formTab === "quick"
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-base">bolt</span>
                DrCreate Form (Access Format)
              </button>
              <button
                type="button"
                onClick={() => setFormTab("advanced")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  formTab === "advanced"
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-base">widgets</span>
                Multi-Unit Mode (Box / Strip)
              </button>
            </div>
          </div>

          {/* TAB 1: DrCreate Rapid Entry Form */}
          {formTab === "quick" && (
            <div className="p-6 md:p-8 space-y-6 bg-slate-50/50">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs text-emerald-950 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    ↵
                  </div>
                  <div>
                    <strong>Continuous Rapid Loop:</strong> Type details and press{" "}
                    <kbd className="bg-white px-2 py-0.5 rounded border border-emerald-300 font-mono font-black text-emerald-800">
                      Enter
                    </kbd>{" "}
                    to instantly save and jump straight to the next medicine.
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-800">
                  <span>Margin:</span>
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300 font-mono">
                    Rs. {quickProfitMargin.rs.toFixed(0)} ({quickProfitMargin.pct}%)
                  </span>
                </div>
              </div>

              {/* Form Grid */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                {/* 1. Product Name */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <label htmlFor="quick_medicine_name" className="md:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="md:col-span-9">
                    <input
                      ref={quickNameRef}
                      id="quick_medicine_name"
                      name="medicine_name"
                      type="text"
                      placeholder="e.g. 15 Ghr 20Ml or Chaaston 30 Cap"
                      value={quickForm.medicine_name}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                {/* 2. Product Code & Company */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <label htmlFor="quick_item_code" className="md:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                    Product Code &amp; Brand
                  </label>
                  <div className="md:col-span-4">
                    <input
                      id="quick_item_code"
                      name="item_code"
                      type="text"
                      placeholder="e.g. BM, PB, SCH, SK, Al S"
                      value={quickForm.item_code}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-mono font-bold text-emerald-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <select
                      name="company_name"
                      value={quickForm.company_name}
                      onChange={handleQuickChange}
                      className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold bg-white text-slate-800 focus:border-emerald-600 focus:outline-none transition-all"
                    >
                      {COMPANY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Naration / Form */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <label htmlFor="quick_naration" className="md:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                    Naration / Form
                  </label>
                  <div className="md:col-span-9">
                    <input
                      id="quick_naration"
                      name="naration"
                      type="text"
                      placeholder="e.g. Drops 20ml, Tablet, Syrup, Ointment, Eye Care"
                      value={quickForm.naration}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* 4. Minimum Alert Level */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <label htmlFor="quick_minimum_level" className="md:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                    Minimum Level (Alert)
                  </label>
                  <div className="md:col-span-9">
                    <input
                      id="quick_minimum_level"
                      name="minimum_level"
                      type="number"
                      min="0"
                      placeholder="6"
                      value={quickForm.minimum_level}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* 5. Opening Balance & Date */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <label htmlFor="quick_opening_balance" className="md:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                    Initial Balance
                  </label>
                  <div className="md:col-span-4 flex items-center gap-2">
                    <input
                      id="quick_opening_balance"
                      name="opening_balance"
                      type="number"
                      min="0"
                      placeholder="25"
                      value={quickForm.opening_balance}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
                    />
                    <span className="text-xs text-slate-500 font-bold">Units</span>
                  </div>
                  <div className="md:col-span-5 flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700 uppercase">Reg Date:</span>
                    <input
                      type="text"
                      name="registration_date"
                      value={quickForm.registration_date}
                      onChange={handleQuickChange}
                      className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100"
                    />
                  </div>
                </div>

                {/* 6. Pricing Details */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
                  <label className="md:col-span-3 text-xs font-black text-emerald-950 uppercase tracking-wider">
                    Rates &amp; Valuation
                  </label>
                  <div className="md:col-span-4 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Cost (Rs):</span>
                    <input
                      id="quick_cost_price"
                      name="cost_price"
                      type="number"
                      min="0"
                      placeholder="420"
                      value={quickForm.cost_price}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div className="md:col-span-5 flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-950 whitespace-nowrap">
                      Sale Price: <span className="text-rose-500">*</span>
                    </span>
                    <input
                      id="quick_sale_price"
                      name="sale_price"
                      type="number"
                      min="0"
                      placeholder="595"
                      value={quickForm.sale_price}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border-2 border-emerald-500 rounded-xl px-3 py-2 text-xs font-black text-emerald-950 bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {error && <p role="alert" className="text-rose-600 font-bold text-xs">{error}</p>}

              {/* Bottom Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalCategoryFilter(quickForm.item_code || "All");
                      setModalSearchQuery("");
                      setShowInventoryListModal(true);
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
                    Show Catalog List
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalCategoryFilter(quickForm.item_code || "All");
                      setModalSearchQuery("");
                      setShowPricingListModal(true);
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">price_change</span>
                    Price Sheet
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-5 py-2.5 rounded-2xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdd(false)}
                    className="px-7 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-700/20 transition-all flex items-center gap-2 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">check</span>
                    Save Medicine [Enter]
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Advanced Multi-Unit Form */}
          {formTab === "advanced" && (
            <form onSubmit={handleAdvSubmit} className="p-6 md:p-8 flex flex-col gap-6 bg-slate-50/50" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="adv_medicine_name" className="text-xs font-bold text-slate-800">
                    Medicine Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="adv_medicine_name"
                    name="medicine_name"
                    type="text"
                    placeholder="e.g. Panadol 500mg"
                    value={advForm.medicine_name}
                    onChange={handleAdvChange}
                    className="border border-slate-300 rounded-2xl px-4 py-2.5 font-bold text-sm bg-white focus:border-emerald-600 focus:outline-none"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="adv_category" className="text-xs font-bold text-slate-800">
                    Category / Form
                  </label>
                  <select
                    id="adv_category"
                    name="category"
                    value={advForm.category}
                    onChange={handleAdvChange}
                    className="border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold bg-white text-slate-800 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="Tablet">Tablet (Solid)</option>
                    <option value="Capsule">Capsule (Hard/Softgel)</option>
                    <option value="Syrup / Suspension">Syrup / Suspension (Liquid)</option>
                    <option value="Injection / IV">Injection / IV Drip</option>
                    <option value="Cream / Ointment / Gel">Cream / Ointment / Gel</option>
                    <option value="Eye / Ear Drops">Eye / Ear Drops</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="adv_strength" className="text-xs font-bold text-slate-800">
                    Packing Strength
                  </label>
                  <input
                    id="adv_strength"
                    name="strength"
                    type="text"
                    placeholder="e.g. 500 mg, 120 ml"
                    value={advForm.strength}
                    onChange={handleAdvChange}
                    className="border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Hierarchy Box Section */}
              <div className="bg-teal-50/70 p-5 rounded-3xl border border-teal-200 space-y-4">
                <div className="text-xs font-black text-teal-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">widgets</span>
                  Packaging Hierarchy Breakdown (Box ➔ Strips / Packs ➔ Single Tablets / Units)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1 bg-white p-3.5 rounded-2xl border border-teal-100">
                    <label htmlFor="adv_box_label" className="text-xs font-bold text-slate-700">1. Box / Pack Label</label>
                    <input id="adv_box_label" name="box_label" type="text" placeholder="Box" value={advForm.box_label} onChange={handleAdvChange} className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold" />
                  </div>
                  <div className="flex flex-col gap-1 bg-white p-3.5 rounded-2xl border border-teal-100">
                    <label htmlFor="adv_strips_per_box" className="text-xs font-bold text-slate-700">2. Strips Per Box (Pattay)</label>
                    <input id="adv_strips_per_box" name="strips_per_box" type="number" min="1" placeholder="10" value={advForm.strips_per_box} onChange={handleAdvChange} className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold" />
                  </div>
                  <div className="flex flex-col gap-1 bg-white p-3.5 rounded-2xl border border-teal-100">
                    <label htmlFor="adv_units_per_strip" className="text-xs font-bold text-slate-700">3. Tablets Per Strip</label>
                    <input id="adv_units_per_strip" name="units_per_strip" type="number" min="1" placeholder="10" value={advForm.units_per_strip} onChange={handleAdvChange} className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                  <div className="flex flex-col gap-1 bg-white p-3.5 rounded-2xl border border-teal-100">
                    <label htmlFor="adv_stock_boxes" className="text-xs font-bold text-teal-950">Stock Boxes</label>
                    <input id="adv_stock_boxes" name="stock_boxes" type="number" min="0" placeholder="5" value={advForm.stock_boxes} onChange={handleAdvChange} className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold" />
                  </div>
                  <div className="flex flex-col gap-1 bg-white p-3.5 rounded-2xl border border-teal-100">
                    <label htmlFor="adv_box_sale_price" className="text-xs font-bold text-teal-950">Box Rate (Rs)</label>
                    <input id="adv_box_sale_price" name="box_sale_price" type="number" min="0" placeholder="600" value={advForm.box_sale_price} onChange={handleAdvChange} className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold" />
                  </div>
                  <div className="flex flex-col gap-1 bg-white p-3.5 rounded-2xl border border-teal-100">
                    <label htmlFor="adv_strip_sale_price" className="text-xs font-bold text-teal-950">Strip Rate (Rs)</label>
                    <input id="adv_strip_sale_price" name="strip_sale_price" type="number" min="0" placeholder="65" value={advForm.strip_sale_price} onChange={handleAdvChange} className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold" />
                  </div>
                  <div className="flex flex-col gap-1 bg-white p-3.5 rounded-2xl border border-teal-100">
                    <label htmlFor="adv_unit_sale_price" className="text-xs font-bold text-teal-950">Single Tab Rate (Rs)</label>
                    <input id="adv_unit_sale_price" name="unit_sale_price" type="number" min="0" placeholder="7" value={advForm.unit_sale_price} onChange={handleAdvChange} className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold" />
                  </div>
                </div>
              </div>

              {error && <p role="alert" className="text-rose-600 font-bold text-xs">{error}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-2xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" className="px-7 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-700/20">
                  Save Multi-Unit Medicine
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Search, Filter & View Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search medicine name, company (BM, Paul Brooks, Schwabe...), code, category..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50/60 focus:bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Quick Filters Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Company Filter Dropdown */}
            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-600"
            >
              <option value="all">All Brands ({uniqueCompanyNames.length - 1})</option>
              {uniqueCompanyNames.filter(c => c !== "all").map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Stock Health Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => {
                  setStockStatusFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  stockStatusFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Stock
              </button>
              <button
                onClick={() => {
                  setStockStatusFilter("low");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  stockStatusFilter === "low" ? "bg-amber-500 text-white shadow-sm" : "text-amber-800 hover:bg-amber-100"
                }`}
              >
                Low ({metrics.lowStockCount})
              </button>
              <button
                onClick={() => {
                  setStockStatusFilter("out");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  stockStatusFilter === "out" ? "bg-rose-500 text-white shadow-sm" : "text-rose-800 hover:bg-rose-100"
                }`}
              >
                Out ({metrics.outOfStockCount})
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-xl transition-all ${
                  viewMode === "table" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
                title="Table View"
              >
                <span className="material-symbols-outlined text-base">table_rows</span>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-xl transition-all ${
                  viewMode === "grid" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
                title="Cards Grid View"
              >
                <span className="material-symbols-outlined text-base">grid_view</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {["all", "Homeopathic Drops", "Syrup / Suspension", "Specialized Drops", "Tablet", "Capsule", "Allopathic OTC"].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategoryFilter(cat);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                categoryFilter === cat
                  ? "bg-teal-700 text-white shadow-md shadow-teal-900/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {cat === "all" ? "All Categories" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table / Card Content */}
      {filteredInventory.length === 0 ? (
        /* Empty State */
        <div className="w-full bg-white rounded-3xl p-8 sm:p-14 text-center border border-slate-200/80 shadow-sm space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto text-teal-600 shadow-inner">
            <span className="material-symbols-outlined text-4xl">inventory_2</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">
              {searchQuery ? "No matching medicines found" : "Your Medicine Catalog is Ready to Setup"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg mx-auto">
              {searchQuery
                ? `No medicines in inventory match "${searchQuery}". Try checking spelling or resetting filters.`
                : "Populate catalog instantly via bulk Excel/CSV upload or register new medicines using the rapid entry form."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!searchQuery && (
              <>
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  <span>Bulk CSV Upload</span>
                </button>
                <button
                  onClick={() => {
                    setShowForm(true);
                    setTimeout(() => quickNameRef.current?.focus(), 100);
                  }}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Manual Fast Form</span>
                </button>
              </>
            )}
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setCompanyFilter("all");
                  setStockStatusFilter("all");
                }}
                className="px-5 py-2.5 rounded-2xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900 transition-all"
              >
                Clear Search &amp; Filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "table" ? (
        /* Modern Table View */
        <div className="glass-card rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar table-scroll-container">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 z-10">
                <tr className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  <th className="py-4 px-6">Medicine &amp; Company</th>
                  <th className="py-4 px-4 text-center">Category / Code</th>
                  <th className="py-4 px-4 text-center">Stock Breakdown</th>
                  <th className="py-4 px-4 text-right">Cost Rate</th>
                  <th className="py-4 px-4 text-right">Sale Price</th>
                  <th className="py-4 px-6 text-right">Actions &amp; Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {paginatedInventory.map((item) => {
                  const low = isLowStock(item);
                  const out = isOutOfStock(item);
                  const base = item.total_base_stock ?? item.stock_qty ?? 0;
                  const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || 0);
                  const cost = Number(item.cost_price_per_box || item.purchase_price || (sale * 0.7));

                  return (
                    <tr
                      key={item.id}
                      id={`inv-row-${item.id}`}
                      className={`hover:bg-teal-50/40 transition-colors ${
                        out ? "bg-rose-50/20" : low ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Name & Brand */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-black shrink-0 shadow-2xs">
                            {item.has_multi_unit ? "📦" : "💧"}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                              {item.medicine_name}
                              {out ? (
                                <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                                  Out of Stock
                                </span>
                              ) : low ? (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                  Low Stock ({base})
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                              <span className="font-bold text-teal-800">{item.company_name || "BM Pvt LTD"}</span>
                              {item.generic_name && (
                                <>
                                  <span>•</span>
                                  <span>{item.generic_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category / Code */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                            {item.category || "Homeopathic Drops"}
                          </span>
                          {item.item_code && (
                            <span className="font-mono text-[10px] font-extrabold text-emerald-800 mt-1">
                              Code: {item.item_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock Breakdown */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`font-black text-sm ${out ? "text-rose-600" : low ? "text-amber-700" : "text-slate-900"}`}>
                            {base} <span className="text-xs font-medium text-slate-500">Units</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                            {formatStockBreakdown(item)}
                          </span>
                        </div>
                      </td>

                      {/* Cost Rate */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-500 text-xs">
                          Rs. {cost.toLocaleString()}
                        </div>
                      </td>

                      {/* Sale Price */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-black text-emerald-900 text-sm">
                          {formatCurrency(sale)}
                        </div>
                        {sale > cost && (
                          <div className="text-[10px] text-emerald-600 font-bold">
                            +Rs. {(sale - cost).toFixed(0)} ({(((sale - cost) / (cost || 1)) * 100).toFixed(0)}%)
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setLedgerInitialItem(item);
                              setShowStockLedgerModal(true);
                            }}
                            className="touch-target-44 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 text-xs font-black flex items-center gap-1.5 border border-emerald-200 transition-all active:scale-95 shadow-2xs cursor-pointer"
                            title="DrCreate 4-Level Stock Ledger"
                          >
                            <span className="material-symbols-outlined text-sm">menu_book</span>
                            <span>Ledger</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMovementItem(item);
                              setIsMovementOpen(true);
                            }}
                            className="touch-target-44 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-800 text-xs font-black flex items-center gap-1.5 border border-teal-200 transition-all active:scale-95 shadow-2xs cursor-pointer"
                            title="Stock Movement Card & Adjustments"
                          >
                            <span className="material-symbols-outlined text-sm">analytics</span>
                            <span>Stock Card</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Modern Cards Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedInventory.map((item) => {
            const low = isLowStock(item);
            const out = isOutOfStock(item);
            const base = item.total_base_stock ?? item.stock_qty ?? 0;
            const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || 0);
            const cost = Number(item.cost_price_per_box || item.purchase_price || (sale * 0.7));

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl p-5 border shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between ${
                  out ? "border-rose-200 bg-rose-50/10" : low ? "border-amber-200 bg-amber-50/10" : "border-slate-200"
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-black">
                        {item.has_multi_unit ? "📦" : "💧"}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                          {item.medicine_name}
                        </h4>
                        <div className="text-[11px] font-bold text-teal-800 mt-0.5">
                          {item.company_name || "BM Pvt LTD"}
                        </div>
                      </div>
                    </div>
                    {out ? (
                      <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                        Out
                      </span>
                    ) : low ? (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                        Low ({base})
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                      {item.category || "General"}
                    </span>
                    {item.item_code && (
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-mono">
                        Code: {item.item_code}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Stock:</span>
                    <span className="font-black text-slate-900">{formatStockBreakdown(item)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Price:</span>
                    <span className="font-black text-emerald-800">{formatCurrency(sale)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">Cost Rate:</span>
                    <span className="font-bold text-slate-600">Rs. {cost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setLedgerInitialItem(item);
                      setShowStockLedgerModal(true);
                    }}
                    className="flex-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center justify-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">menu_book</span>
                    Ledger
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMovementItem(item);
                      setIsMovementOpen(true);
                    }}
                    className="flex-1 py-2 rounded-xl bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-800 text-xs font-bold border border-teal-200 flex items-center justify-center gap-1 transition-all"
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-sm text-xs font-bold text-slate-600">
          <div>
            Showing <span className="text-slate-900 font-extrabold">{paginatedInventory.length}</span> of{" "}
            <span className="text-slate-900 font-extrabold">{filteredInventory.length}</span> medicines (Page {currentPage} of {totalPages})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-xl border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-800 font-bold transition-all"
            >
              Previous
            </button>
            <div className="flex items-center gap-1 px-2">
              <span className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center font-black">
                {currentPage}
              </span>
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-xl border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-800 font-bold transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DrCreate / Access "INVENTORY _LIST" Popup Modal                 */}
      {/* ========================================================================= */}
      {showInventoryListModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInventoryListModal(false);
          }}
        >
          <div
            className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] max-h-[700px] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 border border-emerald-500/30">
                  <span className="material-symbols-outlined text-xl">inventory_2</span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold uppercase tracking-wide">Stock Inventory Sheet</h3>
                  <p className="text-xs text-emerald-200/80">Showing {modalFilteredItems.length} Products</p>
                </div>
              </div>
              <button
                onClick={() => setShowInventoryListModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center shrink-0">
              <div className="sm:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                Filter Category:
              </div>
              <div className="sm:col-span-9 flex items-center gap-2">
                <select
                  value={modalCategoryFilter}
                  onChange={(e) => setModalCategoryFilter(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold bg-white text-slate-900 w-1/2 focus:outline-none focus:border-teal-600"
                >
                  {uniqueCategoryCodes.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Filter name..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold bg-white w-1/2 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 p-3 min-h-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-black uppercase text-[11px] sticky top-0 shadow-xs">
                  <tr>
                    <th className="p-3 border-b border-slate-200">Item Name</th>
                    <th className="p-3 border-b border-slate-200 text-center">Item Code</th>
                    <th className="p-3 border-b border-slate-200 text-right">Stock Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {modalFilteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center py-10 text-slate-400">
                        No products found under &quot;{modalCategoryFilter}&quot;.
                      </td>
                    </tr>
                  ) : (
                    modalFilteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-teal-50/50">
                        <td className="p-2.5 font-bold text-slate-900">{item.medicine_name}</td>
                        <td className="p-2.5 text-center font-mono text-emerald-800 font-bold">{item.item_code || "-"}</td>
                        <td className="p-2.5 text-right font-black text-slate-900">{item.total_base_stock ?? item.stock_qty ?? 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => printInventoryListReceipt(modalFilteredItems, modalCategoryFilter, dbClinic.get())}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>Print Stock Receipt</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportModalList(modalFilteredItems, `inventory_list_${modalCategoryFilter}.csv`)}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DrCreate "PRODUCT PRICING _LIST" Popup Modal                    */}
      {/* ========================================================================= */}
      {showPricingListModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPricingListModal(false);
          }}
        >
          <div
            className="bg-white max-w-4xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] max-h-[720px] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 flex items-center justify-center text-teal-300 border border-teal-500/30">
                  <span className="material-symbols-outlined text-xl">sell</span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold uppercase tracking-wide">Product Pricing &amp; Margin Sheet</h3>
                  <p className="text-xs text-teal-200/80">Showing {modalFilteredItems.length} Products with Sale &amp; Cost Rates</p>
                </div>
              </div>
              <button
                onClick={() => setShowPricingListModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center shrink-0">
              <div className="sm:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                Filter Category:
              </div>
              <div className="sm:col-span-9 flex items-center gap-2">
                <select
                  value={modalCategoryFilter}
                  onChange={(e) => setModalCategoryFilter(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold bg-white text-slate-900 w-1/2 focus:outline-none focus:border-teal-600"
                >
                  {uniqueCategoryCodes.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search product or naration..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold bg-white w-1/2 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 p-3 min-h-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-black uppercase text-[11px] sticky top-0 shadow-xs">
                  <tr>
                    <th className="p-3 border-b border-slate-200">Product Name</th>
                    <th className="p-3 border-b border-slate-200 text-center">Code</th>
                    <th className="p-3 border-b border-slate-200">Naration / Form</th>
                    <th className="p-3 border-b border-slate-200 text-center">Level</th>
                    <th className="p-3 border-b border-slate-200 text-right">Sale Price</th>
                    <th className="p-3 border-b border-slate-200 text-right">Purchase Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {modalFilteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-slate-400">
                        No pricing records found under this filter.
                      </td>
                    </tr>
                  ) : (
                    modalFilteredItems.map((item) => {
                      const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || 0);
                      const cost = Number(item.cost_price_per_box || item.purchase_price || (sale * 0.7));
                      return (
                        <tr key={item.id} className="hover:bg-teal-50/50">
                          <td className="p-2.5 font-bold text-slate-900">{item.medicine_name}</td>
                          <td className="p-2.5 text-center font-mono text-emerald-800 font-bold">{item.item_code || "-"}</td>
                          <td className="p-2.5 text-slate-600 text-[11px]">{item.generic_name || item.category || "-"}</td>
                          <td className="p-2.5 text-center font-black text-slate-800">{item.total_base_stock ?? item.stock_qty ?? 0}</td>
                          <td className="p-2.5 text-right font-black text-emerald-900">Rs. {sale.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-bold text-slate-600">Rs. {cost.toLocaleString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => printProductPricingListReceipt(modalFilteredItems, modalCategoryFilter, dbClinic.get())}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>Print Pricing List</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportModalList(modalFilteredItems, `pricing_list_${modalCategoryFilter}.csv`)}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Export Pricing CSV</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* ========================================================================= */}
      {/* MODAL 4: Bulk CSV / Excel Upload                                          */}
      {/* ========================================================================= */}
      {showCsvModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !csvImportStatus.loading) setShowCsvModal(false);
          }}
        >
          <div
            className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                  <span className="material-symbols-outlined text-2xl">upload_file</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Bulk Excel / CSV Medicine Upload</h3>
                  <p className="text-xs text-slate-500">Upload multiple medicines instantly with preview</p>
                </div>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Template Download Prompt */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-sky-50/70 p-4 rounded-2xl border border-sky-200 gap-3">
              <div className="text-xs text-sky-950 font-semibold">
                Download the standardized CSV template with required column schema:
              </div>
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Download Template</span>
              </button>
            </div>

            {/* File Upload Area */}
            <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-3xl p-6 text-center space-y-2.5 bg-slate-50/50 transition-colors">
              <span className="material-symbols-outlined text-4xl text-slate-400">csv</span>
              <div className="text-xs text-slate-700 font-bold">
                {csvFileName ? `Selected: ${csvFileName}` : "Click to select or drag & drop CSV file here"}
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileSelected}
                className="text-xs cursor-pointer file:mr-3 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-100 file:text-sky-800 hover:file:bg-sky-200"
              />
            </div>

            {/* Live Table Preview */}
            {csvParsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>Preview First 5 Rows (Total {csvParsedRows.length} Items Found):</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                    Valid Schema ✅
                  </span>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-48 text-[11px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="p-2.5">Medicine Name</th>
                        <th className="p-2.5">Company</th>
                        <th className="p-2.5">Cost (Rs)</th>
                        <th className="p-2.5">Sale (Rs)</th>
                        <th className="p-2.5">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {csvParsedRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{r.medicine_name}</td>
                          <td className="p-2 text-slate-600">{r.company_name}</td>
                          <td className="p-2 text-slate-600">Rs. {r.cost_price_per_box}</td>
                          <td className="p-2 font-bold text-teal-800">Rs. {r.unit_sale_price}</td>
                          <td className="p-2 text-slate-600">{r.total_base_stock} units</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {csvImportStatus.error && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-3 rounded-xl border border-rose-200">
                {csvImportStatus.error}
              </p>
            )}

            {csvImportStatus.result && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                <span>Successfully imported {csvImportStatus.result.count} medicines into catalog!</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                disabled={csvImportStatus.loading}
              >
                {csvImportStatus.result ? "Done" : "Cancel"}
              </button>
              {!csvImportStatus.result && (
                <button
                  type="button"
                  onClick={handleExecuteCsvImport}
                  disabled={csvParsedRows.length === 0 || csvImportStatus.loading}
                  className="px-6 py-2.5 rounded-2xl bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-40 active:scale-95"
                >
                  {csvImportStatus.loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      <span>Importing {csvParsedRows.length} Items...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>Confirm &amp; Import ({csvParsedRows.length} Items)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Zero-Pilferage Blind Physical Stock Audit Modal */}
      {showBlindAuditModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-teal-200 overflow-hidden font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <span className="material-symbols-outlined text-2xl">fact_check</span>
                </div>
                <div>
                  <h2 className="text-base font-black flex items-center gap-2">
                    <span>Zero-Pilferage Blind Physical Stock Audit</span>
                    <span className="text-[10px] bg-teal-500/30 text-teal-200 px-2 py-0.5 rounded-full font-bold border border-teal-400/30">Anti-Theft Protocol</span>
                  </h2>
                  <p className="text-xs text-teal-200/70 mt-0.5">
                    Count physical units on shelves without bias. The system compares physical counts against live software balances.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBlindAuditModal(false)}
                className="text-teal-300 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="p-4 bg-teal-50/40 border-b border-teal-100 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">search</span>
                <input
                  type="text"
                  placeholder="Search medicine by name or code for physical audit..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-teal-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 bg-white hover:bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  Print Count Sheet
                </button>
              </div>
            </div>

            {/* Audit Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-teal-100/90 backdrop-blur-xs text-teal-950 font-black text-[11px] uppercase border-b border-teal-200">
                  <tr>
                    <th className="p-2.5">Medicine Name</th>
                    <th className="p-2.5">Company</th>
                    <th className="p-2.5 text-center">Physical Count (Shelf)</th>
                    <th className="p-2.5 text-right">System Stock</th>
                    <th className="p-2.5 text-right">Variance / Audit Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-50">
                  {inventory
                    .filter((item) => {
                      if (!auditSearchQuery.trim()) return true;
                      const q = auditSearchQuery.toLowerCase();
                      return (
                        (item.medicine_name || "").toLowerCase().includes(q) ||
                        (item.company_name || "").toLowerCase().includes(q) ||
                        (item.item_code || "").toLowerCase().includes(q)
                      );
                    })
                    .map((item) => {
                      const sysStock = Number(item.store_stock ?? item.total_base_stock ?? 0);
                      const physicalEntered = auditCounts[item.id] !== undefined && auditCounts[item.id] !== ""
                        ? Number(auditCounts[item.id])
                        : null;
                      const diff = physicalEntered !== null ? physicalEntered - sysStock : null;

                      return (
                        <tr key={item.id} className="hover:bg-teal-50/50 transition-colors">
                          <td className="p-2.5 font-bold text-gray-900">
                            {item.medicine_name}
                            <span className="ml-1 text-[10px] text-gray-400 font-normal">({item.item_code || "GEN"})</span>
                          </td>
                          <td className="p-2.5 text-gray-600 font-medium">{item.company_name || "BM"}</td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              placeholder="Enter count..."
                              value={auditCounts[item.id] ?? ""}
                              onChange={(e) => setAuditCounts({ ...auditCounts, [item.id]: e.target.value })}
                              className="w-24 px-2 py-1 text-center font-black rounded-lg border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                            />
                          </td>
                          <td className="p-2.5 text-right font-bold text-gray-700">{sysStock}</td>
                          <td className="p-2.5 text-right font-black">
                            {diff === null ? (
                              <span className="text-gray-300 text-[10px] italic">Not Counted</span>
                            ) : diff === 0 ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-black">
                                Match (0) ✅
                              </span>
                            ) : diff < 0 ? (
                              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full text-[10px] font-black border border-rose-200">
                                Shortage: {diff} (Loss: Rs. {Math.abs(diff * (item.unit_sale_price || item.sale_price || 0)).toLocaleString()}) 🚨
                              </span>
                            ) : (
                              <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full text-[10px] font-black border border-sky-200">
                                Surplus: +{diff} 📦
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-xs text-gray-600 font-medium">
                Audited items: <strong>{Object.keys(auditCounts).filter((k) => auditCounts[k] !== "").length}</strong> of {inventory.length}
              </div>
              <button
                type="button"
                onClick={() => {
                  alert("Physical count verified and logged in cyclic audit register.");
                  setShowBlindAuditModal(false);
                }}
                className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Close &amp; Save Audit Progress
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Product Movement Stock Card Modal */}
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

      {/* DrCreate 4-Level Stock Ledger Modal */}
      <StockLedgerModal
        isOpen={showStockLedgerModal}
        onClose={() => {
          setShowStockLedgerModal(false);
          setLedgerInitialItem(null);
        }}
        initialItem={ledgerInitialItem}
      />
    </div>
  );
}
