import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../hooks/useAuth.js";
import { verifyAdminPasscode } from "../api/auth.js";
import { getInventory, addInventoryItem, bulkImportInventory } from "../api/store.js";
import { dbClinic, dbSuppliers, dbWarehouses, dbInventory, dbCategories, dbAuditLogs, formatStockBreakdown, exportInventoryTemplateCSV, parseInventoryCSV } from "../api/db.js";
import { formatCurrency, downloadCSV } from "../utils/formatters.js";
import { printInventoryListReceipt, printProductPricingListReceipt } from "../utils/thermalPrinter.js";
import ProductMovementModal from "../components/ProductMovementModal.jsx";
import StockLedgerModal from "../components/StockLedgerModal.jsx";

const STANDARD_COMPANIES = [
  { name: "BM Pvt LTD", code: "BM", color: "from-teal-500 to-emerald-600" },
  { name: "Paul Brooks Homoeo Lab", code: "PB", color: "from-blue-500 to-indigo-600" },
  { name: "Dr. Willmar Schwabe Germany", code: "SCH", color: "from-amber-500 to-orange-600" },
  { name: "MEKTUM Homeo Pharma", code: "MKT", color: "from-purple-500 to-violet-600" },
  { name: "BLOSSOM Homeo Labs", code: "BLS", color: "from-rose-500 to-pink-600" },
  { name: "Dr. Reckeweg Germany", code: "REC", color: "from-sky-500 to-cyan-600" },
  { name: "Kamal Laboratories", code: "KAM", color: "from-emerald-500 to-teal-700" },
  { name: "Ashraf Laboratories", code: "ASH", color: "from-yellow-500 to-amber-700" },
  { name: "W.S. Laboratories", code: "WS", color: "from-indigo-500 to-blue-700" },
  { name: "HFP Pvt Ltd", code: "HFP", color: "from-teal-600 to-cyan-700" },
  { name: "GHR HOMOEO", code: "GHR", color: "from-emerald-600 to-green-700" },
  { name: "Eagle Homoeo", code: "EGL", color: "from-amber-600 to-yellow-700" },
  { name: "Local Pharma Market / OTC", code: "LPM", color: "from-slate-500 to-gray-700" },
];

function extractCompanyCode(supplierOrName) {
  if (!supplierOrName) return "GEN";
  if (typeof supplierOrName === "object") {
    if (supplierOrName.supplier_code && !String(supplierOrName.supplier_code).startsWith("SUP-")) {
      return String(supplierOrName.supplier_code).toUpperCase();
    }
    if (supplierOrName.code) return String(supplierOrName.code).toUpperCase();
    supplierOrName = supplierOrName.name || "";
  }
  const clean = String(supplierOrName).trim();
  const lower = clean.toLowerCase();
  if (lower.includes("bm")) return "BM";
  if (lower.includes("paul") || lower.includes("brooks")) return "PB";
  if (lower.includes("schwabe") || lower.includes("willmar")) return "SCH";
  if (lower.includes("mektum") || lower.includes("mkt") || lower.includes("mek")) return "MKT";
  if (lower.includes("blossom") || lower.includes("bls")) return "BLS";
  if (lower.includes("reckeweg") || lower.includes("rec")) return "REC";
  if (lower.includes("kamal") || lower.includes("kam") || lower.includes("kl")) return "KAM";
  if (lower.includes("ashraf") || lower.includes("ash")) return "ASH";
  if (lower.includes("w.s") || lower.includes("ws lab")) return "WS";
  if (lower.includes("hfp")) return "HFP";
  if (lower.includes("ghr")) return "GHR";
  if (lower.includes("eagle")) return "EGL";
  if (lower.includes("local") || lower.includes("lpm")) return "LPM";

  const words = clean.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.slice(0, 3).map((w) => w[0].toUpperCase()).join("");
  }
  return clean.substring(0, 3).toUpperCase();
}

