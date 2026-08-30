import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export const GLOBAL_NAV_SHORTCUTS = [
  { key: "Alt+1", label: "Dashboard", path: "/dashboard", icon: "dashboard" },
  { key: "Alt+2", label: "Patient Registration", path: "/reception/register", icon: "how_to_reg" },
  { key: "Alt+3", label: "Reception Queue", path: "/reception/queue", icon: "event_note" },
  { key: "Alt+4", label: "Doctor OPD Queue", path: "/doctor/queue", icon: "stethoscope" },
  { key: "Alt+5", label: "Counter POS", path: "/store/pos", icon: "point_of_sale" },
  { key: "Alt+6", label: "Store Inventory", path: "/store", icon: "inventory_2" },
  { key: "Alt+7", label: "Sales Log & Returns", path: "/store/sales", icon: "receipt_long" },
  { key: "Alt+8", label: "Purchases (GRN)", path: "/store/purchases", icon: "local_shipping" },
  { key: "Alt+9", label: "Warehouse & Wholesale", path: "/store/warehouse", icon: "warehouse" },
  { key: "Alt+0", label: "Patients & EMR", path: "/patients", icon: "group" },
  { key: "Alt+F", label: "Fees & CashBook", path: "/fees", icon: "payments" },
];

export function useGlobalKeyboardNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      // 1. F12 or (Shift + ?) -> Toggle Keyboard Shortcuts Cheatsheet Modal
      if (e.key === "F12" || (e.shiftKey && e.key === "?")) {
        const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
        if (!isInput || e.key === "F12") {
          e.preventDefault();
          setIsShortcutsModalOpen((prev) => !prev);
          return;
        }
      }

      // 2. Escape -> Close Shortcuts Modal or blur current input
      if (e.key === "Escape") {
        if (isShortcutsModalOpen) {
          e.preventDefault();
          setIsShortcutsModalOpen(false);
          return;
        }
        if (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
          document.activeElement.blur();
        }
      }

      // 3. Quick Global Search Focus: Press '/' or 'Ctrl+K' / 'Alt+S' to immediately focus the main search input
      if ((e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) || 
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || 
          (e.altKey && e.key.toLowerCase() === "s")) {
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search" i], input[type="search"], input[id*="search" i]');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select?.();
          return;
        }
      }

      // 4. Arrow Navigation & Enter handling in Lists/Tables when not typing in text field
      const activeTag = document.activeElement?.tagName;
      const isTyping = ["INPUT", "TEXTAREA"].includes(activeTag) && !["checkbox", "radio", "button"].includes(document.activeElement?.type);

      if (!isTyping) {
        // Find all interactive table rows or list items on active screen
        const focusableRows = Array.from(document.querySelectorAll("tbody tr, [data-keyboard-item], .keyboard-nav-item"));
        if (focusableRows.length > 0) {
          const currentIndex = focusableRows.findIndex(row => row === document.activeElement || row.contains(document.activeElement));

          if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextIdx = currentIndex < focusableRows.length - 1 ? currentIndex + 1 : 0;
            const target = focusableRows[nextIdx];
            target.focus?.() || target.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
            const btn = target.querySelector("button, a, input");
            if (btn) btn.focus();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevIdx = currentIndex > 0 ? currentIndex - 1 : focusableRows.length - 1;
            const target = focusableRows[prevIdx];
            target.focus?.() || target.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
            const btn = target.querySelector("button, a, input");
            if (btn) btn.focus();
          }
        }
      }

      // 5. Alt + Number / Alt + Key Navigation (Instant Full Application Control)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        let targetPath = null;

        switch (key) {
          case "1": targetPath = "/dashboard"; break;
          case "2": targetPath = "/reception/register"; break;
          case "3": targetPath = "/reception/queue"; break;
          case "4": targetPath = "/doctor/queue"; break;
          case "5": targetPath = "/store/pos"; break;
          case "6": targetPath = "/store"; break;
          case "7": targetPath = "/store/sales"; break;
          case "8": targetPath = "/store/purchases"; break;
          case "9": targetPath = "/store/warehouse"; break;
          case "0": targetPath = "/patients"; break;
          case "f": targetPath = "/fees"; break;
          case "n":
            // Alt + N -> Focus New / Register primary button
            e.preventDefault();
            const newBtn = document.querySelector('button:has-text("Add"), button:has-text("New"), [data-action="new"]');
            if (newBtn) newBtn.click();
            break;
          case "h":
          case "?":
            e.preventDefault();
            setIsShortcutsModalOpen(true);
            return;
          default:
            break;
        }

        if (targetPath && targetPath !== location.pathname) {
          e.preventDefault();
          navigate(targetPath);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate, location.pathname, isShortcutsModalOpen]);

  return {
    isShortcutsModalOpen,
    setIsShortcutsModalOpen,
    closeShortcutsModal: () => setIsShortcutsModalOpen(false),
  };
}
