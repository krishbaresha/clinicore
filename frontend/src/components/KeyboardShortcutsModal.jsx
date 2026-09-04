// ClinicFlow Master Keyboard Shortcuts Cheatsheet Deck v2.5
// Built with UI/UX Pro Max standards for high-performance medical workflows

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Keyboard, 
  X, 
  LayoutDashboard, 
  CreditCard, 
  Stethoscope, 
  UserPlus, 
  Warehouse, 
  Sparkles,
  ArrowRight,
  Move
} from "lucide-react";

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white border-b border-teal-600/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                <Keyboard className="w-6 h-6 text-teal-200" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-wide flex items-center gap-2">
                  ClinicFlow Master Keyboard Deck
                  <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-teal-400/20 text-teal-200 border border-teal-300/30 rounded-full">
                    High-Speed Hotkeys
                  </span>
                </h2>
                <p className="text-xs text-teal-100/80">
                  Operate the entire clinic & wholesale pharmacy without touching the mouse
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Close (Escape)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content with Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 dark:text-slate-100">
            {/* Grid of Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Section 1: Global Navigation */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400 font-bold text-sm">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Global Page Navigation (Anywhere)</span>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { kbd: "Alt + 1", desc: "Executive Dashboard" },
                    { kbd: "Alt + 2", desc: "Patient Registration (New / Search)" },
                    { kbd: "Alt + 3", desc: "Reception Queue & Token Manager" },
                    { kbd: "Alt + 4", desc: "Doctor OPD Queue & Consultation" },
                    { kbd: "Alt + 5", desc: "Counter Pharmacy POS" },
                    { kbd: "Alt + 6", desc: "Store Inventory & Stock Ledger" },
                    { kbd: "Alt + 7", desc: "Sales Log & Returns" },
                    { kbd: "Alt + 8", desc: "Purchases (GRN Inward)" },
                    { kbd: "Alt + 9", desc: "Wholesale B2B & Parties" },
                    { kbd: "Alt + 0", desc: "Patients Directory & EMR" },
                    { kbd: "Alt + F", desc: "Fees & CashBook Register" },
                    { kbd: "F12 / ?", desc: "Open / Close This Shortcut Deck" },
                    { kbd: "Escape", desc: "Close Modals / Cancel / Clear" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">{item.desc}</span>
                      <kbd className="px-2 py-0.5 font-mono text-[11px] font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded shadow-sm">
                        {item.kbd}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Counter POS Hotkeys */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400 font-bold text-sm">
                  <CreditCard className="w-4 h-4" />
                  <span>Pharmacy Counter POS Hotkeys</span>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { kbd: "F1 / Alt+S", desc: "Focus Medicine Search Bar" },
                    { kbd: "F2 / Ctrl+Enter", desc: "Instant Cash Checkout & Print Bill" },
                    { kbd: "F3", desc: "Toggle Company Filter vs Global Search" },
                    { kbd: "F4", desc: "Link Today's OPD Doctor Prescription" },
                    { kbd: "F6", desc: "Toggle Cash Sale vs Patient Credit (Udhaar)" },
                    { kbd: "F7", desc: "Focus Additional Bill Discount (Rs)" },
                    { kbd: "F8", desc: "Focus Cash Given (Tendered Rupees)" },
                    { kbd: "F10", desc: "Instant Reprint Last Thermal Receipt" },
                    { kbd: "F11 / Alt+C", desc: "Clear Cart & Start Fresh Bill" },
                    { kbd: "↑ / ↓ / ← / →", desc: "2D Grid Jump (Search ⇄ Qty ⇄ Disc ⇄ Bill)" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">{item.desc}</span>
                      <kbd className="px-2 py-0.5 font-mono text-[11px] font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded shadow-sm">
                        {item.kbd}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Doctor Chamber & Consultation */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400 font-bold text-sm">
                  <Stethoscope className="w-4 h-4" />
                  <span>Doctor OPD Consultation Hotkeys</span>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { kbd: "↑ / ↓", desc: "Navigate Waiting Patients in Queue" },
                    { kbd: "Enter", desc: "Call Highlighted Patient into Chamber" },
                    { kbd: "F1", desc: "Focus Chief Complaints / Clinical Notes" },
                    { kbd: "F2 / Ctrl+Enter", desc: "Save Consultation & Instant Print Rx" },
                    { kbd: "F3", desc: "Add New Prescription Medicine Row" },
                    { kbd: "F4", desc: "Focus Next Follow-up (Days)" },
                    { kbd: "F8", desc: "Focus Lab Tests & Clinical Advice" },
                    { kbd: "Escape", desc: "Return to Doctor Waiting Queue" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">{item.desc}</span>
                      <kbd className="px-2 py-0.5 font-mono text-[11px] font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded shadow-sm">
                        {item.kbd}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Reception & Warehouse */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400 font-bold text-sm">
                  <UserPlus className="w-4 h-4" />
                  <span>Reception & Warehouse Operations</span>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { kbd: "F1", desc: "Focus Search (Patient / Supplier / Item)" },
                    { kbd: "Enter", desc: "Move Forward across Form Inputs / Rows" },
                    { kbd: "F2 / Ctrl+Enter", desc: "Save Form & Instant Print Token/GRN" },
                    { kbd: "F3", desc: "Toggle Mode (New Reg vs Search / Add Row)" },
                    { kbd: "F4", desc: "Toggle Cash vs Udhaar / Credit Account" },
                    { kbd: "P", desc: "In Queue: Reprint Token for Selected Patient" },
                    { kbd: "↑ / ↓", desc: "Navigate Queue Cards or Table Rows" },
                    { kbd: "Tab / Shift+Tab", desc: "Forward / Backward Field Focus" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">{item.desc}</span>
                      <kbd className="px-2 py-0.5 font-mono text-[11px] font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded shadow-sm">
                        {item.kbd}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Pro Tip Box */}
            <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div className="text-xs text-teal-900 dark:text-teal-200">
                <span className="font-bold">Pro Speed Tip:</span> Press <kbd className="px-1.5 py-0.5 bg-teal-200/60 dark:bg-teal-800 text-teal-950 dark:text-teal-100 rounded font-mono font-semibold">F12</kbd> from any screen at any time to toggle this quick cheatsheet deck.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              CliniCore v2.5 &bull; 100% Pure Keyboard-Driven POS & Operations
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow transition-colors"
            >
              Got it (Esc)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