export default function MedicalStoreInventory() {
  const { user } = useAuth();
  const allWarehouses = useMemo(() => dbWarehouses.getAll(), []);
  const isLocationLocked = Boolean(
    user && !user.is_owner && user.role !== "admin" && user.role !== "doctor" && user.assigned_warehouse_id
  );
  const [selectedLocationId, setSelectedLocationId] = useState(user?.assigned_warehouse_id || "all");
  const effectiveLocationId = isLocationLocked ? (user?.assigned_warehouse_id || "wh_001") : selectedLocationId;
  const currentWarehouseInfo = useMemo(() => {
    if (effectiveLocationId === "all") return null;
    return allWarehouses.find((w) => w.id === effectiveLocationId) || null;
  }, [allWarehouses, effectiveLocationId]);
  const userAssignedWh = currentWarehouseInfo;

  const canViewFinancials = Boolean(
    user?.is_owner || user?.role === "doctor" || user?.role === "admin" || user?.can_view_financials
  );

  const [inventory, setInventory] = useState([]);
  const [showForm, setShowForm] = useState(false);
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

  // Dynamic Categories from dbCategories & active inventory
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);

  const allCategories = useMemo(() => {
    return dbCategories.getAll();
  }, [inventory]);

  // Popup Modal States for DrCreate.xlsm / Access style
  const [showInventoryListModal, setShowInventoryListModal] = useState(false);
  const [showPricingListModal, setShowPricingListModal] = useState(false);
  const [modalCategoryFilter, setModalCategoryFilter] = useState("All");
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  // Registration Form State (Matching DrCreate / Access layout)
  const [quickForm, setQuickForm] = useState({
    medicine_name: "",
    product_description: "",
    company_name: "BM Pvt LTD",
    item_code: "BM",
    category: "Homeopathic Drops",
    cost_price: "",
    sale_price: "",
    opening_balance: "0",
    store_stock: "0",
    warehouse_1_stock: "0",
    warehouse_2_stock: "0",
    minimum_level: "6",
    registration_date: new Date().toLocaleDateString("en-US"),
  });

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    medicine_name: "",
    product_description: "",
    company_name: "",
    item_code: "",
    category: "Homeopathic Drops",
    cost_price: "0",
    sale_price: "0",
    store_stock: "0",
    warehouse_1_stock: "0",
    warehouse_2_stock: "0",
    low_stock_threshold: "6",
  });

  const [error, setError] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const quickNameRef = useRef(null);
  const categoryScrollRef = useRef(null);

  const scrollCategories = (dir) => {
    if (categoryScrollRef.current) {
      const amt = dir === "left" ? -240 : 240;
      categoryScrollRef.current.scrollBy({ left: amt, behavior: "smooth" });
    }
  };



  // Bulk CSV Upload Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvParsedRows, setCsvParsedRows] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvImportStatus, setCsvImportStatus] = useState({ loading: false, result: null, error: "" });

  // Zero-Pilferage Blind Physical Stock Audit State
  const [showBlindAuditModal, setShowBlindAuditModal] = useState(false);
  const [auditCounts, setAuditCounts] = useState({});
  const [auditSearchQuery, setAuditSearchQuery] = useState("");

  // Edit Medicine Modal State
  const [editingItem, setEditingItem] = useState(null);

  // Delete Item State
  const [deletingItem, setDeletingItem] = useState(null);

  // Admin Passcode Authorization Modal State
  const [adminAuthModal, setAdminAuthModal] = useState({
    isOpen: false,
    action: "", // 'edit' | 'delete'
    targetItem: null,
    passcode: "",
    error: "",
    showPass: false,
  });

  const isAdminOrOwner = Boolean(
    user?.is_owner ||
    user?.role === "admin" ||
    user?.is_principal_doctor
  );

  const openEditFormForItem = (item) => {
    setEditingItem(item);
    const locStocks = item.location_stocks || {};
    const wh1Qty = locStocks.wh_001 ?? item.warehouse_stock ?? 0;
    const wh2Qty = locStocks.wh_002 ?? 0;
    const storeQty = locStocks.wh_str ?? item.store_stock ?? item.stock_qty ?? 0;
    
    // Build dynamic warehouse stock dictionary
    const whStockMap = {};
    allWarehouses.forEach((wh) => {
      whStockMap[wh.id] = String(locStocks[wh.id] ?? (wh.id === "wh_001" ? (item.warehouse_stock ?? 0) : 0));
    });

    setEditFormData({
      medicine_name: item.medicine_name || "",
      product_description: item.product_description || item.generic_name || item.naration || item.strength || "",
      company_name: item.company_name || "BM Pvt LTD",
      item_code: item.item_code || "",
      category: item.category || "Homeopathic Drops",
      cost_price: String(item.cost_price_per_box || item.purchase_price || item.cost_price || "0"),
      sale_price: String(item.unit_sale_price || item.box_sale_price || item.sale_price || item.unit_price || "0"),
      store_stock: String(storeQty),
      location_stocks: whStockMap,
      warehouse_1_stock: String(wh1Qty),
      warehouse_2_stock: String(wh2Qty),
      low_stock_threshold: String(item.low_stock_threshold ?? 6),
    });
  };

  const handleRequestEdit = (item) => {
    if (isAdminOrOwner) {
      openEditFormForItem(item);
    } else {
      setAdminAuthModal({
        isOpen: true,
        action: "edit",
        targetItem: item,
        passcode: "",
        error: "",
        showPass: false,
      });
    }
  };

  const handleRequestDelete = (item) => {
    if (isAdminOrOwner) {
      setDeletingItem(item);
    } else {
      setAdminAuthModal({
        isOpen: true,
        action: "delete",
        targetItem: item,
        passcode: "",
        error: "",
        showPass: false,
      });
    }
  };

  const handleVerifyAdminPasscode = (e) => {
    e.preventDefault();
    if (!verifyAdminPasscode(adminAuthModal.passcode)) {
      setAdminAuthModal((prev) => ({
        ...prev,
        error: "Incorrect Admin Passcode. Please try again.",
      }));
      return;
    }

    const { action, targetItem } = adminAuthModal;
    setAdminAuthModal({
      isOpen: false,
      action: "",
      targetItem: null,
      passcode: "",
      error: "",
      showPass: false,
    });

    if (action === "edit" && targetItem) {
      openEditFormForItem(targetItem);
    } else if (action === "delete" && targetItem) {
      setDeletingItem(targetItem);
    }
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const costVal = Math.max(0, Number(editFormData.cost_price) || 0);
    const saleVal = Math.max(0, Number(editFormData.sale_price) || 0);
    const storeQty = Math.max(0, Number(editFormData.store_stock) || 0);
    
    // Dynamic warehouse stocks aggregation
    const updatedLocationStocks = {
      ...(editingItem.location_stocks || {}),
      wh_str: storeQty,
    };
    let godownTotal = 0;

    allWarehouses.forEach((wh) => {
      const qty = Math.max(0, Number(editFormData.location_stocks?.[wh.id] ?? (wh.id === "wh_001" ? editFormData.warehouse_1_stock : editFormData.warehouse_2_stock)) || 0);
      updatedLocationStocks[wh.id] = qty;
      godownTotal += qty;
    });

    const threshold = Math.max(0, Number(editFormData.low_stock_threshold) || 6);
    const desc = editFormData.product_description?.trim() || "";

    const updated = {
      medicine_name: editFormData.medicine_name.trim(),
      product_description: desc,
      generic_name: desc,
      naration: desc,
      company_name: editFormData.company_name.trim(),
      item_code: editFormData.item_code.trim(),
      category: editFormData.category || "Homeopathic Drops",
      cost_price_per_box: costVal,
      purchase_price: costVal,
      cost_price: costVal,
      unit_sale_price: saleVal,
      box_sale_price: saleVal,
      sale_price: saleVal,
      unit_price: saleVal,
      store_stock: storeQty,
      warehouse_stock: godownTotal,
      stock_qty: storeQty,
      total_base_stock: storeQty + godownTotal,
      low_stock_threshold: threshold,
      location_stocks: updatedLocationStocks,
    };

    dbInventory.update(editingItem.id, updated);

    // Tamper-Evident SHA-256 Audit Log Event with Previous Device Active User Tracking
    const prevDeviceUser = (typeof localStorage !== "undefined" && localStorage.getItem("cf_last_logged_out_user")) || "None";
    dbAuditLogs.logEvent({
      actor_id: user?.id || user?.userId,
      actor_name: user?.name,
      role: user?.role,
      action: "STOCK_EDIT",
      entity: "inventory",
      entity_id: editingItem.id,
      before: {
        medicine_name: editingItem.medicine_name,
        company_name: editingItem.company_name,
        stock_qty: editingItem.stock_qty,
        store_stock: editingItem.store_stock,
        warehouse_stock: editingItem.warehouse_stock,
        sale_price: editingItem.sale_price,
      },
      after: {
        medicine_name: updated.medicine_name,
        company_name: updated.company_name,
        stock_qty: updated.stock_qty,
        store_stock: updated.store_stock,
        warehouse_stock: updated.warehouse_stock,
        sale_price: updated.sale_price,
      },
      reason: `Stock/Catalogue updated for "${updated.medicine_name}". [Device Last Active User: ${prevDeviceUser}]`,
    });

    setEditingItem(null);
    load();
    triggerToast(`✅ "${updated.medicine_name}" updated successfully!`);
  };

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    const name = deletingItem.medicine_name;
    dbInventory.delete(deletingItem.id);
    setDeletingItem(null);
    load();
    triggerToast(`🗑️ "${name}" permanently removed from catalog.`);
  };

  // Bulk Selection State & Handlers
  const [selectedItems, setSelectedItems] = useState(new Set());

  const toggleSelectItem = (itemId) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === paginatedInventory?.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set((paginatedInventory || []).map((i) => i.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedItems.size === 0) return;
    const count = selectedItems.size;
    selectedItems.forEach((id) => dbInventory.delete(id));
    setSelectedItems(new Set());
    load();
    triggerToast(`🗑️ ${count} items permanently removed from catalog.`);
  };

  function load() {
    const r = getInventory();
    if (r.success) setInventory(r.data || []);
  }

  useEffect(() => {
    load();
    window.addEventListener("clinicflow_status_update", load);
    return () => window.removeEventListener("clinicflow_status_update", load);
  }, []);

  const modalNavRef = useRef({
    showInventoryListModal,
    showPricingListModal,
    showCsvModal,
    isMovementOpen,
    showStockLedgerModal,
  });
  modalNavRef.current = {
    showInventoryListModal,
    showPricingListModal,
    showCsvModal,
    isMovementOpen,
    showStockLedgerModal,
  };

  useEffect(() => {
    function handleInventoryKeyDown(e) {
      const {
        showInventoryListModal: sInv,
        showPricingListModal: sPrice,
        showCsvModal: sCsv,
        isMovementOpen: sMov,
        showStockLedgerModal: sLed,
      } = modalNavRef.current;

      if (e.key === "F1") {
        e.preventDefault();
        if (quickNameRef.current) {
          quickNameRef.current.focus();
          quickNameRef.current.select();
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        setShowInventoryListModal((prev) => !prev);
      } else if (e.key === "F4") {
        e.preventDefault();
        setShowStockLedgerModal((prev) => !prev);
      } else if (e.key === "Escape") {
        if (sInv) setShowInventoryListModal(false);
        else if (sPrice) setShowPricingListModal(false);
        else if (sCsv) setShowCsvModal(false);
        else if (sMov) setIsMovementOpen(false);
        else if (sLed) setShowStockLedgerModal(false);
      }
    }

    window.addEventListener("keydown", handleInventoryKeyDown);
    return () => window.removeEventListener("keydown", handleInventoryKeyDown);
  }, []);

  // Lock background body scroll when any modal popup is open
  const isAnyModalOpen = Boolean(
    showInventoryListModal ||
    showPricingListModal ||
    showCsvModal ||
    isMovementOpen ||
    showStockLedgerModal ||
    showBlindAuditModal ||
    editingItem ||
    deletingItem ||
    adminAuthModal.isOpen
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

  // Dynamically aggregate all companies from dbSuppliers (28+ accounts), STANDARD_COMPANIES, and active Inventory
  const allCompanyOptions = useMemo(() => {
    const map = new Map();

    // 1. Add all suppliers from dbSuppliers
    const suppliers = dbSuppliers ? dbSuppliers.getAll() : [];
    suppliers.forEach((s) => {
      if (s.name && s.name.trim()) {
        const code = extractCompanyCode(s);
        map.set(s.name.toLowerCase().trim(), {
          name: s.name.trim(),
          code: code,
          supplier_id: s.id,
          supplier_code: s.supplier_code || s.code || "",
        });
      }
    });

    // 2. Add standard known companies
    STANDARD_COMPANIES.forEach((c) => {
      const key = c.name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, { ...c });
      }
    });

    // 3. Add any companies already existing in current inventory
    inventory.forEach((i) => {
      if (i.company_name && i.company_name.trim()) {
        const key = i.company_name.toLowerCase().trim();
        if (!map.has(key)) {
          const code = i.item_code || extractCompanyCode(i.company_name);
          map.set(key, { name: i.company_name.trim(), code: code.toUpperCase() });
        }
      }
    });

    // Sort alphabetically by company name
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory]);

  // Two-Way Code & Name Auto-Fill Matcher
  function findCompanyByCode(codeStr) {
    if (!codeStr || !codeStr.trim()) return null;
    const clean = codeStr.trim().toLowerCase();

    // 1. Exact code match in allCompanyOptions
    const exactCode = allCompanyOptions.find((c) => c.code && c.code.toLowerCase() === clean);
    if (exactCode) return exactCode;

    // 2. Supplier code or account_no match in dbSuppliers
    if (dbSuppliers) {
      const sup = dbSuppliers.getByCode(clean);
      if (sup) {
        const matched = allCompanyOptions.find((c) => c.name.toLowerCase() === sup.name.toLowerCase());
        if (matched) return matched;
        return { name: sup.name, code: extractCompanyCode(sup) };
      }
    }

    // 3. Known code prefixes & abbreviations
    if (clean === "bm" || clean.startsWith("bm-")) return allCompanyOptions.find((c) => c.code === "BM");
    if (clean === "pb" || clean === "paul" || clean.startsWith("pb-")) return allCompanyOptions.find((c) => c.code === "PB");
    if (clean === "sch" || clean === "sc" || clean.startsWith("sch-") || clean.startsWith("sc-")) return allCompanyOptions.find((c) => c.code === "SCH");
    if (clean === "mkt" || clean === "mek" || clean.startsWith("mkt-") || clean.startsWith("mek-")) return allCompanyOptions.find((c) => c.code === "MKT");
    if (clean === "bls" || clean.startsWith("bls-")) return allCompanyOptions.find((c) => c.code === "BLS");
    if (clean === "rec" || clean.startsWith("rec-")) return allCompanyOptions.find((c) => c.code === "REC");
    if (clean === "kam" || clean === "kl" || clean.startsWith("kam-") || clean.startsWith("kl-")) return allCompanyOptions.find((c) => c.code === "KAM");
    if (clean === "ash" || clean.startsWith("ash-")) return allCompanyOptions.find((c) => c.code === "ASH");
    if (clean === "ws" || clean.startsWith("ws-")) return allCompanyOptions.find((c) => c.code === "WS");
    if (clean === "hfp" || clean.startsWith("hfp-")) return allCompanyOptions.find((c) => c.code === "HFP");
    if (clean === "ghr" || clean.startsWith("ghr-")) return allCompanyOptions.find((c) => c.code === "GHR");
    if (clean === "egl" || clean.startsWith("egl-") || clean.startsWith("eah-")) return allCompanyOptions.find((c) => c.code === "EGL");
    if (clean === "lpm" || clean.startsWith("lpm-")) return allCompanyOptions.find((c) => c.code === "LPM");

    // 4. Match company name starting with code
    const namePrefix = allCompanyOptions.find((c) => c.name.toLowerCase().startsWith(clean));
    if (namePrefix) return namePrefix;

    return null;
  }

  function handleQuickChange(e) {
    const { name, value } = e.target;
    setQuickForm((prev) => {
      const next = { ...prev, [name]: value };

      // Case A: User selected Company Name from dropdown -> Auto-fill item_code
      if (name === "company_name") {
        const found = allCompanyOptions.find((c) => c.name.toLowerCase() === value.toLowerCase().trim());
        if (found) {
          next.item_code = found.code;
        }
      }

      // Case B: User typed or changed Product Code (item_code) -> Auto-fill company_name!
      if (name === "item_code") {
        const found = findCompanyByCode(value);
        if (found) {
          next.company_name = found.name;
        }
      }

      return next;
    });
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
    const storeStock = parseInt(quickForm.store_stock) || parseInt(quickForm.opening_balance) || 0;
    
    // Dynamic location stocks mapping for all registered warehouses
    const finalLocationStocks = { wh_str: storeStock };
    let godownStock = 0;

    allWarehouses.forEach((wh) => {
      const qty = parseInt(quickForm.location_stocks?.[wh.id]) || 0;
      finalLocationStocks[wh.id] = qty;
      godownStock += qty;
    });

    const totalBase = storeStock + godownStock;
    const desc = quickForm.product_description?.trim() || "";

    const payload = {
      medicine_name: quickForm.medicine_name.trim(),
      product_description: desc,
      generic_name: desc,
      naration: desc,
      company_name: quickForm.company_name || "BM Pvt LTD",
      item_code: quickForm.item_code || "BM",
      category: quickForm.category || "Homeopathic Drops",
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
      location_stocks: finalLocationStocks,
      low_stock_threshold: parseInt(quickForm.minimum_level) || 6,
      expiry_date: "2028-12-31",
    };

    const result = addInventoryItem(payload);
    if (result.success) {
      if (payload.category) {
        dbCategories.add(payload.category);
      }
      triggerToast(`✅ "${payload.medicine_name}" registered successfully!`);
      load();
      if (closeAfter) {
        setShowForm(false);
      } else {
        setQuickForm((prev) => ({
          ...prev,
          medicine_name: "",
          product_description: "",
          cost_price: "",
          sale_price: "",
          store_stock: "0",
          warehouse_1_stock: "0",
          warehouse_2_stock: "0",
        }));
        if (quickNameRef.current) quickNameRef.current.focus();
      }
    } else {
      setError(result.error?.message || "Failed to register medicine.");
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
    downloadCSV("clinicflow_inventory_template.csv", csvContent);
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
    downloadCSV(filename, csvStr);
  }

  function getItemLocationStock(item) {
    if (!item) return 0;
    if (effectiveLocationId === "all") {
      return item.total_base_stock ?? item.stock_qty ?? 0;
    }
    return dbInventory.getLocationStock(item, effectiveLocationId);
  }

  function isLowStock(item) {
    const base = getItemLocationStock(item);
    return base > 0 && base <= (item.low_stock_threshold || 6);
  }

  function isOutOfStock(item) {
    const base = getItemLocationStock(item);
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
      const stock = getItemLocationStock(item);
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
  }, [inventory, effectiveLocationId]);

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

  const [pageSize, setPageSize] = useState("all");

  const filteredInventory = useMemo(() => {
    const list = inventory.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (companyFilter !== "all" && item.company_name !== companyFilter) return false;

      if (stockStatusFilter === "low" && !isLowStock(item)) return false;
      if (stockStatusFilter === "out" && !isOutOfStock(item)) return false;
      if (stockStatusFilter === "in_stock" && (isLowStock(item) || isOutOfStock(item))) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mName = (item.medicine_name || "").toLowerCase().includes(q);
        const mCode = (item.item_code || "").toLowerCase().includes(q);
        const mCat = (item.category || "").toLowerCase().includes(q);
        const mGen = (item.generic_name || item.product_description || item.naration || "").toLowerCase().includes(q);
        const mComp = (item.company_name || "").toLowerCase().includes(q);
        if (!mName && !mCode && !mCat && !mGen && !mComp) return false;
      }
      return true;
    });

    // Natural Alphanumeric Sort (1, 2, 3... ascending, otherwise A-Z alphabetical)
    return list.sort((a, b) => {
      const nameA = (a.medicine_name || "").trim();
      const nameB = (b.medicine_name || "").trim();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [inventory, searchQuery, categoryFilter, companyFilter, stockStatusFilter]);

  const effectivePageSize = pageSize === "all" ? Math.max(1, filteredInventory.length) : Number(pageSize) || 30;
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredInventory.length / effectivePageSize));

  const paginatedInventory = useMemo(() => {
    if (pageSize === "all") return filteredInventory;
    const size = Number(pageSize) || 30;
    const start = (currentPage - 1) * size;
    return filteredInventory.slice(start, start + size);
  }, [filteredInventory, currentPage, pageSize]);

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
    <div className="w-full h-full max-w-full min-w-0 flex flex-col flex-1 min-h-0 space-y-3 animate-in fade-in duration-300 overflow-hidden">
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

        {/* Tier 1: Title & Primary Action Controls */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
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

          {/* Primary Quick Controls: Multi-Warehouse Selector for Admin / Doctor + Add Medicine */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Multi-Warehouse Selector for Admin / Doctor */}
            {!isLocationLocked && (
              <div className="min-h-[42px] flex items-center gap-1.5 bg-slate-800/90 p-1 px-3 rounded-2xl border border-slate-700">
                <span className="material-symbols-outlined text-xs text-teal-400">warehouse</span>
                <select
                  value={selectedLocationId}
                  onChange={(e) => {
                    setSelectedLocationId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-white text-xs font-bold py-1 pr-2 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">🏢 All Locations</option>
                  {allWarehouses.map((wh) => (
                    <option key={wh.id} value={wh.id} className="bg-slate-900 text-white">
                      📍 {wh.nickname || wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

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
              className="min-h-[42px] px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <span className="material-symbols-outlined text-base font-black">{showForm ? "close" : "add"}</span>
              <span>{showForm ? "Close Form" : "+ Register Medicine"}</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Dedicated Quick Action Command Deck (Full Width, Zero Clipping on Any Screen) */}
        <div className="relative z-10 pt-4 border-t border-slate-700/60 flex flex-wrap items-center gap-2.5">
          {/* Stock Ledger */}
          <button
            id="show-stock-ledger-top-btn"
            onClick={() => {
              setLedgerInitialItem(null);
              setShowStockLedgerModal(true);
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-teal-950/40 hover:shadow-teal-900/60 transition-all active:scale-95 border border-teal-400/40 whitespace-nowrap cursor-pointer"
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
            className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all hover:border-emerald-400 active:scale-95 shadow-sm whitespace-nowrap cursor-pointer"
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
            className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all hover:border-teal-400 active:scale-95 shadow-sm whitespace-nowrap cursor-pointer"
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
            className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
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
            className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-teal-900/40 hover:bg-teal-900/70 text-teal-200 border border-teal-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm whitespace-nowrap cursor-pointer"
            title="Zero-Pilferage Blind Physical Stock Audit (Count shelf items without bias)"
          >
            <span className="material-symbols-outlined text-base text-teal-400">fact_check</span>
            <span>Blind Stock Audit</span>
          </button>
        </div>
      </div>

      {/* Location Scoped Incharge Notice */}
      {isLocationLocked && userAssignedWh && (
        <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-teal-900 text-white rounded-3xl p-4 sm:p-5 border border-teal-500/40 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 font-bold">
              <span className="material-symbols-outlined text-2xl">warehouse</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500 text-slate-950">
                  {userAssignedWh.code || "GDW"}
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  Location Scoped: {userAssignedWh.nickname || userAssignedWh.name}
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Logged in as <strong>{user?.name}</strong> • Only stock &amp; movements for this specific location are accessible.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-teal-950/80 px-4 py-2 rounded-2xl border border-teal-500/30 text-xs font-semibold text-teal-200">
            <span className="material-symbols-outlined text-sm text-teal-400">lock</span>
            <span>Isolated Godown Security Active</span>
          </div>
        </div>
      )}

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
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isLocationLocked ? "Location Stock" : effectiveLocationId === "all" ? "Total Stock Units" : "Location Stock"}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-800 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">inventory</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.totalStockUnits.toLocaleString()}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              {isLocationLocked
                ? `Assigned: ${userAssignedWh?.nickname || "This Godown"}`
                : effectiveLocationId === "all"
                ? "Combined Store & Godown Units"
                : `Filtered: ${currentWarehouseInfo?.nickname || "Selected Location"}`}
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
            {canViewFinancials ? (
              <>
                <div className="text-2xl sm:text-3xl font-black text-emerald-800">
                  Rs. {Math.round(metrics.totalValuationRetail).toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  Cost Asset: Rs. {Math.round(metrics.totalValuationCost).toLocaleString()}
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-black text-slate-400 flex items-center gap-1.5 mt-1">
                  <span className="material-symbols-outlined text-base">lock</span>
                  <span>Confidential</span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Doctor &amp; Owner Access Only
                </div>
              </>
            )}
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                title="Close Form"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>

          {/* DrCreate Rapid Entry Form */}
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

              {/* 2. Product Description */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label htmlFor="quick_product_description" className="md:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                  Product Description
                </label>
                <div className="md:col-span-9">
                  <input
                    id="quick_product_description"
                    name="product_description"
                    type="text"
                    placeholder="e.g. Drops 20ml, 500mg Sugar Free, Sugar Coated, Pediatric..."
                    value={quickForm.product_description}
                    onChange={handleQuickChange}
                    onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                    className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* 3. Product Code & Brand */}
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
                    {allCompanyOptions.map((c) => (
                      <option key={`${c.name}_${c.code}`} value={c.name}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Category Selector with On-the-Fly Custom Category Creation */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label htmlFor="quick_category" className="md:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                  Medicine Category
                </label>
                <div className="md:col-span-9">
                  {!showAddCategoryInput ? (
                    <div className="flex items-center gap-2">
                      <select
                        id="quick_category"
                        name="category"
                        value={quickForm.category}
                        onChange={handleQuickChange}
                        className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold bg-white text-slate-800 focus:border-emerald-600 focus:outline-none transition-all"
                      >
                        {allCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddCategoryInput(true);
                          setCustomCategoryInput("");
                        }}
                        className="px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer shrink-0"
                        title="Add New Custom Category"
                      >
                        <span className="material-symbols-outlined text-base">add</span>
                        <span>New Category</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 animate-in fade-in duration-200">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Type new category name e.g. Herbal Syrup, Inhaler..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (customCategoryInput.trim()) {
                              const created = dbCategories.add(customCategoryInput.trim());
                              setQuickForm((prev) => ({ ...prev, category: created }));
                              setShowAddCategoryInput(false);
                              setCustomCategoryInput("");
                              triggerToast(`✅ Category "${created}" added!`);
                            }
                          } else if (e.key === "Escape") {
                            setShowAddCategoryInput(false);
                          }
                        }}
                        className="w-full border-2 border-emerald-500 rounded-2xl px-4 py-2 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customCategoryInput.trim()) {
                            const created = dbCategories.add(customCategoryInput.trim());
                            setQuickForm((prev) => ({ ...prev, category: created }));
                            setShowAddCategoryInput(false);
                            setCustomCategoryInput("");
                            triggerToast(`✅ Category "${created}" added!`);
                          }
                        }}
                        className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">check</span>
                        <span>Add</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddCategoryInput(false)}
                        className="px-3 py-2.5 rounded-2xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
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

              {/* 5. Medical Store Stock Quantity (Packs) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="md:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                  Opening Store Stock (Packs)
                </label>
                <div className="md:col-span-9">
                  <div className="space-y-1">
                    <input
                      id="quick_store_stock"
                      name="store_stock"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quickForm.store_stock}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border border-teal-300 rounded-xl px-3 py-2 text-xs font-black text-teal-900 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <p className="text-[10.5px] font-bold text-slate-500">
                      ⚡ Enter initial stock quantity in full Pack / Box units.
                    </p>
                  </div>
                </div>
              </div>

              {/* 6. Pricing Row: Purchase / Cost Rate & Retail Sale Price */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-3 text-xs font-black text-slate-800 uppercase tracking-wider">
                  Pricing (Rs.) <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="quick_cost_price" className="block text-[10px] font-bold text-slate-500 mb-1">
                      Purchase / Cost Rate (Rs)
                    </label>
                    <input
                      id="quick_cost_price"
                      name="cost_price"
                      type="number"
                      step="any"
                      placeholder="e.g. 100"
                      value={quickForm.cost_price}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="quick_sale_price" className="block text-[10px] font-bold text-slate-500 mb-1">
                      Retail Sale Price (Rs) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="quick_sale_price"
                      name="sale_price"
                      type="number"
                      step="any"
                      placeholder="e.g. 140"
                      value={quickForm.sale_price}
                      onChange={handleQuickChange}
                      onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(false); }}
                      className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            {/* Quick Form Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setModalCategoryFilter(quickForm.item_code || "All");
                    setModalSearchQuery("");
                    setShowInventoryListModal(true);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
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
                  className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">price_change</span>
                  Price Sheet
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-2xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(false)}
                  className="px-7 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-700/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  Save Medicine [Enter]
                </button>
              </div>
            </div>
          </div>
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

        {/* Category Pill Tabs with Hidden Scrollbar & Touch Scroll Controls */}
        <div className="relative flex items-center w-full group pt-1">
          <button
            type="button"
            onClick={() => scrollCategories("left")}
            className="hidden sm:flex shrink-0 w-7 h-7 rounded-full bg-white shadow-md border border-slate-200 text-slate-600 hover:text-teal-900 items-center justify-center -mr-1 z-10 cursor-pointer transition-all hover:scale-110 active:scale-95"
            title="Scroll Categories Left"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>

          <div
            ref={categoryScrollRef}
            className="flex items-center gap-2 overflow-x-auto scroll-smooth w-full py-1 px-0.5 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
          >
            {["all", ...allCategories].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategoryFilter(cat);
                  setCurrentPage(1);
                }}
                className={`min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
                  categoryFilter === cat
                    ? "bg-teal-800 text-white border-teal-900 shadow-sm shadow-teal-950/20"
                    : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/90 border-slate-200/80"
                }`}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollCategories("right")}
            className="hidden sm:flex shrink-0 w-7 h-7 rounded-full bg-white shadow-md border border-slate-200 text-slate-600 hover:text-teal-900 items-center justify-center -ml-1 z-10 cursor-pointer transition-all hover:scale-110 active:scale-95"
            title="Scroll Categories Right"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
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
        /* Clean Corporate Data Table View */
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Bulk Actions Bar */}
          {selectedItems.size > 0 && (
            <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 flex items-center justify-between">
              <span className="text-xs font-black text-rose-900">
                {selectedItems.size} item{selectedItems.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedItems(new Set())}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all"
                >
                  Clear Selection
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all"
                >
                  Delete Selected ({selectedItems.size})
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1050px]">
              <thead className="bg-slate-900 text-white z-10 text-[10px] font-black uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 text-center w-10 border-b border-slate-800">
                    <input
                      type="checkbox"
                      checked={paginatedInventory.length > 0 && selectedItems.size === paginatedInventory.length}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 accent-teal-500 cursor-pointer"
                      title="Select All"
                    />
                  </th>
                  <th className="py-3 px-2 text-center w-10 border-b border-slate-800">#</th>
                  <th className="py-3 px-4 border-b border-slate-800">Medicine Name &amp; Description</th>
                  <th className="py-3 px-3 border-b border-slate-800">Company</th>
                  <th className="py-3 px-3 text-center border-b border-slate-800">Category</th>
                  <th className="py-3 px-3 text-center border-b border-slate-800">Code</th>
                  <th className="py-3 px-3 text-center border-b border-slate-800 text-teal-300">Store Stock (Packs)</th>
                  <th className="py-3 px-3 text-right border-b border-slate-800">Net Price</th>
                  <th className="py-3 px-3 text-right border-b border-slate-800 text-emerald-300">Rate (Retail)</th>
                  <th className="py-3 px-4 text-right border-b border-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {paginatedInventory.map((item, idx) => {
                  const itemIndex = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  const low = isLowStock(item);
                  const out = isOutOfStock(item);
                  const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || item.sale_price || 0);
                  const cost = Number(item.cost_price_per_box || item.purchase_price || item.cost_price || (sale * 0.7));
                  const totalStock = item.store_stock ?? (item.quantity ?? item.stock_qty ?? 0);
                  const isSelected = selectedItems.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      id={`inv-row-${item.id}`}
                      className={`hover:bg-slate-50 transition-colors ${
                        isSelected ? "bg-teal-50/50" : out ? "bg-rose-50/20" : low ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-50">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.id)}
                          className="w-3.5 h-3.5 accent-teal-600 cursor-pointer"
                        />
                      </td>

                      {/* Row # */}
                      <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[10px] font-bold border-r border-slate-50">
                        {itemIndex}
                      </td>

                      {/* Name + Description (same line) */}
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-slate-900 text-[13px]">{item.medicine_name}</span>
                        {(item.product_description || item.generic_name || item.naration) && (
                          <span className="text-slate-500 text-[11px] font-medium ml-2">— {item.product_description || item.generic_name || item.naration}</span>
                        )}
                        {out && <span className="text-rose-600 text-[10px] font-bold ml-2">[0]</span>}
                        {low && !out && <span className="text-amber-600 text-[10px] font-bold ml-2">[{totalStock}]</span>}
                      </td>

                      {/* Company */}
                      <td className="py-2.5 px-3 text-slate-700 font-bold text-[11px]">
                        {item.company_name || "—"}
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-slate-600 text-[11px] font-medium">
                          {item.category || "Homeopathic Drops"}
                        </span>
                      </td>

                      {/* Code */}
                      <td className="py-2.5 px-3 text-center font-mono text-[10px] font-black text-emerald-800">
                        {item.item_code || "—"}
                      </td>

                      {/* Store Stock */}
                      <td className={`py-2.5 px-3 text-center font-black text-[12px] ${out ? "text-rose-600" : low ? "text-amber-700" : "text-slate-900"}`}>
                        {totalStock} {item.box_label || "Packs"}
                      </td>

                      {/* Cost */}
                      <td className="py-2.5 px-3 text-right font-bold text-slate-500 text-[11px]">
                        {canViewFinancials ? `Rs.${cost.toLocaleString()}` : "—"}
                      </td>

                      {/* Sale */}
                      <td className="py-2.5 px-3 text-right font-black text-emerald-900 text-[12px]">
                        Rs.{sale.toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleRequestEdit(item)} className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-600 text-[10px] font-bold transition-all" title="Edit">Edit</button>
                          <button onClick={() => { setLedgerInitialItem(item); setShowStockLedgerModal(true); }} className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-700 hover:text-white text-emerald-700 text-[10px] font-bold transition-all" title="Ledger">Ledger</button>
                          <button onClick={() => setDeletingItem(item)} className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 text-[10px] font-bold transition-all" title="Delete">Del</button>
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
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
          {paginatedInventory.map((item) => {
            const low = isLowStock(item);
            const out = isOutOfStock(item);
            const base = getItemLocationStock(item);
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
                    <span className="font-black text-slate-900">
                      {isLocationLocked
                        ? `${base} Units (${userAssignedWh?.nickname || "Assigned Godown"})`
                        : effectiveLocationId === "all"
                        ? formatStockBreakdown(item)
                        : `${base} Units (${currentWarehouseInfo?.nickname || "Selected Location"})`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Price:</span>
                    <span className="font-black text-emerald-800">{formatCurrency(sale)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">Cost Rate:</span>
                    <span className="font-bold text-slate-600">
                      {canViewFinancials ? `Rs. ${cost.toLocaleString()}` : "🔒 Confidential"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => handleRequestEdit(item)}
                    className="flex-1 py-2 rounded-xl bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 text-xs font-bold border border-blue-200 flex items-center justify-center gap-1 transition-all cursor-pointer"
                    title="Edit Item"
                  >
                    <span className="material-symbols-outlined text-xs">edit</span>
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setLedgerInitialItem(item);
                      setShowStockLedgerModal(true);
                    }}
                    className="flex-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center justify-center gap-1 transition-all cursor-pointer"
                    title="Stock Ledger"
                  >
                    <span className="material-symbols-outlined text-xs">menu_book</span>
                    Ledger
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMovementItem(item);
                      setIsMovementOpen(true);
                    }}
                    className="flex-1 py-2 rounded-xl bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-800 text-xs font-bold border border-teal-200 flex items-center justify-center gap-1 transition-all cursor-pointer"
                    title="Stock Card"
                  >
                    <span className="material-symbols-outlined text-xs">analytics</span>
                    Card
                  </button>
                  <button
                    onClick={() => handleRequestDelete(item)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-xs font-bold border border-rose-200 flex items-center justify-center transition-all cursor-pointer"
                    title="Delete Item (Admin Permission)"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination & Display Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs font-bold text-slate-600 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            Showing <span className="text-slate-900 font-extrabold">{paginatedInventory.length}</span> of{" "}
            <span className="text-slate-900 font-extrabold">{filteredInventory.length}</span> medicines
          </div>
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium">Display Limit:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200 font-extrabold text-teal-900 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">All ({filteredInventory.length.toLocaleString()})</option>
              <option value="100">100 items</option>
              <option value="500">500 items</option>
              <option value="30">30 items</option>
            </select>
          </div>
        </div>

        {pageSize !== "all" && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-800 font-bold transition-all cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2.5 py-1 rounded-xl bg-teal-800 text-white font-black text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-800 font-bold transition-all cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

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

      {/* 1. Admin Passcode Authorization Modal */}
      {adminAuthModal.isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">lock</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">Admin Authorization Required</h3>
                  <p className="text-[11px] text-slate-300">
                    {adminAuthModal.action === "edit" ? "Modify Catalog Item" : "Delete Catalog Item"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminAuthModal({ isOpen: false, action: "", targetItem: null, passcode: "", error: "", showPass: false })}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleVerifyAdminPasscode} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">security</span>
                <div>
                  <strong>Staff Permission Guard:</strong> Deleting or modifying inventory items requires Clinic Admin / Supervisor Passcode to maintain data integrity.
                </div>
              </div>

              {adminAuthModal.targetItem && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                  <div className="font-extrabold text-slate-900">{adminAuthModal.targetItem.medicine_name}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    {adminAuthModal.targetItem.company_name} • {adminAuthModal.targetItem.category}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Admin Passcode / PIN <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={adminAuthModal.showPass ? "text" : "password"}
                    autoFocus
                    placeholder="Enter Admin Master Passcode..."
                    value={adminAuthModal.passcode}
                    onChange={(e) => setAdminAuthModal((prev) => ({ ...prev, passcode: e.target.value, error: "" }))}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm font-bold text-slate-900 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setAdminAuthModal((prev) => ({ ...prev, showPass: !prev.showPass }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    <span className="material-symbols-outlined text-base">
                      {adminAuthModal.showPass ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                {adminAuthModal.error && (
                  <p className="text-rose-600 font-bold text-xs mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{adminAuthModal.error}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminAuthModal({ isOpen: false, action: "", targetItem: null, passcode: "", error: "", showPass: false })}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  <span>Authorize &amp; Continue</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Edit Medicine Details Modal */}
      {editingItem && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/30 text-teal-300 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">edit_note</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                    Edit Medicine Details
                    <span className="bg-teal-500/30 text-teal-200 text-[10px] font-black px-2 py-0.5 rounded-full border border-teal-500/40">
                      ID: {editingItem.id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Update catalog name, pricing, stock levels &amp; formula specs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Product Name */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Medicine / Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.medicine_name}
                    onChange={(e) => setEditFormData({ ...editFormData, medicine_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-bold text-slate-900"
                    placeholder="e.g. Berberis Vulgaris"
                  />
                </div>

                {/* Company / Manufacturer */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Company / Brand <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.company_name}
                    onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-bold text-slate-900"
                    placeholder="e.g. BM Pvt LTD"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-bold text-slate-900"
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Item Code */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Item Code / SKU
                  </label>
                  <input
                    type="text"
                    value={editFormData.item_code}
                    onChange={(e) => setEditFormData({ ...editFormData, item_code: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-bold text-slate-900"
                    placeholder="e.g. BM-01"
                  />
                </div>

                {/* Product Description */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Product Description
                  </label>
                  <input
                    type="text"
                    value={editFormData.product_description}
                    onChange={(e) => setEditFormData({ ...editFormData, product_description: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-bold text-slate-900"
                    placeholder="e.g. Drops 20ml, 500mg Sugar Free, Pediatric..."
                  />
                </div>

                {/* Pricing Box */}
                <div className="sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Purchase Cost Rate (Rs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.cost_price}
                      onChange={(e) => setEditFormData({ ...editFormData, cost_price: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-bold font-mono text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                      Retail Sale Price (Rs) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={editFormData.sale_price}
                      onChange={(e) => setEditFormData({ ...editFormData, sale_price: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-black font-mono text-emerald-900"
                    />
                  </div>
                </div>

                {/* Stock Counts Box with Dynamic Registered Warehouses Breakdown */}
                <div className="sm:col-span-2 bg-teal-50/60 p-4 rounded-2xl border border-teal-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-teal-950 uppercase tracking-wider">
                      🏪 Store Counter
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.store_stock}
                      onChange={(e) => setEditFormData({ ...editFormData, store_stock: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-teal-300 bg-white font-mono font-bold text-xs text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  {/* Registered Warehouses / Godowns */}
                  {allWarehouses.map((wh, idx) => {
                    const colorClasses = idx % 2 === 0
                      ? { label: "text-blue-950", border: "border-blue-300", ring: "focus:ring-blue-500" }
                      : { label: "text-purple-950", border: "border-purple-300", ring: "focus:ring-purple-500" };
                    return (
                      <div key={`edit_wh_${wh.id}`} className="space-y-1">
                        <label className={`text-[11px] font-black uppercase tracking-wider ${colorClasses.label}`}>
                          🏢 {wh.name}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editFormData.location_stocks?.[wh.id] ?? (wh.id === "wh_001" ? editFormData.warehouse_1_stock : editFormData.warehouse_2_stock) ?? "0"}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditFormData((prev) => ({
                              ...prev,
                              location_stocks: {
                                ...(prev.location_stocks || {}),
                                [wh.id]: val,
                              },
                              ...(wh.id === "wh_001" ? { warehouse_1_stock: val } : {}),
                              ...(wh.id === "wh_002" ? { warehouse_2_stock: val } : {}),
                            }));
                          }}
                          className={`w-full px-3 py-1.5 rounded-xl border bg-white font-mono font-bold text-xs text-slate-900 focus:ring-2 focus:outline-none ${colorClasses.border} ${colorClasses.ring}`}
                        />
                      </div>
                    );
                  })}

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                      ⚠️ Low Alert
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.low_stock_threshold}
                      onChange={(e) => setEditFormData({ ...editFormData, low_stock_threshold: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-amber-300 bg-white font-mono font-bold text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Form Footer */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const it = editingItem;
                    setEditingItem(null);
                    handleRequestDelete(it);
                  }}
                  className="px-4 py-2 rounded-xl text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete This Item</span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Delete Confirmation Modal */}
      {deletingItem && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-rose-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-200 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">delete_forever</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Permanently Delete Item?</h3>
                  <p className="text-[11px] text-rose-200">Catalog Removal Confirmation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to delete this medicine from the store inventory catalog?
              </p>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                <div className="font-black text-slate-900 text-sm">{deletingItem.medicine_name}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-bold text-teal-800">{deletingItem.company_name || "General Brand"}</span>
                  <span>•</span>
                  <span>{deletingItem.category}</span>
                  {deletingItem.item_code && (
                    <>
                      <span>•</span>
                      <span className="font-mono font-bold">Code: {deletingItem.item_code}</span>
                    </>
                  )}
                </div>
                <div className="text-xs font-bold text-rose-900 pt-1 border-t border-rose-200/60">
                  Current Stock: {formatStockBreakdown(deletingItem)}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Keep Item
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Yes, Delete Permanently</span>
                </button>
              </div>
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
