import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../hooks/useAuth.js";
import { verifyAdminPasscode } from "../api/auth.js";
import { getInventory, addInventoryItem, bulkImportInventory } from "../api/store.js";
import { dbClinic, dbSuppliers, dbWarehouses, dbInventory, dbCategories, dbCompanies, dbAuditLogs, formatStockBreakdown, exportInventoryTemplateCSV, parseInventoryCSV } from "../api/db.js";
import { formatCurrency, downloadCSV } from "../utils/formatters.js";
import { printInventoryListReceipt, printProductPricingListReceipt, printBlindStockAuditSheet } from "../utils/thermalPrinter.js";
import ProductMovementModal from "../components/ProductMovementModal.jsx";
import StockLedgerModal from "../components/StockLedgerModal.jsx";

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
  const words = clean.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.slice(0, 3).map((w) => w[0].toUpperCase()).join("");
  }
  return clean.substring(0, 3).toUpperCase() || "GEN";
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
  const [activeSubTab, setActiveSubTab] = useState("inventory"); // "inventory" | "register"
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
  const [categoryUpdateTrigger, setCategoryUpdateTrigger] = useState(0);

  // Dynamic Companies from dbCompanies & active inventory
  const [customCompanyInput, setCustomCompanyInput] = useState("");
  const [customCompanyCodeInput, setCustomCompanyCodeInput] = useState("");
  const [showAddCompanyInput, setShowAddCompanyInput] = useState(false);
  const [companyUpdateTrigger, setCompanyUpdateTrigger] = useState(0);

  const allCategories = useMemo(() => {
    return dbCategories.getAll();
  }, [inventory, categoryUpdateTrigger]);

  // Popup Modal States for DrCreate.xlsm / Access style
  const [showInventoryListModal, setShowInventoryListModal] = useState(false);
  const [showPricingListModal, setShowPricingListModal] = useState(false);
  const [modalCategoryFilter, setModalCategoryFilter] = useState("All");
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  // Registration Form State (Matching DrCreate / Access layout)
  const [quickForm, setQuickForm] = useState({
    medicine_name: "",
    product_description: "",
    packing: "",
    company_name: "",
    item_code: "",
    category: "",
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
    packing: "",
    company_name: "",
    item_code: "",
    category: "",
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
  const [auditCompanyFilter, setAuditCompanyFilter] = useState("All");

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
      packing: item.packing || item.unit_label || "",
      company_name: item.company_name || "",
      item_code: item.item_code || "",
      category: item.category || "",
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
    const packingVal = editFormData.packing?.trim() || "";

    const updated = {
      medicine_name: editFormData.medicine_name.trim(),
      product_description: desc,
      generic_name: desc,
      naration: desc,
      packing: packingVal,
      unit_label: packingVal || editingItem.unit_label || "Bottle",
      strip_label: packingVal || editingItem.strip_label || "Bottle",
      company_name: editFormData.company_name.trim(),
      item_code: editFormData.item_code.trim(),
      category: editFormData.category || "",
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

  // Quick Bulk Stock & Price Update Modal State
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateItems, setBulkUpdateItems] = useState([]);
  const [batchUniformStock, setBatchUniformStock] = useState("");
  const [batchAddQty, setBatchAddQty] = useState("");
  const [batchUniformCost, setBatchUniformCost] = useState("");
  const [batchUniformSale, setBatchUniformSale] = useState("");

  const toggleSelectItem = (itemId) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === paginatedInventory?.length && paginatedInventory?.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set((paginatedInventory || []).map((i) => i.id)));
    }
  };

  const handleOpenBulkUpdate = () => {
    if (selectedItems.size === 0) return;
    const itemsToEdit = inventory
      .filter((i) => selectedItems.has(i.id))
      .map((item) => {
        const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || item.sale_price || 0);
        const cost = Number(item.cost_price_per_box || item.purchase_price || item.cost_price || 0);
        const curStock = Number(item.store_stock ?? (item.quantity ?? item.stock_qty ?? 0));
        return {
          id: item.id,
          medicine_name: item.medicine_name || "",
          product_description: item.product_description || item.generic_name || item.naration || "",
          company_name: item.company_name || "",
          category: item.category || "Homeopathic Drops",
          item_code: item.item_code || "",
          current_stock: curStock,
          new_stock: curStock,
          current_cost: cost,
          new_cost: cost,
          current_sale: sale,
          new_sale: sale,
        };
      });

    setBulkUpdateItems(itemsToEdit);
    setBatchUniformStock("");
    setBatchAddQty("");
    setBatchUniformCost("");
    setBatchUniformSale("");
    setShowBulkUpdateModal(true);
  };

  const handleBulkItemChange = (id, field, value) => {
    setBulkUpdateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleApplyBatchStock = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (batchUniformStock === "" || batchUniformStock === null || batchUniformStock === undefined) return;
    const val = Math.max(0, Number(batchUniformStock) || 0);
    setBulkUpdateItems((prev) =>
      prev.map((item) => ({ ...item, new_stock: val }))
    );
    triggerToast(`Set stock to ${val} for all ${bulkUpdateItems.length} items.`);
  };

  const handleApplyBatchAddQty = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (batchAddQty === "" || batchAddQty === null || batchAddQty === undefined) return;
    const addVal = Number(batchAddQty) || 0;
    setBulkUpdateItems((prev) =>
      prev.map((item) => ({ ...item, new_stock: Math.max(0, (Number(item.new_stock) || 0) + addVal) }))
    );
    triggerToast(`Added +${addVal} stock to all ${bulkUpdateItems.length} items.`);
  };

  const handleApplyBatchCost = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (batchUniformCost === "" || batchUniformCost === null || batchUniformCost === undefined) return;
    const val = Math.max(0, Number(batchUniformCost) || 0);
    setBulkUpdateItems((prev) =>
      prev.map((item) => ({ ...item, new_cost: val }))
    );
    triggerToast(`Set cost price to Rs. ${val} for all ${bulkUpdateItems.length} items.`);
  };

  const handleApplyBatchSale = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (batchUniformSale === "" || batchUniformSale === null || batchUniformSale === undefined) return;
    const val = Math.max(0, Number(batchUniformSale) || 0);
    setBulkUpdateItems((prev) =>
      prev.map((item) => ({ ...item, new_sale: val }))
    );
    triggerToast(`Set retail rate to Rs. ${val} for all ${bulkUpdateItems.length} items.`);
  };

  const handleSaveBulkUpdate = (e) => {
    if (e) e.preventDefault();
    if (bulkUpdateItems.length === 0) return;

    bulkUpdateItems.forEach((row) => {
      const storeQty = Math.max(0, Number(row.new_stock) || 0);
      const costVal = Math.max(0, Number(row.new_cost) || 0);
      const saleVal = Math.max(0, Number(row.new_sale) || 0);

      const original = inventory.find((i) => i.id === row.id) || {};
      const updatedLocationStocks = {
        ...(original.location_stocks || {}),
        wh_str: storeQty,
      };

      dbInventory.update(row.id, {
        store_stock: storeQty,
        stock_qty: storeQty,
        total_base_stock: storeQty + (original.warehouse_stock || 0),
        cost_price_per_box: costVal,
        purchase_price: costVal,
        cost_price: costVal,
        unit_sale_price: saleVal,
        box_sale_price: saleVal,
        sale_price: saleVal,
        unit_price: saleVal,
        location_stocks: updatedLocationStocks,
      });
    });

    const updatedCount = bulkUpdateItems.length;
    setShowBulkUpdateModal(false);
    setSelectedItems(new Set());
    load();
    triggerToast(`⚡ Successfully updated stock & prices for ${updatedCount} medicines in 1 click!`);
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
    setCompanyUpdateTrigger((v) => v + 1);
    setCategoryUpdateTrigger((v) => v + 1);
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
  // Dynamically aggregate all companies from dbCompanies, dbSuppliers, and active Inventory
  const allCompanyOptions = useMemo(() => {
    const map = new Map();

    // 1. Add companies from dbCompanies
    const savedCompanies = dbCompanies ? dbCompanies.getAll() : [];
    savedCompanies.forEach((c) => {
      const name = (c.name || "").trim();
      if (name) {
        map.set(name.toLowerCase(), {
          name,
          code: c.code || extractCompanyCode(name),
          id: c.id,
        });
      }
    });

    // 2. Add all suppliers from dbSuppliers
    const suppliers = dbSuppliers ? dbSuppliers.getAll() : [];
    suppliers.forEach((s) => {
      if (s.name && s.name.trim()) {
        const code = extractCompanyCode(s);
        const key = s.name.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, {
            name: s.name.trim(),
            code: code,
            supplier_id: s.id,
            supplier_code: s.supplier_code || s.code || "",
          });
        }
      }
    });

    // 3. Add any companies already existing in current inventory
    inventory.forEach((i) => {
      if (i.company_name && i.company_name.trim()) {
        const key = i.company_name.toLowerCase().trim();
        if (!map.has(key)) {
          const code = i.item_code || extractCompanyCode(i.company_name);
          map.set(key, { name: i.company_name.trim(), code: String(code).toUpperCase() });
        }
      }
    });

    // Sort alphabetically by company name
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, companyUpdateTrigger]);

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

    // 3. Match company name starting with code
    const namePrefix = allCompanyOptions.find((c) => c.name.toLowerCase().startsWith(clean));
    if (namePrefix) return namePrefix;

    return null;
  }

  function handleSaveCustomCompany() {
    if (customCompanyInput.trim()) {
      const code = customCompanyCodeInput.trim() || extractCompanyCode(customCompanyInput.trim());
      const created = dbCompanies.add(customCompanyInput.trim(), code);
      if (created) {
        setCompanyUpdateTrigger((v) => v + 1);
        setQuickForm((prev) => ({
          ...prev,
          company_name: created.name,
          item_code: created.code || prev.item_code,
        }));
        setShowAddCompanyInput(false);
        setCustomCompanyInput("");
        setCustomCompanyCodeInput("");
        triggerToast(`✅ Company "${created.name}" added!`);
      }
    }
  }

  // Smooth Enter-Key Form Navigation (Moves to next input without early form submit)
  function handleFormKeyDown(e, isLastField = false, onSubmit = null) {
    if (e.key === "Enter") {
      // Ctrl+Enter or Cmd+Enter triggers submit immediately from anywhere
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (onSubmit) onSubmit();
        else handleQuickAdd(false);
        return;
      }

      // If textarea, let Enter create new lines unless Ctrl is pressed
      if (e.target.tagName.toLowerCase() === "textarea") {
        return;
      }

      e.preventDefault();

      if (isLastField) {
        if (onSubmit) onSubmit();
        else handleQuickAdd(false);
        return;
      }

      // Query parent container for next focusable input
      const container =
        e.currentTarget.closest("[data-form-container]") ||
        e.currentTarget.closest("form") ||
        e.currentTarget.closest(".space-y-5") ||
        e.currentTarget.closest(".space-y-4");

      if (!container) return;

      const selector =
        'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])';
      const focusable = Array.from(container.querySelectorAll(selector)).filter(
        (el) => el.offsetParent !== null && !el.classList.contains("skip-enter-nav")
      );

      const index = focusable.indexOf(e.currentTarget);
      if (index >= 0 && index < focusable.length - 1) {
        const next = focusable[index + 1];
        next.focus();
        if (next.tagName.toLowerCase() === "input" && typeof next.select === "function") {
          next.select();
        }
      } else if (index === focusable.length - 1) {
        if (onSubmit) onSubmit();
        else handleQuickAdd(false);
      }
    }
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
    const packingVal = quickForm.packing?.trim() || "";

    const payload = {
      medicine_name: quickForm.medicine_name.trim(),
      product_description: desc,
      generic_name: desc,
      naration: desc,
      packing: packingVal,
      unit_label: packingVal || "Bottle",
      strip_label: packingVal || "Bottle",
      box_label: "Pack",
      company_name: (quickForm.company_name || "").trim(),
      item_code: (quickForm.item_code || "").trim() || extractCompanyCode(quickForm.company_name),
      category: quickForm.category || "",
      has_multi_unit: false,
      strips_per_box: 1,
      units_per_strip: 1,
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
      if (payload.company_name) {
        dbCompanies.add(payload.company_name, payload.item_code);
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
          packing: "",
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

  // Unique Company Names for Filter Dropdowns
  const uniqueCompanyNames = useMemo(() => {
    const set = new Set();
    // 1. All companies from dbCompanies & allCompanyOptions
    (allCompanyOptions || []).forEach((c) => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    // 2. Inventory companies
    inventory.forEach((i) => {
      if (i.company_name && i.company_name.trim()) set.add(i.company_name.trim());
    });
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allCompanyOptions, inventory]);

  // Filtered List for Modal Popups (Stock Inventory Sheet & Product Pricing List)
  const modalFilteredItems = useMemo(() => {
    return inventory.filter((item) => {
      if (modalCategoryFilter !== "All" && modalCategoryFilter !== "all") {
        const matchesCompany = (item.company_name || "").toLowerCase() === modalCategoryFilter.toLowerCase();
        if (!matchesCompany) return false;
      }
      if (modalSearchQuery.trim()) {
        const q = modalSearchQuery.toLowerCase().trim();
        const mName = (item.medicine_name || "").toLowerCase().includes(q);
        const mCode = (item.item_code || "").toLowerCase().includes(q);
        const mCat = (item.category || "").toLowerCase().includes(q);
        const mNar = (item.generic_name || item.product_description || item.naration || "").toLowerCase().includes(q);
        const mComp = (item.company_name || "").toLowerCase().includes(q);
        if (!mName && !mCode && !mCat && !mNar && !mComp) return false;
      }
      return true;
    });
  }, [inventory, modalCategoryFilter, modalSearchQuery]);

  // Filtered List for Blind Physical Stock Audit Modal
  const auditFilteredItems = useMemo(() => {
    return inventory.filter((item) => {
      if (auditCompanyFilter !== "All" && auditCompanyFilter !== "all") {
        if ((item.company_name || "").toLowerCase() !== auditCompanyFilter.toLowerCase()) {
          return false;
        }
      }
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase().trim();
        const mName = (item.medicine_name || "").toLowerCase().includes(q);
        const mComp = (item.company_name || "").toLowerCase().includes(q);
        const mCode = (item.item_code || "").toLowerCase().includes(q);
        const mNar = (item.generic_name || item.product_description || item.naration || "").toLowerCase().includes(q);
        if (!mName && !mComp && !mCode && !mNar) return false;
      }
      return true;
    });
  }, [inventory, auditCompanyFilter, auditSearchQuery]);

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
    <div className="w-full h-full max-w-full min-w-0 flex flex-col flex-1 min-h-0 space-y-4 sm:space-y-6 animate-in fade-in duration-300 overflow-y-auto custom-scroll p-3 sm:p-5 lg:p-6 bg-[#F8FAFC]">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-teal-900/95 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl border border-teal-500/40 backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-top-4">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* BEGIN: HeroHeaderBanner */}
      <section className="rounded-2xl bg-gradient-to-r from-teal-900 via-teal-800 to-[#0c4e48] text-white p-5 sm:p-7 shadow-lg relative overflow-hidden border border-teal-700/40" data-purpose="hero-header-banner">
        {/* Background decorative radial glow */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-12 w-60 h-60 rounded-full bg-teal-300/5 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Left Info Block */}
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-teal-950/60 border border-teal-500/30 text-[11px] font-semibold text-teal-200 backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE PHARMACY WAREHOUSE</span>
              <span className="text-teal-400">•</span>
              <span className="text-teal-300">DrCreate V2.0 Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Medical Store Inventory
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/90 leading-relaxed font-normal">
              Catalog management, 4-level stock ledger, multi-unit packaging breakdowns, and instant CSV uploads.
            </p>
          </div>

          {/* Right Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {/* Multi-Warehouse Selector for Admin / Doctor */}
            {!isLocationLocked && (
              <div className="flex items-center space-x-1.5 bg-teal-950/60 p-1.5 px-3 rounded-xl border border-teal-500/30 text-xs text-white">
                <svg className="w-3.5 h-3.5 text-teal-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.75a1.5 1.5 0 011.5-1.5h1.5a1.5 1.5 0 011.5 1.5V21" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <select
                  value={selectedLocationId}
                  onChange={(e) => {
                    setSelectedLocationId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-white text-xs font-bold py-1 pr-2 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">All Locations</option>
                  {allWarehouses.map((wh) => (
                    <option key={wh.id} value={wh.id} className="bg-slate-900 text-white">
                      {wh.nickname || wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveSubTab("inventory")}
              className={`inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all shadow-sm backdrop-blur-xs cursor-pointer ${
                activeSubTab === "inventory"
                  ? "bg-teal-400/30 border-teal-300/60 text-white"
                  : "bg-teal-400/20 hover:bg-teal-400/30 border-teal-300/40 text-teal-50"
              }`}
            >
              <svg className="w-4 h-4 text-teal-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Store Stock Directory</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSubTab(activeSubTab === "register" ? "inventory" : "register");
                if (activeSubTab !== "register") {
                  setTimeout(() => {
                    if (quickNameRef.current) quickNameRef.current.focus();
                  }, 100);
                }
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-md shadow-emerald-950/20 transition-all transform active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{activeSubTab === "register" ? "Back to Stock" : "+ Register Medicine"}</span>
            </button>
          </div>
        </div>

        {/* Hero Sub-Navigation Quick Tabs */}
        <div className="mt-6 pt-5 border-t border-teal-700/50 flex items-center flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setLedgerInitialItem(null);
              setShowStockLedgerModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-950/70 hover:bg-teal-950 text-teal-200 font-medium border border-teal-600/40 transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-teal-300" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Stock Ledger</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalCategoryFilter("All");
              setModalSearchQuery("");
              setShowInventoryListModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-950/40 hover:bg-teal-950/70 text-teal-100 font-medium border border-teal-700/30 transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-teal-300" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Stock Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalCategoryFilter("All");
              setModalSearchQuery("");
              setShowPricingListModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-950/40 hover:bg-teal-950/70 text-teal-100 font-medium border border-teal-700/30 transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-teal-300" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 6h.008v.008H6V6z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Price List</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCsvImportStatus({ loading: false, result: null, error: "" });
              setCsvParsedRows([]);
              setCsvFileName("");
              setShowCsvModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-700/60 hover:bg-teal-700 text-white font-medium border border-teal-500/40 transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-teal-200" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Bulk CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuditCounts({});
              setAuditSearchQuery("");
              setAuditCompanyFilter("All");
              setShowBlindAuditModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-950/40 hover:bg-teal-950/70 text-teal-100 font-medium border border-teal-700/30 transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-teal-300" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Blind Stock Audit</span>
          </button>
        </div>
      </section>
      {/* END: HeroHeaderBanner */}

      {/* SUB-TAB 2: DEDICATED MEDICINE REGISTRATION WORKSTATION */}
      {activeSubTab === "register" ? (
        <div className="bg-white border-2 border-emerald-600/50 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-5 sm:p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <span className="material-symbols-outlined text-2xl">app_registration</span>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-white flex items-center gap-2">
                  New Medicine Registration Workstation
                  <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                    Rapid Entry
                  </span>
                </h2>
                <p className="text-xs text-emerald-200/80 font-medium mt-0.5">
                  Register new pharmaceuticals &amp; homeopathic remedies into DrCreate catalog
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSubTab("inventory")}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Back to Inventory Catalogue</span>
            </button>
          </div>

          {/* Rapid Entry Form Content */}
          <div className="p-6 md:p-8 space-y-6 bg-slate-50/50">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs text-emerald-950 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                  ↵
                </div>
                <div>
                  <strong>Continuous Rapid Entry:</strong> Press{" "}
                  <kbd className="bg-white px-2 py-0.5 rounded border border-emerald-300 font-mono font-black text-emerald-800">
                    Enter
                  </kbd>{" "}
                  to jump to next field, and <kbd className="bg-white px-2 py-0.5 rounded border border-emerald-300 font-mono font-black text-emerald-800">Enter</kbd> on the final field (or <kbd className="bg-white px-1.5 py-0.5 rounded border border-emerald-300 font-mono font-bold text-emerald-800">Ctrl+Enter</kbd>) to save &amp; register next.
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-800">
                <span>Margin:</span>
                <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300 font-mono">
                  Rs. {quickProfitMargin.rs.toFixed(0)} ({quickProfitMargin.pct}%)
                </span>
              </div>
            </div>

            {/* Executive Form Grid */}
            <div data-form-container="medicine-registration" className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              {/* Row 1: Product Name, Packing & Description */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5">
                  <label htmlFor="quick_medicine_name" className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={quickNameRef}
                    id="quick_medicine_name"
                    name="medicine_name"
                    type="text"
                    placeholder="e.g. AMPHOSCA, BIOCARDE, L 8 DROPS..."
                    value={quickForm.medicine_name}
                    onChange={handleQuickChange}
                    onKeyDown={(e) => handleFormKeyDown(e)}
                    className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                    required
                  />
                </div>

                <div className="md:col-span-3">
                  <label htmlFor="quick_packing" className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Packing / Size</span>
                    <span className="text-[10px] text-teal-700 font-bold font-mono">e.g. 60 TABS, 30 ML</span>
                  </label>
                  <input
                    id="quick_packing"
                    name="packing"
                    type="text"
                    list="packingSuggestions"
                    placeholder="60 TABS, 30 ML, 1000 ML..."
                    value={quickForm.packing}
                    onChange={handleQuickChange}
                    onKeyDown={(e) => handleFormKeyDown(e)}
                    className="w-full border border-teal-300 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 bg-teal-50/30 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all uppercase"
                  />
                  <datalist id="packingSuggestions">
                    <option value="30 ML" />
                    <option value="60 TABS" />
                    <option value="40 TABS" />
                    <option value="45 TABS" />
                    <option value="90 TABS" />
                    <option value="90 ML" />
                    <option value="250 ML" />
                    <option value="1000 ML" />
                    <option value="60 CAPS" />
                    <option value="350 GMS" />
                    <option value="100 GMS" />
                    <option value="30 ML / 60 TABS" />
                    <option value="Course" />
                  </datalist>
                </div>

                <div className="md:col-span-4">
                  <label htmlFor="quick_product_description" className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Product Description (Optional)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Editable</span>
                  </label>
                  <input
                    id="quick_product_description"
                    name="product_description"
                    type="text"
                    placeholder="e.g. Pediatric, Sugar Free..."
                    value={quickForm.product_description}
                    onChange={handleQuickChange}
                    onKeyDown={(e) => handleFormKeyDown(e)}
                    className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Row 2: Product Code, Brand & Category */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label htmlFor="quick_item_code" className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                    Company Code
                  </label>
                  <input
                    id="quick_item_code"
                    name="item_code"
                    type="text"
                    placeholder="e.g. BM, MKT, PB, SCH"
                    value={quickForm.item_code}
                    onChange={handleQuickChange}
                    onKeyDown={(e) => handleFormKeyDown(e)}
                    className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-mono font-bold text-emerald-900 uppercase tracking-wider bg-slate-50/50 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                  />
                </div>

                <div className="md:col-span-4">
                  <label htmlFor="quick_company_name" className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                    Company / Brand
                  </label>
                  {!showAddCompanyInput ? (
                    <div className="flex items-center gap-2">
                      <select
                        id="quick_company_name"
                        name="company_name"
                        value={quickForm.company_name}
                        onChange={handleQuickChange}
                        onKeyDown={(e) => handleFormKeyDown(e)}
                        className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold bg-white text-slate-800 focus:border-emerald-600 focus:outline-none transition-all"
                      >
                        <option value="">-- Select Company / Brand --</option>
                        {allCompanyOptions.map((c) => (
                          <option key={`${c.name}_${c.code}`} value={c.name}>
                            {c.name} {c.code ? `(${c.code})` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddCompanyInput(true);
                          setCustomCompanyInput("");
                          setCustomCompanyCodeInput("");
                        }}
                        className="px-3.5 py-2.5 rounded-2xl bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-800 font-bold text-xs whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer shrink-0"
                        title="Add New Custom Company"
                      >
                        <span className="material-symbols-outlined text-base">add</span>
                        <span>New Company</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 animate-in fade-in duration-200">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Company Name..."
                        value={customCompanyInput}
                        onChange={(e) => {
                          setCustomCompanyInput(e.target.value);
                          if (!customCompanyCodeInput || customCompanyCodeInput === extractCompanyCode(customCompanyInput)) {
                            setCustomCompanyCodeInput(extractCompanyCode(e.target.value));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveCustomCompany();
                          } else if (e.key === "Escape") {
                            setShowAddCompanyInput(false);
                          }
                        }}
                        className="w-full border-2 border-teal-500 rounded-2xl px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Code (e.g. BM)"
                        value={customCompanyCodeInput}
                        onChange={(e) => setCustomCompanyCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveCustomCompany();
                          } else if (e.key === "Escape") {
                            setShowAddCompanyInput(false);
                          }
                        }}
                        className="w-24 border-2 border-teal-500 rounded-2xl px-3 py-2 text-xs font-mono font-bold uppercase bg-white text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomCompany}
                        className="px-3.5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">check</span>
                        <span>Add</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddCompanyInput(false)}
                        className="px-2.5 py-2.5 rounded-2xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="md:col-span-5">
                  <label htmlFor="quick_category" className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                    Medicine Category
                  </label>
                  {!showAddCategoryInput ? (
                    <div className="flex items-center gap-2">
                      <select
                        id="quick_category"
                        name="category"
                        value={quickForm.category}
                        onChange={handleQuickChange}
                        onKeyDown={(e) => handleFormKeyDown(e)}
                        className="w-full border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-bold bg-white text-slate-800 focus:border-emerald-600 focus:outline-none transition-all"
                      >
                        <option value="">{allCategories.length === 0 ? "-- No Categories (Add New) --" : "-- Select Category (Optional) --"}</option>
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
                        placeholder="Type category..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (customCategoryInput.trim()) {
                              const created = dbCategories.add(customCategoryInput.trim());
                              setCategoryUpdateTrigger((v) => v + 1);
                              setQuickForm((prev) => ({ ...prev, category: created }));
                              setShowAddCategoryInput(false);
                              setCustomCategoryInput("");
                              triggerToast(`Category "${created}" added!`);
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
                            setCategoryUpdateTrigger((v) => v + 1);
                            setQuickForm((prev) => ({ ...prev, category: created }));
                            setShowAddCategoryInput(false);
                            setCustomCategoryInput("");
                            triggerToast(`Category "${created}" added!`);
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

              {/* Row 3: Net Price, Rate (Retail Price), Initial Stock & Alert Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label htmlFor="quick_cost_price" className="block text-[11px] font-black text-slate-800 uppercase tracking-wider mb-1">
                    Net Price (Paid) *
                  </label>
                  <input
                    id="quick_cost_price"
                    name="cost_price"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Rs. Net"
                    value={quickForm.cost_price}
                    onChange={handleQuickChange}
                    onKeyDown={(e) => handleFormKeyDown(e)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-white focus:border-emerald-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="quick_sale_price" className="block text-[11px] font-black text-slate-800 uppercase tracking-wider mb-1">
                    Rate (Retail Price) *
                  </label>
                  <input
                    id="quick_sale_price"
                    name="sale_price"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Rs. MRP"
                    value={quickForm.sale_price}
                    onChange={handleQuickChange}
                    onKeyDown={(e) => handleFormKeyDown(e)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-900 bg-white focus:border-emerald-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="quick_store_stock" className="block text-[11px] font-black text-slate-800 uppercase tracking-wider mb-1">
                    Opening Stock (Packs)
                  </label>
                  <input
                    id="quick_store_stock"
                    name="store_stock"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={quickForm.store_stock}
                    onChange={handleQuickChange}
                    onKeyDown={(e) => handleFormKeyDown(e)}
                    className="w-full border border-teal-300 rounded-xl px-3 py-2 text-xs font-black text-teal-900 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="quick_minimum_level" className="block text-[11px] font-black text-slate-800 uppercase tracking-wider mb-1">
                    Min Alert Level
                  </label>
                  <input
                    id="quick_minimum_level"
                    name="minimum_level"
                    type="number"
                    min="0"
                    value={quickForm.minimum_level}
                    onChange={handleQuickChange}
                    onKeyDown={(e) => handleFormKeyDown(e, true)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            {/* Registration Action Deck */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveSubTab("inventory")}
                className="px-5 py-2.5 rounded-2xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel &amp; Return to Inventory
              </button>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    handleQuickAdd(false);
                    setActiveSubTab("inventory");
                  }}
                  className="px-6 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">inventory_2</span>
                  Save &amp; View Stock List
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAdd(false)}
                  className="px-7 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-700/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  Save &amp; Register Next (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SUB-TAB 1: STORE INVENTORY CATALOG & STOCK DIRECTORY */
        <>
          {/* Location Scoped Incharge Notice */}
          {isLocationLocked && userAssignedWh && (
            <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-teal-900 text-white rounded-2xl p-4 sm:p-5 border border-teal-500/40 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 font-bold">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.75a1.5 1.5 0 011.5-1.5h1.5a1.5 1.5 0 011.5 1.5V21" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500 text-slate-950">
                      {userAssignedWh.code || "GDW"}
                    </span>
                    <h3 className="font-bold text-sm sm:text-base text-white">
                      Location Scoped: {userAssignedWh.nickname || userAssignedWh.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Logged in as <strong>{user?.name}</strong> • Stock scoped to this godown.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-teal-950/80 px-3 py-1.5 rounded-xl border border-teal-500/30 text-xs font-semibold text-teal-200">
                <svg className="w-3.5 h-3.5 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Isolated Godown Security</span>
              </div>
            </div>
          )}

          {/* BEGIN: MetricCardsRow */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4" data-purpose="kpi-metrics-cards">
            {/* KPI 1: Catalog SKUs */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-card-subtle flex flex-col justify-between hover:border-teal-500/50 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">Catalog SKUs</span>
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{metrics.totalItems.toLocaleString()}</div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{Math.max(0, uniqueCompanyNames.length - 1)} Manufacturing Brands</p>
              </div>
            </div>

            {/* KPI 2: Location Stock */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-card-subtle flex flex-col justify-between hover:border-teal-500/50 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">Location Stock</span>
                <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3.75h4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{metrics.totalStockUnits.toLocaleString()}</div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isLocationLocked
                    ? `Assigned: ${userAssignedWh?.nickname || "This Godown"}`
                    : effectiveLocationId === "all"
                    ? "Combined Store & Godown Units"
                    : `Assigned: ${currentWarehouseInfo?.nickname || "Selected Location"}`}
                </p>
              </div>
            </div>

            {/* KPI 3: Stock Valuation */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-card-subtle flex flex-col justify-between hover:border-teal-500/50 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">Stock Valuation</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6H2.25m0 0v10.5m0-10.5h19.5m0 0v10.5m0 0H2.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                {canViewFinancials ? (
                  <>
                    <div className="text-3xl font-extrabold text-slate-900 tracking-tight">Rs. {Math.round(metrics.totalValuationRetail).toLocaleString()}</div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Cost Asset: Rs. {Math.round(metrics.totalValuationCost).toLocaleString()}</p>
                  </>
                ) : (
                  <>
                    <div className="text-xl font-bold text-slate-400">Confidential</div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Doctor &amp; Owner Access Only</p>
                  </>
                )}
              </div>
            </div>

            {/* KPI 4: Reorder Alerts */}
            <div
              onClick={() => setStockStatusFilter(stockStatusFilter === "low" ? "all" : "low")}
              className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-card-subtle flex flex-col justify-between hover:border-rose-300 transition cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">Reorder Alerts</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-baseline space-x-3">
                <div>
                  <span className="text-2xl font-extrabold text-amber-600">{metrics.lowStockCount}</span>
                  <span className="text-xs text-slate-600 font-medium ml-1">Low Stock</span>
                </div>
                <span className="text-slate-300">|</span>
                <div>
                  <span className="text-2xl font-extrabold text-rose-600">{metrics.outOfStockCount}</span>
                  <span className="text-xs text-slate-600 font-medium ml-1">Out of Stock</span>
                </div>
              </div>
            </div>
          </section>
          {/* END: MetricCardsRow */}

          {/* BEGIN: FilterAndSearchToolbar */}
          <section className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-card-subtle space-y-3" data-purpose="catalog-filters">
            {/* Row 1: Search input + Brand filter + Stock status tabs + View toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              {/* Search bar with keyboard shortcut tag & clear action */}
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <input
                  id="medicineSearchInput"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search medicine name, company (BM, Paul Brooks, Schwabe...), formula, barcode..."
                  className="w-full pl-9 pr-16 py-2.5 text-xs sm:text-sm rounded-xl border-slate-200 bg-slate-50/70 placeholder-slate-400 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-slate-800 shadow-2xs transition-all"
                />
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center space-x-1.5">
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery("")}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/60 transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white text-slate-500 rounded border border-slate-200 shadow-2xs">/</kbd>
                </div>
              </div>

              {/* Controls right: Brand select & Status filter & View Switcher */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Brand Dropdown */}
                <div className="relative min-w-[140px] sm:min-w-[160px]">
                  <select
                    value={companyFilter}
                    onChange={(e) => {
                      setCompanyFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs font-semibold py-2.5 pl-3 pr-8 rounded-xl border-slate-200 bg-slate-50/70 hover:bg-white text-slate-700 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 focus:bg-white cursor-pointer shadow-2xs transition-all"
                  >
                    <option value="all">All Brands ({Math.max(0, uniqueCompanyNames.length - 1)})</option>
                    {uniqueCompanyNames.filter(c => c !== "all").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Stock Segment Filter */}
                <div className="inline-flex p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-medium text-slate-600 shadow-inner">
                  <button
                    type="button"
                    onClick={() => {
                      setStockStatusFilter("all");
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      stockStatusFilter === "all" ? "bg-teal-800 text-white shadow-sm" : "hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    <span>All Stock</span>
                    <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-md ${
                      stockStatusFilter === "all" ? "bg-teal-900/80 text-teal-200" : "bg-slate-200 text-slate-700"
                    }`}>
                      {inventory.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStockStatusFilter(stockStatusFilter === "low" ? "all" : "low");
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                      stockStatusFilter === "low" ? "bg-amber-500 text-white font-bold shadow-sm" : "hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    <span>Low</span>
                    <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-amber-50 border border-amber-200 text-amber-700 rounded-md">
                      {metrics.lowStockCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStockStatusFilter(stockStatusFilter === "out" ? "all" : "out");
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                      stockStatusFilter === "out" ? "bg-rose-500 text-white font-bold shadow-sm" : "hover:text-rose-700 hover:bg-white/80"
                    }`}
                  >
                    <span>Out</span>
                    <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-rose-50 border border-rose-200 text-rose-700 rounded-md">
                      {metrics.outOfStockCount}
                    </span>
                  </button>
                </div>

                {/* View Layout Switcher */}
                <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80">
                  <button
                    type="button"
                    aria-label="Table View"
                    title="Table View"
                    onClick={() => setViewMode("table")}
                    className={`p-1.5 rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                      viewMode === "table" ? "bg-white text-teal-800 shadow-2xs font-semibold" : "text-slate-400 hover:text-slate-700 hover:bg-white/60"
                    }`}
                  >
                    <svg className="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Grid View"
                    title="Grid View"
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                      viewMode === "grid" ? "bg-white text-teal-800 shadow-2xs font-semibold" : "text-slate-400 hover:text-slate-700 hover:bg-white/60"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Category Ribbon with Left/Right Scroll */}
            <div className="relative flex items-center pt-2.5 border-t border-slate-100">
              <button
                type="button"
                aria-label="Scroll categories left"
                onClick={() => scrollCategories("left")}
                className="shrink-0 mr-2 w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 flex items-center justify-center text-slate-500 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M15.75 19.5L8.25 12l7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div
                ref={categoryScrollRef}
                className="flex items-center space-x-2 overflow-x-auto no-scrollbar scroll-smooth py-1 flex-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`group whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm flex items-center space-x-1.5 transition-all shrink-0 cursor-pointer ${
                    categoryFilter === "all"
                      ? "bg-teal-800 text-white ring-1 ring-teal-700 hover:bg-teal-700"
                      : "bg-slate-50 hover:bg-slate-100/90 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-200 shadow-2xs"
                  }`}
                >
                  <span>All Categories</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
                    categoryFilter === "all" ? "bg-teal-900/90 text-teal-200" : "bg-slate-200 text-slate-700"
                  }`}>
                    {inventory.length}
                  </span>
                </button>

                {allCategories.length === 0 ? (
                  <div className="flex items-center gap-2 pl-2">
                    <span className="text-[11px] text-slate-400 font-medium italic">No custom categories yet.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubTab("register");
                        setShowAddCategoryInput(true);
                      }}
                      className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      <span>+ Add Category</span>
                    </button>
                  </div>
                ) : (
                  allCategories.map((cat) => {
                    const isActive = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategoryFilter(cat);
                          setCurrentPage(1);
                        }}
                        className={`group whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                          isActive
                            ? "bg-teal-800 text-white font-bold ring-1 ring-teal-700 shadow-sm"
                            : "bg-slate-50 hover:bg-slate-100/90 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-200 shadow-2xs"
                        }`}
                      >
                        <span>{cat}</span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-300" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                aria-label="Scroll categories right"
                onClick={() => scrollCategories("right")}
                className="shrink-0 ml-2 w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 flex items-center justify-center text-slate-500 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </section>
          {/* END: FilterAndSearchToolbar */}

          {/* BEGIN: MainContentArea */}
          {filteredInventory.length === 0 ? (
            /* Empty State */
            <section className="bg-white rounded-2xl border border-slate-200/90 shadow-card-subtle min-h-[380px] sm:min-h-[440px] flex flex-col items-center justify-center p-6 sm:p-12 text-center" data-purpose="inventory-empty-state">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-teal-50 border-2 border-teal-100 flex items-center justify-center text-teal-700 shadow-inner">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 text-teal-600" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-500 text-white shadow-md ring-2 ring-white">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>

              <h2 className="mt-6 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {searchQuery ? "No matching medicines found" : "Your Medicine Catalog is Ready to Setup"}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                {searchQuery
                  ? `No medicines match "${searchQuery}". Check spelling or reset active filters.`
                  : "Populate catalog instantly via bulk Excel/CSV upload or register new medicines using the rapid entry form."}
              </p>

              <div className="mt-6 flex flex-col xs:flex-row items-center justify-center gap-3 w-full max-w-xs sm:max-w-md">
                {!searchQuery ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCsvModal(true)}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Bulk CSV Upload</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubTab("register");
                        setTimeout(() => quickNameRef.current?.focus(), 100);
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-semibold text-xs sm:text-sm shadow-md shadow-teal-800/20 transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Manual Fast Form</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCategoryFilter("all");
                      setCompanyFilter("all");
                      setStockStatusFilter("all");
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                  >
                    <span>Clear Search &amp; Filters</span>
                  </button>
                )}
              </div>

              <div className="mt-8 inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200/80">
                <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 18v-5.25m0 0a6.002 6.002 0 00-4-5.659V5a2 2 0 114 0v2.091A6.002 6.002 0 0012 12.75zm0 0v5.25" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Tip: You can press <kbd className="px-1 py-0.5 font-mono text-[10px] bg-white rounded border border-slate-300">F1</kbd> anytime to jump to Rapid Medicine Search</span>
              </div>
            </section>
          ) : viewMode === "table" ? (
            /* Corporate Clean Table View */
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-card-subtle overflow-hidden flex flex-col">
              {/* Bulk Actions Header */}
              {selectedItems.size > 0 && (
                <div className="bg-teal-50 border-b border-teal-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                    {selectedItems.size} item{selectedItems.size > 1 ? "s" : ""} selected
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleOpenBulkUpdate}
                      className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm">bolt</span>
                      <span>⚡ Bulk Stock &amp; Price Update ({selectedItems.size})</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      <span>Delete ({selectedItems.size})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedItems(new Set())}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto custom-scroll">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={paginatedInventory.length > 0 && selectedItems.size === paginatedInventory.length}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 accent-teal-600 rounded cursor-pointer"
                          title="Select All"
                        />
                      </th>
                      <th className="py-3 px-2 text-center w-10 text-slate-400">#</th>
                      <th className="py-3 px-4">Medicine Name &amp; Description</th>
                      <th className="py-3 px-3 text-center">Packing</th>
                      <th className="py-3 px-3">Company</th>
                      <th className="py-3 px-3 text-center">Category</th>
                      <th className="py-3 px-3 text-center">Code</th>
                      <th className="py-3 px-3 text-center text-teal-800">Store Stock</th>
                      <th className="py-3 px-3 text-right">Net Price</th>
                      <th className="py-3 px-3 text-right text-emerald-800">Rate (Retail)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {paginatedInventory.map((item, idx) => {
                      const itemIndex = (currentPage - 1) * effectivePageSize + idx + 1;
                      const low = isLowStock(item);
                      const out = isOutOfStock(item);
                      const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || item.sale_price || 0);
                      const cost = Number(item.cost_price_per_box || item.purchase_price || item.cost_price || (sale * 0.7));
                      const totalStock = getItemLocationStock(item);
                      const isSelected = selectedItems.has(item.id);

                      return (
                        <tr
                          key={item.id}
                          id={`inv-row-${item.id}`}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? "bg-teal-50/50" : out ? "bg-rose-50/30" : low ? "bg-amber-50/30" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item.id)}
                              className="w-3.5 h-3.5 accent-teal-600 rounded cursor-pointer"
                            />
                          </td>

                          {/* Row # */}
                          <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[10px] font-bold">
                            {itemIndex}
                          </td>

                          {/* Name + Description */}
                          <td className="py-2.5 px-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs">{item.medicine_name}</span>
                                {out && <span className="text-rose-600 text-[10px] font-bold">[0]</span>}
                                {low && !out && <span className="text-amber-600 text-[10px] font-bold">[{totalStock}]</span>}
                              </div>
                              {(item.product_description || item.generic_name || item.naration) && (
                                <span className="text-slate-500 text-[11px] font-normal line-clamp-1">
                                  {item.product_description || item.generic_name || item.naration}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Packing */}
                          <td className="py-2.5 px-3 text-center">
                            {item.packing || item.unit_label ? (
                              <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 font-mono text-[11px] font-extrabold whitespace-nowrap">
                                {item.packing || item.unit_label}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Company */}
                          <td className="py-2.5 px-3 text-slate-700 font-semibold text-[11px]">
                            {item.company_name || "—"}
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-slate-600 text-[11px]">
                              {item.category || "—"}
                            </span>
                          </td>

                          {/* Code */}
                          <td className="py-2.5 px-3 text-center font-mono text-[10px] font-bold text-emerald-800">
                            {item.item_code || "—"}
                          </td>

                          {/* Store Stock */}
                          <td className={`py-2.5 px-3 text-center font-bold text-xs ${out ? "text-rose-600" : low ? "text-amber-700" : "text-slate-900"}`}>
                            {totalStock} {item.box_label || "Packs"}
                          </td>

                          {/* Cost */}
                          <td className="py-2.5 px-3 text-right font-medium text-slate-500 text-[11px]">
                            {canViewFinancials ? `Rs. ${cost.toLocaleString()}` : "—"}
                          </td>

                          {/* Sale */}
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-800 text-xs">
                            Rs. {sale.toLocaleString()}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRequestEdit(item)}
                                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-600 text-[11px] font-semibold transition-all cursor-pointer"
                                title="Edit"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLedgerInitialItem(item);
                                  setShowStockLedgerModal(true);
                                }}
                                className="px-2 py-1 rounded-md bg-teal-50 hover:bg-teal-700 hover:text-white text-teal-700 text-[11px] font-semibold transition-all cursor-pointer"
                                title="Ledger"
                              >
                                Ledger
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDelete(item)}
                                className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 text-[11px] font-semibold transition-all cursor-pointer"
                                title="Delete"
                              >
                                Del
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
            /* Cards Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedInventory.map((item) => {
                const low = isLowStock(item);
                const out = isOutOfStock(item);
                const base = getItemLocationStock(item);
                const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || 0);
                const cost = Number(item.cost_price_per_box || item.purchase_price || (sale * 0.7));

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl p-4 border shadow-card-subtle hover:shadow-md transition-all space-y-3 flex flex-col justify-between ${
                      out ? "border-rose-200 bg-rose-50/10" : low ? "border-amber-200 bg-amber-50/10" : "border-slate-200/90"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs leading-tight">
                              {item.medicine_name}
                            </h4>
                            {(item.product_description || item.generic_name || item.naration) && (
                              <p className="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5">
                                {item.product_description || item.generic_name || item.naration}
                              </p>
                            )}
                            {item.company_name ? (
                              <div className="text-[11px] font-semibold text-teal-800 mt-0.5">
                                {item.company_name}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {out ? (
                          <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Out
                          </span>
                        ) : low ? (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Low ({base})
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-semibold">
                        {(item.packing || item.unit_label) && (
                          <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md font-mono font-black">
                            {item.packing || item.unit_label}
                          </span>
                        )}
                        {item.category && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                            {item.category}
                          </span>
                        )}
                        {item.item_code && (
                          <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-mono">
                            {item.item_code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/80 space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Stock:</span>
                        <span className="font-bold text-slate-900">
                          {isLocationLocked
                            ? `${base} Units (${userAssignedWh?.nickname || "Godown"})`
                            : effectiveLocationId === "all"
                            ? formatStockBreakdown(item)
                            : `${base} Units`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Price:</span>
                        <span className="font-bold text-emerald-800">{formatCurrency(sale)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500 font-medium">Cost:</span>
                        <span className="font-medium text-slate-600">
                          {canViewFinancials ? `Rs. ${cost.toLocaleString()}` : "Confidential"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRequestEdit(item)}
                        className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Edit Item"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerInitialItem(item);
                          setShowStockLedgerModal(true);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-700 hover:text-white text-teal-800 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Stock Ledger"
                      >
                        Ledger
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMovementItem(item);
                          setIsMovementOpen(true);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Stock Card"
                      >
                        Card
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestDelete(item)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-xs font-bold transition-all cursor-pointer"
                        title="Delete Item"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* END: MainContentArea */}

          {/* BEGIN: BottomStatusBar */}
          <footer className="bg-white rounded-xl px-4 py-3 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600" data-purpose="table-footer-status">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-slate-800">
                Showing <strong className="text-teal-900 font-bold">{paginatedInventory.length}</strong> of <strong className="text-teal-900 font-bold">{filteredInventory.length}</strong> medicines
              </span>
              <span className="text-slate-300 hidden xs:inline">•</span>
              <span className="text-[11px] text-slate-400 hidden xs:inline">
                {searchQuery || categoryFilter !== "all" || companyFilter !== "all" || stockStatusFilter !== "all"
                  ? "Filters active"
                  : "No filters active"}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <label className="text-xs font-medium text-slate-500" htmlFor="displayLimit">Display Limit:</label>
                <select
                  id="displayLimit"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs font-semibold py-1 pl-2.5 pr-7 rounded-md border-slate-300 bg-slate-50 text-slate-700 focus:border-teal-600 focus:ring-teal-600 cursor-pointer"
                >
                  <option value="all">All ({filteredInventory.length})</option>
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
              </div>

              {pageSize !== "all" && totalPages > 1 ? (
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    aria-label="Previous Page"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M15.75 19.5L8.25 12l7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <span className="px-2 py-0.5 font-bold text-[11px] text-slate-700 bg-slate-100 rounded">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    aria-label="Next Page"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
          </footer>
          {/* END: BottomStatusBar */}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DrCreate / Access "INVENTORY _LIST" Popup Modal                 */}
      {/* ========================================================================= */}
      {showInventoryListModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInventoryListModal(false);
          }}
        >
          <div
            className="bg-white max-w-3xl w-full rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col h-[85vh] max-h-[700px] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 border border-emerald-500/30">
                  <span className="material-symbols-outlined text-xl">inventory_2</span>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wide text-white">Stock Inventory Sheet</h3>
                  <p className="text-xs text-emerald-200/90 font-medium">Showing {modalFilteredItems.length} Products</p>
                </div>
              </div>
              <button
                onClick={() => setShowInventoryListModal(false)}
                className="text-slate-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center shrink-0">
              <div className="sm:col-span-3 text-xs font-black text-slate-900 uppercase tracking-wider">
                Filter Company:
              </div>
              <div className="sm:col-span-9 flex items-center gap-2">
                <select
                  value={modalCategoryFilter}
                  onChange={(e) => setModalCategoryFilter(e.target.value)}
                  className="border-2 border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black bg-white text-slate-900 w-1/2 focus:outline-none focus:border-teal-600 shadow-xs"
                >
                  {uniqueCompanyNames.map((comp) => (
                    <option key={comp} value={comp} className="text-slate-900 font-bold">
                      {comp === "All" || comp === "all" ? "🏢 All Companies" : `🏢 ${comp}`}
                    </option>
                  ))}
                </select>
                <div className="relative w-1/2">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
                  <input
                    type="text"
                    placeholder="Search medicine name, code..."
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-teal-600 shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 p-3 min-h-0 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-black uppercase text-[11px] sticky top-0 shadow-md">
                  <tr>
                    <th className="p-3 border-b border-slate-700">Item Particulars</th>
                    <th className="p-3 border-b border-slate-700 text-center">Company / Code</th>
                    <th className="p-3 border-b border-slate-700 text-right">Live Stock Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-semibold bg-white text-slate-900">
                  {modalFilteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center py-12 text-slate-700 font-bold">
                        No products found under &quot;{modalCategoryFilter}&quot;.
                      </td>
                    </tr>
                  ) : (
                    modalFilteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-teal-50/60 transition-colors">
                        <td className="p-3 font-black text-slate-900 text-xs">
                          {item.medicine_name}
                          {item.packing && (
                            <span className="block text-[11px] font-bold text-slate-700">{item.packing}</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-slate-900">{item.company_name || "General"}</span>
                          {item.item_code && (
                            <span className="block font-mono text-teal-950 font-black text-[10.5px]">[{item.item_code}]</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-slate-950 text-sm">
                          {item.total_base_stock ?? item.stock_qty ?? 0}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-300 flex justify-between items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => printInventoryListReceipt(modalFilteredItems, modalCategoryFilter, dbClinic.get())}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>Print Stock Receipt</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportModalList(modalFilteredItems, `inventory_list_${modalCategoryFilter}.csv`)}
                className="px-5 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
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
          className="fixed inset-0 z-[999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPricingListModal(false);
          }}
        >
          <div
            className="bg-white max-w-4xl w-full rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col h-[85vh] max-h-[720px] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 flex items-center justify-center text-teal-300 border border-teal-500/30">
                  <span className="material-symbols-outlined text-xl">sell</span>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wide text-white">Product Pricing &amp; Margin Sheet</h3>
                  <p className="text-xs text-teal-200/90 font-medium">Showing {modalFilteredItems.length} Products with Sale &amp; Cost Rates</p>
                </div>
              </div>
              <button
                onClick={() => setShowPricingListModal(false)}
                className="text-slate-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center shrink-0">
              <div className="sm:col-span-3 text-xs font-black text-slate-900 uppercase tracking-wider">
                Filter Company:
              </div>
              <div className="sm:col-span-9 flex items-center gap-2">
                <select
                  value={modalCategoryFilter}
                  onChange={(e) => setModalCategoryFilter(e.target.value)}
                  className="border-2 border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black bg-white text-slate-900 w-1/2 focus:outline-none focus:border-teal-600 shadow-xs"
                >
                  {uniqueCompanyNames.map((comp) => (
                    <option key={comp} value={comp} className="text-slate-900 font-bold">
                      {comp === "All" || comp === "all" ? "🏢 All Companies" : `🏢 ${comp}`}
                    </option>
                  ))}
                </select>
                <div className="relative w-1/2">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
                  <input
                    type="text"
                    placeholder="Search product, naration, code..."
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-teal-600 shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 p-3 min-h-0 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-black uppercase text-[11px] sticky top-0 shadow-md">
                  <tr>
                    <th className="p-3 border-b border-slate-700">Product Particulars</th>
                    <th className="p-3 border-b border-slate-700 text-center">Company / Code</th>
                    <th className="p-3 border-b border-slate-700">Naration / Form</th>
                    <th className="p-3 border-b border-slate-700 text-center">Stock</th>
                    <th className="p-3 border-b border-slate-700 text-right">Retail Price</th>
                    <th className="p-3 border-b border-slate-700 text-right">Purchase Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-semibold bg-white text-slate-900">
                  {modalFilteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-slate-700 font-bold">
                        No pricing records found under this filter.
                      </td>
                    </tr>
                  ) : (
                    modalFilteredItems.map((item) => {
                      const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || 0);
                      const cost = Number(item.cost_price_per_box || item.purchase_price || (sale * 0.7));
                      return (
                        <tr key={item.id} className="hover:bg-teal-50/60 transition-colors">
                          <td className="p-3 font-black text-slate-900 text-xs">{item.medicine_name}</td>
                          <td className="p-3 text-center">
                            <span className="font-bold text-slate-900">{item.company_name || "General"}</span>
                            {item.item_code && (
                              <span className="block font-mono text-teal-950 font-black text-[10.5px]">[{item.item_code}]</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-800 font-bold text-[11px]">{item.generic_name || item.packing || item.category || "-"}</td>
                          <td className="p-3 text-center font-black text-slate-900">{item.total_base_stock ?? item.stock_qty ?? 0}</td>
                          <td className="p-3 text-right font-black text-emerald-950 text-xs">Rs. {sale.toLocaleString()}</td>
                          <td className="p-3 text-right font-black text-slate-900 text-xs">Rs. {cost.toLocaleString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-300 flex justify-between items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => printProductPricingListReceipt(modalFilteredItems, modalCategoryFilter, dbClinic.get())}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>Print Pricing List</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportModalList(modalFilteredItems, `pricing_list_${modalCategoryFilter}.csv`)}
                className="px-5 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
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
            className="bg-white max-w-6xl w-full rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-8 space-y-5 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                  <span className="material-symbols-outlined text-2xl">upload_file</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg">Bulk Excel / CSV Medicine Upload</h3>
                  <p className="text-xs text-slate-500">Full responsive window with live inline editing &amp; auto company registration</p>
                </div>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Template Download Prompt */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-sky-50/70 p-4 rounded-2xl border border-sky-200 gap-3 shrink-0">
              <div className="text-xs text-sky-950 font-semibold">
                Download the standardized CSV template with required column schema:
              </div>
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Download Template</span>
              </button>
            </div>

            {/* File Upload Area */}
            <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-3xl p-5 text-center space-y-2 bg-slate-50/50 transition-colors shrink-0">
              <span className="material-symbols-outlined text-3xl text-slate-400">csv</span>
              <div className="text-xs text-slate-700 font-bold">
                {csvFileName ? `Selected File: ${csvFileName}` : "Click to select or drag & drop CSV file here"}
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileSelected}
                className="text-xs cursor-pointer file:mr-3 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-100 file:text-sky-800 hover:file:bg-sky-200"
              />
            </div>

            {/* Live Table Preview with Full Responsive Scroll & Inline Edit */}
            {csvParsedRows.length > 0 && (
              <div className="space-y-2.5 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex flex-wrap justify-between items-center text-xs font-bold text-slate-800 gap-2 shrink-0">
                  <span className="text-teal-950 font-black">
                    Showing All {csvParsedRows.length} Items (Click any cell to edit before importing):
                  </span>
                  <span className="text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full text-xs font-black border border-emerald-200">
                    Schema Validated • Auto Company Linkage Active ✅
                  </span>
                </div>
                
                <div className="overflow-x-auto overflow-y-auto border border-slate-200 rounded-2xl flex-1 text-xs">
                  <table className="w-full text-left min-w-[900px]">
                    <thead className="bg-slate-100 font-black text-slate-700 sticky top-0 z-10 uppercase text-[10.5px]">
                      <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">Medicine Name *</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Packing</th>
                        <th className="p-3">Company / Brand *</th>
                        <th className="p-3 w-28 text-right">Cost (Rs)</th>
                        <th className="p-3 w-28 text-right">Retail Sale (Rs) *</th>
                        <th className="p-3 w-24 text-right">Stock Qty *</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {csvParsedRows.map((r, i) => (
                        <tr key={i} className="hover:bg-sky-50/50 transition-colors">
                          <td className="p-2 text-center text-slate-400 font-mono text-[11px]">{i + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={r.medicine_name || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCsvParsedRows((prev) => prev.map((row, idx) => idx === i ? { ...row, medicine_name: val } : row));
                              }}
                              className="w-full bg-white border border-slate-200 focus:border-teal-600 focus:bg-white rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={r.product_description || r.generic_name || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCsvParsedRows((prev) => prev.map((row, idx) => idx === i ? { ...row, product_description: val, generic_name: val } : row));
                              }}
                              placeholder="Description..."
                              className="w-full bg-white border border-slate-200 focus:border-teal-600 focus:bg-white rounded-lg px-2 py-1 text-xs text-slate-700"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={r.packing || r.unit_label || ""}
                              list="packingSuggestionsCsv"
                              onChange={(e) => {
                                const val = e.target.value;
                                setCsvParsedRows((prev) => prev.map((row, idx) => idx === i ? { ...row, packing: val, unit_label: val } : row));
                              }}
                              placeholder="e.g. 60 TABS, 30 ML..."
                              className="w-full bg-white border border-teal-200 focus:border-teal-600 focus:bg-white rounded-lg px-2 py-1 text-xs font-bold text-slate-800 uppercase"
                            />
                            <datalist id="packingSuggestionsCsv">
                              <option value="30 ML" />
                              <option value="60 TABS" />
                              <option value="40 TABS" />
                              <option value="45 TABS" />
                              <option value="90 TABS" />
                              <option value="90 ML" />
                              <option value="250 ML" />
                              <option value="1000 ML" />
                              <option value="60 CAPS" />
                              <option value="350 GMS" />
                              <option value="100 GMS" />
                              <option value="30 ML / 60 TABS" />
                              <option value="Course" />
                            </datalist>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={r.company_name || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCsvParsedRows((prev) => prev.map((row, idx) => idx === i ? { ...row, company_name: val } : row));
                              }}
                              className="w-full bg-white border border-slate-200 focus:border-teal-600 focus:bg-white rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={r.cost_price_per_box ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setCsvParsedRows((prev) => prev.map((row, idx) => idx === i ? { ...row, cost_price_per_box: val, purchase_price: val, cost_price: val } : row));
                              }}
                              className="w-full bg-white border border-slate-200 focus:border-teal-600 focus:bg-white rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 text-right"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={r.unit_sale_price ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setCsvParsedRows((prev) => prev.map((row, idx) => idx === i ? { ...row, unit_sale_price: val, box_sale_price: val, unit_price: val } : row));
                              }}
                              className="w-full bg-white border border-teal-300 focus:border-teal-600 focus:bg-white rounded-lg px-2 py-1 text-xs font-mono font-black text-teal-900 text-right"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={r.total_base_stock ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setCsvParsedRows((prev) => prev.map((row, idx) => idx === i ? { ...row, total_base_stock: val, store_stock: val, stock_qty: val } : row));
                              }}
                              className="w-full bg-white border border-slate-200 focus:border-teal-600 focus:bg-white rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 text-right"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {csvImportStatus.error && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-3 rounded-xl border border-rose-200 shrink-0">
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <span className="material-symbols-outlined text-2xl">fact_check</span>
                </div>
                <div>
                  <h2 className="text-base font-black flex items-center gap-2 text-white">
                    <span>Zero-Pilferage Blind Physical Stock Audit</span>
                    <span className="text-[10px] bg-teal-500/30 text-teal-200 px-2.5 py-0.5 rounded-full font-black border border-teal-400/30">Anti-Theft Protocol</span>
                  </h2>
                  <p className="text-xs text-teal-200/90 mt-0.5 font-medium">
                    Count physical units on shelves without bias. The system compares physical counts against live software balances.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBlindAuditModal(false)}
                className="text-slate-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="p-4 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
                {/* Company Filter Dropdown */}
                <div className="w-1/3 min-w-[180px]">
                  <select
                    value={auditCompanyFilter}
                    onChange={(e) => setAuditCompanyFilter(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-black bg-white text-slate-900 focus:outline-none focus:border-teal-600 shadow-xs cursor-pointer"
                  >
                    {uniqueCompanyNames.map((comp) => (
                      <option key={comp} value={comp} className="text-slate-900 font-bold">
                        {comp === "All" || comp === "all" ? "🏢 All Companies" : `🏢 ${comp}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Box */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base">search</span>
                  <input
                    type="text"
                    placeholder="Search medicine by name or code..."
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border-2 border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-teal-600 shadow-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printBlindStockAuditSheet(auditFilteredItems, auditCompanyFilter, dbClinic.get())}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  <span>Print Count Sheet</span>
                </button>
              </div>
            </div>

            {/* Audit Table */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 text-white font-black text-xs uppercase border-b border-slate-700 shadow-md">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Medicine Particulars</th>
                    <th className="p-3">Company</th>
                    <th className="p-3 text-center w-36">Physical Count (Shelf)</th>
                    <th className="p-3 text-right w-28">System Stock</th>
                    <th className="p-3 text-right">Variance / Audit Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-900 font-semibold">
                  {auditFilteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-slate-700 font-bold">
                        No medicines found under company &quot;{auditCompanyFilter}&quot;.
                      </td>
                    </tr>
                  ) : (
                    auditFilteredItems.map((item, index) => {
                      const sysStock = Number(item.store_stock ?? item.total_base_stock ?? 0);
                      const physicalEntered = auditCounts[item.id] !== undefined && auditCounts[item.id] !== ""
                        ? Number(auditCounts[item.id])
                        : null;
                      const diff = physicalEntered !== null ? physicalEntered - sysStock : null;

                      return (
                        <tr key={item.id} className="hover:bg-teal-50/60 transition-colors">
                          <td className="p-3 text-center font-mono font-black text-slate-900">{index + 1}</td>
                          <td className="p-3 font-black text-slate-900 text-xs">
                            {item.medicine_name}
                            <span className="ml-1 text-[11px] text-slate-700 font-bold">({item.item_code || "GEN"})</span>
                            {item.packing && (
                              <span className="block text-[11px] font-bold text-slate-600">{item.packing}</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-900 font-bold">{item.company_name || "General"}</td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="0"
                              placeholder="Count..."
                              value={auditCounts[item.id] ?? ""}
                              onChange={(e) => setAuditCounts({ ...auditCounts, [item.id]: e.target.value })}
                              className="w-28 px-2 py-1.5 text-center font-black text-sm text-slate-950 rounded-xl border-2 border-slate-300 focus:border-teal-600 focus:outline-none bg-white shadow-xs"
                            />
                          </td>
                          <td className="p-3 text-right font-black text-slate-950 text-sm">{sysStock}</td>
                          <td className="p-3 text-right font-black">
                            {diff === null ? (
                              <span className="text-slate-600 text-xs font-bold italic">Not Counted</span>
                            ) : diff === 0 ? (
                              <span className="text-emerald-950 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg text-xs font-black">
                                Match (0) ✅
                              </span>
                            ) : diff < 0 ? (
                              <span className="text-rose-950 bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-lg text-xs font-black">
                                Shortage: {diff} (Loss: Rs. {Math.abs(diff * (item.unit_sale_price || item.sale_price || 0)).toLocaleString()}) 🚨
                              </span>
                            ) : (
                              <span className="text-sky-950 bg-sky-100 border border-sky-300 px-2.5 py-1 rounded-lg text-xs font-black">
                                Surplus: +{diff} 📦
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="p-4 bg-slate-100 border-t border-slate-300 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-900 font-black">
                Audited items: <strong className="text-teal-900 text-sm">{Object.keys(auditCounts).filter((k) => auditCounts[k] !== "").length}</strong> of {auditFilteredItems.length}
              </div>
              <button
                type="button"
                onClick={() => {
                  alert("Physical count verified and logged in cyclic audit register.");
                  setShowBlindAuditModal(false);
                }}
                className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
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
            <form onSubmit={handleSaveEdit} data-form-container="edit-medicine-form" className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
                    onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
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
                    onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-bold text-slate-900"
                    placeholder="e.g. BM, SCH, or Company Name"
                  />
                </div>

                {/* Packing / Unit Size */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Packing / Size</span>
                    <span className="text-[10px] text-teal-700 font-mono font-bold">60 TABS, 30 ML</span>
                  </label>
                  <input
                    type="text"
                    list="packingSuggestionsEdit"
                    value={editFormData.packing}
                    onChange={(e) => setEditFormData({ ...editFormData, packing: e.target.value })}
                    onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
                    className="w-full px-3.5 py-2 rounded-xl border border-teal-300 bg-teal-50/20 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-bold text-slate-900 uppercase"
                    placeholder="e.g. 60 TABS, 30 ML, 1000 ML..."
                  />
                  <datalist id="packingSuggestionsEdit">
                    <option value="30 ML" />
                    <option value="60 TABS" />
                    <option value="40 TABS" />
                    <option value="45 TABS" />
                    <option value="90 TABS" />
                    <option value="90 ML" />
                    <option value="250 ML" />
                    <option value="1000 ML" />
                    <option value="60 CAPS" />
                    <option value="350 GMS" />
                    <option value="100 GMS" />
                    <option value="30 ML / 60 TABS" />
                    <option value="Course" />
                  </datalist>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-bold text-slate-900"
                  >
                    <option value="">-- Select Category (Optional) --</option>
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
                    onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
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
                    onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
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
                      onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
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
                      onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
                      className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-black font-mono text-emerald-900"
                    />
                  </div>
                </div>

                {/* Stock Counts Box with Dynamic Registered Warehouses Breakdown */}
                <div className="sm:col-span-2 bg-teal-50/60 p-4 rounded-2xl border border-teal-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-teal-950 uppercase tracking-wider">
                      Store Counter
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.store_stock}
                      onChange={(e) => setEditFormData({ ...editFormData, store_stock: e.target.value })}
                      onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
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
                        <label className={`text-[11px] font-bold uppercase tracking-wider ${colorClasses.label}`}>
                          {wh.name}
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
                          onKeyDown={(e) => handleFormKeyDown(e, false, handleSaveEdit)}
                          className={`w-full px-3 py-1.5 rounded-xl border bg-white font-mono font-bold text-xs text-slate-900 focus:ring-2 focus:outline-none ${colorClasses.border} ${colorClasses.ring}`}
                        />
                      </div>
                    );
                  })}

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-950 uppercase tracking-wider">
                      Low Stock Alert
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.low_stock_threshold}
                      onChange={(e) => setEditFormData({ ...editFormData, low_stock_threshold: e.target.value })}
                      onKeyDown={(e) => handleFormKeyDown(e, true, handleSaveEdit)}
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

      {/* 4. Quick Bulk Stock & Price Update Spreadsheet Modal */}
      {showBulkUpdateModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl border border-teal-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 text-teal-200 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">bolt</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                    <span>1-Click Bulk Stock &amp; Price Update</span>
                    <span className="text-xs bg-teal-500/30 text-teal-200 px-2.5 py-0.5 rounded-full border border-teal-400/30 font-mono">
                      {bulkUpdateItems.length} Items Selected
                    </span>
                  </h3>
                  <p className="text-[11px] text-teal-200">
                    Fast spreadsheet entry — update Stock Qty, Cost Price &amp; Retail Rate for multiple medicines in 1 click
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkUpdateModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-teal-200 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Quick Batch Tools Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 shrink-0 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-black text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1 shrink-0">
                <span className="material-symbols-outlined text-sm text-teal-700">auto_fix_high</span>
                <span>Batch Apply To All:</span>
              </span>

              {/* Set Stock */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-slate-600 font-bold text-[11px]">Set Stock:</span>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 50"
                  value={batchUniformStock}
                  onChange={(e) => setBatchUniformStock(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyBatchStock(e);
                    }
                  }}
                  className="w-16 text-center font-bold text-slate-800 outline-none text-xs"
                />
                <button
                  type="button"
                  onClick={handleApplyBatchStock}
                  className="px-2 py-0.5 bg-teal-700 hover:bg-teal-800 active:scale-95 transition-all text-white rounded-lg font-bold text-[10px] cursor-pointer"
                >
                  Apply
                </button>
              </div>

              {/* Add +Qty */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-slate-600 font-bold text-[11px]">Add +Qty:</span>
                <input
                  type="number"
                  placeholder="+10"
                  value={batchAddQty}
                  onChange={(e) => setBatchAddQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyBatchAddQty(e);
                    }
                  }}
                  className="w-14 text-center font-bold text-slate-800 outline-none text-xs"
                />
                <button
                  type="button"
                  onClick={handleApplyBatchAddQty}
                  className="px-2 py-0.5 bg-teal-700 hover:bg-teal-800 active:scale-95 transition-all text-white rounded-lg font-bold text-[10px] cursor-pointer"
                >
                  Add +
                </button>
              </div>

              {/* Set Cost Price */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-slate-600 font-bold text-[11px]">Cost:</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Rs."
                  value={batchUniformCost}
                  onChange={(e) => setBatchUniformCost(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyBatchCost(e);
                    }
                  }}
                  className="w-16 text-center font-bold text-slate-800 outline-none text-xs"
                />
                <button
                  type="button"
                  onClick={handleApplyBatchCost}
                  className="px-2 py-0.5 bg-teal-700 hover:bg-teal-800 active:scale-95 transition-all text-white rounded-lg font-bold text-[10px] cursor-pointer"
                >
                  Apply
                </button>
              </div>

              {/* Set Retail Rate */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-slate-600 font-bold text-[11px]">Retail:</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Rs."
                  value={batchUniformSale}
                  onChange={(e) => setBatchUniformSale(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyBatchSale(e);
                    }
                  }}
                  className="w-16 text-center font-bold text-slate-800 outline-none text-xs"
                />
                <button
                  type="button"
                  onClick={handleApplyBatchSale}
                  className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 transition-all text-white rounded-lg font-bold text-[10px] cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Editable Spreadsheet Table */}
            <div className="flex-1 overflow-y-auto custom-scroll p-4">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-100 sticky top-0 z-10 text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-10">#</th>
                    <th className="py-2.5 px-3">Medicine Name &amp; Description</th>
                    <th className="py-2.5 px-2.5 text-center">Company</th>
                    <th className="py-2.5 px-2.5 text-center">Code</th>
                    <th className="py-2.5 px-3 text-center">Current</th>
                    <th className="py-2.5 px-3 text-center w-28 bg-teal-50/70 text-teal-900 border-x border-teal-200">
                      New Stock Qty
                    </th>
                    <th className="py-2.5 px-3 text-center w-28 bg-slate-50">
                      Cost Price (Rs.)
                    </th>
                    <th className="py-2.5 px-3 text-center w-32 bg-emerald-50/70 text-emerald-900 border-l border-emerald-200">
                      Retail Rate (Rs.)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {bulkUpdateItems.map((row, idx) => {
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2 text-center text-slate-400 font-mono text-[10px] font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{row.medicine_name}</div>
                          {row.product_description && (
                            <div className="text-[11px] text-amber-900 font-semibold mt-0.5">
                              — {row.product_description}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-center text-[11px] font-bold text-slate-600">
                          {row.company_name || "—"}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono text-[10px] font-bold text-emerald-800">
                          {row.item_code || "—"}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                            {row.current_stock}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center bg-teal-50/40 border-x border-teal-100">
                          <input
                            type="number"
                            min="0"
                            value={row.new_stock}
                            onChange={(e) => handleBulkItemChange(row.id, "new_stock", e.target.value)}
                            className="w-full h-8 text-center bg-white border border-teal-300 rounded-lg font-black text-xs text-teal-950 focus:border-teal-600 focus:ring-1 focus:ring-teal-500 outline-none shadow-2xs"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center bg-slate-50/40">
                          <input
                            type="number"
                            min="0"
                            value={row.new_cost}
                            onChange={(e) => handleBulkItemChange(row.id, "new_cost", e.target.value)}
                            className="w-full h-8 text-center bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800 focus:border-teal-600 focus:ring-1 focus:ring-teal-500 outline-none shadow-2xs"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center bg-emerald-50/40 border-l border-emerald-100">
                          <input
                            type="number"
                            min="0"
                            value={row.new_sale}
                            onChange={(e) => handleBulkItemChange(row.id, "new_sale", e.target.value)}
                            className="w-full h-8 text-center bg-white border border-emerald-400 rounded-lg font-black text-xs text-emerald-950 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none shadow-2xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                Editing <strong className="text-slate-800">{bulkUpdateItems.length}</strong> selected medicines for instant 1-click update
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkUpdateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBulkUpdate}
                  className="px-6 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-xs shadow-md shadow-teal-900/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Save All ({bulkUpdateItems.length}) Changes (1-Click)</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
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
