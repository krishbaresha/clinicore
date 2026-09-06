import { useState, useMemo, useEffect } from "react";
import {
  dbAuditLogs,
  dbUsers,
  dbSales,
  dbVisits,
  dbPatients,
  dbStockMovements,
} from "../api/db.js";
import { escapeCSV } from "../utils/formatters.js";
import {
  ShieldAlert,
  Users,
  CreditCard,
  Percent,
  PackageMinus,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  DollarSign,
  ShoppingCart,
  Package,
} from "lucide-react";
import { printExecutiveAuditReceipt, printExecutiveAuditDocument } from "../utils/thermalPrinter.js";

export default function GodAdminPanel() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [sales, setSales] = useState([]);
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [users, setUsers] = useState([]);

  // Filters
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'registrations' | 'sales' | 'purchases' | 'inventory' | 'discounts' | 'writeoffs'
  const [searchQuery, setSearchQuery] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30_days"); // 'today' | 'yesterday' | '7_days' | '30_days' | 'this_month' | 'custom' | 'all'
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().split("T")[0]);
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [displayLimit, setDisplayLimit] = useState("all"); // '50' | '100' | '250' | '500' | 'all'

  const refreshData = () => {
    setAuditLogs(dbAuditLogs.getAll() || []);
    setSales(dbSales.getAll() || []);
    setVisits(dbVisits.getAll() || []);
    setPatients(dbPatients.getAll() || []);
    setStockMovements(dbStockMovements.getAll() || []);
    setUsers(dbUsers.getAll() || []);
  };

  useEffect(() => {
    refreshData();
    const handleUpdate = () => refreshData();
    window.addEventListener("clinicflow_status_update", handleUpdate);
    window.addEventListener("clinicflow_audit_logged", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    // Real-time polling fallback ensures zero lag even without manual trigger
    const interval = setInterval(refreshData, 2000);
    return () => {
      window.removeEventListener("clinicflow_status_update", handleUpdate);
      window.removeEventListener("clinicflow_audit_logged", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      clearInterval(interval);
    };
  }, []);

  // Filtered Date Range Bounds
  const dateBounds = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date(Date.now() + 86400000); // 24-hour buffer prevents clock-skew dropoffs

    if (dateRange === "today") {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date(Date.now() + 86400000);
    } else if (dateRange === "yesterday") {
      start = new Date();
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (dateRange === "7_days") {
      start = new Date();
      start.setDate(now.getDate() - 7);
      end = new Date(Date.now() + 86400000);
    } else if (dateRange === "30_days") {
      start = new Date();
      start.setDate(now.getDate() - 30);
      end = new Date(Date.now() + 86400000);
    } else if (dateRange === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(Date.now() + 86400000);
    } else if (dateRange === "custom") {
      start = new Date(customStart + "T00:00:00");
      end = new Date(customEnd + "T23:59:59");
    } else if (dateRange === "all") {
      start = new Date(0);
      end = new Date(Date.now() + 86400000 * 365);
    }

    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [dateRange, customStart, customEnd]);

  // Staff Member Cash Drawer Collections Breakdown
  const staffCollections = useMemo(() => {
    const map = new Map();

    // Helper to get or create staff entry
    const getStaffEntry = (id, name, role) => {
      const key = (id || name || "unknown").toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: id || key,
          name: name || "Staff User",
          role: role || "Staff",
          registrationsCount: 0,
          opdFeesCollected: 0,
          posSalesCount: 0,
          posSalesCash: 0,
          discountsGranted: 0,
          stockWriteOffsCount: 0,
          totalCollection: 0,
        });
      }
      return map.get(key);
    };

    // Pre-populate with registered users
    users.forEach((u) => {
      getStaffEntry(u.id, u.name, u.role);
    });

    // 1. Process OPD Visit Registrations
    visits.forEach((v) => {
      const vTime = new Date(v.visit_date || v.created_at || 0).getTime();
      if (vTime < dateBounds.startMs) return;

      const actorName = v.active_cashier_name || v.cashier_name || v.registered_by_name || "Front Desk";
      const actorId = v.active_cashier_id || v.cashier_id || v.registered_by_id || actorName;
      
      if (staffFilter !== "all" && actorId !== staffFilter && actorName.toLowerCase() !== staffFilter.toLowerCase()) {
        return;
      }

      const entry = getStaffEntry(actorId, actorName, "Receptionist");
      entry.registrationsCount += 1;
      const fee = Number(v.fee_amount || v.fee || 0);
      if (v.fee_status === "paid" || fee > 0) {
        entry.opdFeesCollected += fee;
        entry.totalCollection += fee;
      }
    });

    // 2. Process POS Sales
    sales.forEach((s) => {
      if (s.is_voided) return;
      const sTime = new Date(s.sale_date || s.created_at || 0).getTime();
      if (sTime < dateBounds.startMs) return;

      const actorName = s.active_cashier_name || s.cashier_name || s.user_name || "Cashier Desk";
      const actorId = s.active_cashier_id || s.cashier_id || actorName;

      if (staffFilter !== "all" && actorId !== staffFilter && actorName.toLowerCase() !== staffFilter.toLowerCase()) {
        return;
      }

      const entry = getStaffEntry(actorId, actorName, "Cashier");
      entry.posSalesCount += 1;
      const paid = Number(s.paid_amount ?? s.total_amount) || 0;
      const disc = Number(s.discount_amount) || 0;
      entry.posSalesCash += paid;
      entry.discountsGranted += disc;
      entry.totalCollection += paid;
    });

    // 3. Process Stock Write-Offs & Adjustments
    stockMovements.forEach((m) => {
      const mTime = new Date(m.timestamp || 0).getTime();
      if (mTime < dateBounds.startMs) return;

      if (["write_off", "adjustment", "quarantine", "damage", "expiry"].includes(m.movement_type)) {
        const actorName = m.active_cashier_name || m.actor_name || "System";
        const actorId = m.active_cashier_id || m.actor_id || actorName;
        if (staffFilter !== "all" && actorId !== staffFilter && actorName.toLowerCase() !== staffFilter.toLowerCase()) {
          return;
        }
        const entry = getStaffEntry(actorId, actorName, "Warehouse");
        entry.stockWriteOffsCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalCollection - a.totalCollection);
  }, [users, visits, sales, stockMovements, dateBounds, staffFilter]);

  // Total Summary Metrics
  const summary = useMemo(() => {
    const totalRegs = staffCollections.reduce((sum, s) => sum + s.registrationsCount, 0);
    const totalOPD = staffCollections.reduce((sum, s) => sum + s.opdFeesCollected, 0);
    const totalPOSCount = staffCollections.reduce((sum, s) => sum + s.posSalesCount, 0);
    const totalPOSCash = staffCollections.reduce((sum, s) => sum + s.posSalesCash, 0);
    const totalDiscounts = staffCollections.reduce((sum, s) => sum + s.discountsGranted, 0);
    const totalWriteOffs = staffCollections.reduce((sum, s) => sum + s.stockWriteOffsCount, 0);
    const totalCollections = totalOPD + totalPOSCash;

    return {
      totalRegs,
      totalOPD,
      totalPOSCount,
      totalPOSCash,
      totalDiscounts,
      totalWriteOffs,
      totalCollections,
    };
  }, [staffCollections]);

  // Filtered Audit Log Entries Stream
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const lTime = new Date(log.timestamp || 0).getTime();
      if (lTime < dateBounds.startMs || lTime > dateBounds.endMs) return false;

      if (staffFilter !== "all") {
        const actorId = log.actor_id || "";
        const actorName = log.actor_name || "";
        if (actorId !== staffFilter && actorName.toLowerCase() !== staffFilter.toLowerCase()) {
          return false;
        }
      }

      if (activeTab === "registrations" && !["PATIENT_REGISTERED", "PATIENT_CREATED", "REGISTER_PATIENT", "UPDATE_PATIENT", "DELETE_PATIENT"].includes(log.action) && log.entity !== "patients") {
        return false;
      }
      if (activeTab === "sales" && !["POS_MEDICINE_SALE", "SALE", "B2B_SALE", "B2B_WHOLESALE_SALE", "VOID_SALE_INVOICE"].includes(log.action) && !["sales", "b2b_sales"].includes(log.entity)) {
        return false;
      }
      if (activeTab === "purchases" && !["CREATE_PURCHASE_GRN", "DELETE_PURCHASE_GRN"].includes(log.action) && log.entity !== "purchases") {
        return false;
      }
      if (activeTab === "inventory" && !["ADD_INVENTORY_ITEM", "UPDATE_INVENTORY_ITEM", "DELETE_INVENTORY_ITEM", "BULK_INVENTORY_IMPORT"].includes(log.action) && log.entity !== "inventory") {
        return false;
      }
      if (activeTab === "discounts" && log.action !== "DISCOUNT_GRANTED") {
        return false;
      }
      if (activeTab === "writeoffs" && !["STOCK_WRITE_OFF", "STOCK_MOVEMENT"].includes(log.action)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const str = `${log.action} ${log.actor_name} ${log.reason} ${log.entity} ${log.entity_id}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [auditLogs, activeTab, dateBounds, staffFilter, searchQuery]);

  const displayedLogs = useMemo(() => {
    if (displayLimit === "all") return filteredLogs;
    return filteredLogs.slice(0, Number(displayLimit));
  }, [filteredLogs, displayLimit]);

  const handleExportCSV = () => {
    let csv = "Timestamp,Action,Staff Member,Role,Entity,Entity ID,Details\n";
    filteredLogs.forEach((l) => {
      const date = `"${new Date(l.timestamp).toLocaleString("en-US", { timeZone: "Asia/Karachi" })}"`;
      const action = `"${escapeCSV(l.action)}"`;
      const actor = `"${escapeCSV(l.actor_name || "System")}"`;
      const role = `"${escapeCSV(l.role || "Staff")}"`;
      const entity = `"${escapeCSV(l.entity)}"`;
      const entityId = `"${escapeCSV(l.entity_id || "")}"`;
      const reason = `"${escapeCSV(l.reason || "")}"`;
      csv += `${date},${action},${actor},${role},${entity},${entityId},${reason}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `God_Level_Audit_Logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintAuditReceipt = () => {
    printExecutiveAuditReceipt({
      summary,
      staffCollections,
      auditLogsCount: filteredLogs.length,
      dateRange,
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 selection:bg-teal-600 selection:text-white">
      {/* ── Top Master Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-teal-800/40 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-black uppercase tracking-wider">
              REAL-TIME AUDIT STREAM
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-400/30 text-[10px] font-black uppercase tracking-wider">
              GOD-LEVEL ADMIN
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2.5">
            <ShieldAlert className="w-8 h-8 text-emerald-400" />
            God-Level Staff &amp; Drawer Audit Panel
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-1">
            Real-time multi-cashier tracking: Who registered patients, sold medicines, granted discounts, and performed stock write-offs.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0">
          <button
            onClick={refreshData}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/30"
          >
            <Download className="w-4 h-4" />
            Export Audit CSV
          </button>
          <button
            onClick={handlePrintAuditReceipt}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-teal-600/30"
          >
            <Printer className="w-4 h-4" />
            Print Audit Receipt
          </button>
        </div>
      </div>

      {/* ── Summary Key Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Cash Drawer</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            Rs. {summary.totalCollections.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            OPD (Rs. {summary.totalOPD.toLocaleString()}) + Pharmacy (Rs. {summary.totalPOSCash.toLocaleString()})
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Registered Patients</span>
            <Users className="w-5 h-5 text-teal-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {summary.totalRegs} <span className="text-xs font-bold text-slate-400">Tokens</span>
          </p>
          <p className="text-[10px] text-slate-500 font-medium">Attributed to active counter staff</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Discounts Granted</span>
            <Percent className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-700">
            Rs. {summary.totalDiscounts.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 font-medium">Over-the-counter bill reductions</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Stock Write-Offs</span>
            <PackageMinus className="w-5 h-5 text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-700">
            {summary.totalWriteOffs} <span className="text-xs font-bold text-slate-400">Items</span>
          </p>
          <p className="text-[10px] text-slate-500 font-medium">Quarantines &amp; stock adjustments</p>
        </div>
      </div>

      {/* ── Exact Cash Drawer Collections by Staff Member ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-teal-700" />
              Real-Time Cash Drawer Collection Breakdown by Staff Member
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Exact financial breakdown per cashier / receptionist logged in or selected on counter PC.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="today">Today</option>
              <option value="7_days">Last 7 Days</option>
              <option value="30_days">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-wider">
                <th className="p-3.5">Staff Member</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5 text-center">OPD Registrations</th>
                <th className="p-3.5 text-right">OPD Fees (Rs)</th>
                <th className="p-3.5 text-center">POS Sales Count</th>
                <th className="p-3.5 text-right">POS Sales Cash (Rs)</th>
                <th className="p-3.5 text-right">Discounts Granted</th>
                <th className="p-3.5 text-right font-black text-teal-950">Total Cash Collection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 font-medium">
              {staffCollections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    No transactions found for the selected filter.
                  </td>
                </tr>
              ) : (
                staffCollections.map((staff) => (
                  <tr key={staff.id || staff.name} className="hover:bg-teal-50/40 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center font-black text-[10px] shrink-0">
                        {(staff.name || "S").substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="block font-bold">{staff.name}</span>
                        <span className="text-[9.5px] text-slate-400 font-mono">ID: {staff.id}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] capitalize">
                        {staff.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                      {staff.registrationsCount}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                      Rs. {staff.opdFeesCollected.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                      {staff.posSalesCount}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-teal-800">
                      Rs. {staff.posSalesCash.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-amber-700">
                      Rs. {staff.discountsGranted.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-sm text-emerald-950 bg-emerald-50/60">
                      Rs. {staff.totalCollection.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Real-Time Audit Log Events Stream ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-700" />
              Real-Time Audit Log Events Stream ({filteredLogs.length})
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Immutable chained log events tagged with staff identity, timestamp, and entity mutations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit stream..."
                className="bg-slate-50 border border-slate-300 focus:border-teal-600 focus:bg-white rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Date Range Selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="today">📅 Today (Aaj)</option>
              <option value="yesterday">📅 Yesterday (Kal)</option>
              <option value="7_days">📊 Last 7 Days</option>
              <option value="30_days">📆 Last 30 Days</option>
              <option value="this_month">📆 This Month</option>
              <option value="custom">⚙️ Custom Date Range</option>
              <option value="all">🌐 All Logs</option>
            </select>

            {dateRange === "custom" && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300 text-xs">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-900 rounded-lg px-2 py-1 font-mono text-xs outline-none"
                />
                <span className="text-slate-500 font-bold">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-900 rounded-lg px-2 py-1 font-mono text-xs outline-none"
                />
              </div>
            )}

            {/* Staff Selector */}
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="all">All Staff Members</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 min-w-0 py-0.5">
            {[
              { id: "all", label: "All Audit Events", icon: ShieldAlert },
              { id: "registrations", label: "Patient Registrations", icon: Users },
              { id: "sales", label: "Medicine Sales", icon: CreditCard },
              { id: "purchases", label: "Purchases & GRN", icon: ShoppingCart },
              { id: "inventory", label: "Inventory & Items", icon: Package },
              { id: "discounts", label: "Discounts Granted", icon: Percent },
              { id: "writeoffs", label: "Stock Adjustments", icon: PackageMinus },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-teal-700 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Limit & Live Counter Selector */}
          <div className="flex items-center gap-2 text-xs shrink-0">
            <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
              Showing <strong className="text-slate-900">{displayedLogs.length}</strong> of <strong className="text-teal-700">{filteredLogs.length}</strong>
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-bold">
              {[
                { val: "50", label: "50" },
                { val: "100", label: "100" },
                { val: "250", label: "250" },
                { val: "500", label: "500" },
                { val: "all", label: "All" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setDisplayLimit(opt.val)}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    displayLimit === opt.val
                      ? "bg-teal-700 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Log Stream Table with Vertical Scrollbar & Pinned Sticky Header */}
        <div className="max-h-[560px] overflow-y-auto overflow-x-auto border border-slate-200 rounded-2xl custom-scrollbar relative shadow-inner bg-slate-50/20">
          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
            <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-md shadow-xs border-b border-slate-200">
              <tr className="text-slate-700 font-black uppercase text-[10px] tracking-wider">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Staff Member</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Event Details / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 font-medium bg-white">
              {displayedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400 font-bold">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Clock className="w-8 h-8 text-slate-300" />
                      <span>No matching audit log entries found for this filter.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedLogs.map((log) => {
                  const dateStr = new Date(log.timestamp || Date.now()).toLocaleString("en-US", {
                    timeZone: "Asia/Karachi",
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  });

                  return (
                    <tr key={log.id || log.hash || Math.random()} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase tracking-wide border inline-block ${
                            log.action?.includes("SALE")
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : log.action?.includes("REGISTER") || log.action?.includes("PATIENT")
                              ? "bg-teal-50 text-teal-800 border-teal-200"
                              : log.action?.includes("PURCHASE")
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : log.action?.includes("INVENTORY")
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : log.action?.includes("PARTY")
                              ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                              : log.action?.includes("EXPENSE")
                              ? "bg-orange-50 text-orange-800 border-orange-200"
                              : log.action?.includes("CLOSING") || log.action?.includes("SHIFT")
                              ? "bg-violet-50 text-violet-800 border-violet-200"
                              : log.action?.includes("DISCOUNT")
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : log.action?.includes("WRITE_OFF") || log.action?.includes("DELETE") || log.action?.includes("VOID")
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : "bg-slate-100 text-slate-800 border-slate-200"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        {(() => {
                          let staffDisplayName = log.actor_name;
                          if (!staffDisplayName || staffDisplayName === "System Staff" || staffDisplayName === "System Automated") {
                            if (log.actor_id) {
                              const uObj = users.find((u) => u.id === log.actor_id || u.userId === log.actor_id);
                              if (uObj) staffDisplayName = uObj.name || uObj.full_name;
                            }
                          }
                          if (!staffDisplayName) staffDisplayName = "System Handler";
                          const resolvedRole = log.role || (users.find((u) => u.id === log.actor_id)?.role) || "staff";

                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-black text-slate-950 text-xs flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs text-teal-700">person</span>
                                {staffDisplayName}
                              </span>
                              <span className="w-fit px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-900 font-bold text-[9.5px] uppercase border border-teal-200">
                                {resolvedRole}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        <span className="font-bold text-slate-800">{log.entity}</span>
                        {log.entity_id ? <span className="text-slate-400 block text-[10px]">#{log.entity_id.slice(-8)}</span> : ""}
                      </td>
                      <td className="p-3 text-slate-800">
                        <div className="font-medium text-xs leading-relaxed">{log.reason || "Operational audit trace"}</div>
                        {(log.reason?.includes("Device Previous Active User") || log.reason?.includes("Device Last Active User")) && (
                          <div className="mt-1 inline-flex items-center gap-1 bg-rose-50 text-rose-950 text-[10.5px] font-bold px-2 py-0.5 rounded-md border border-rose-300 shadow-2xs">
                            <span className="material-symbols-outlined text-xs text-rose-700">history</span>
                            <span>Device Previous User Lineage Tracked</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
