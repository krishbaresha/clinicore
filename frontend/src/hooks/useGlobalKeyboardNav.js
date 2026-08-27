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
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // 2. Escape -> Close Shortcuts Modal if open
      if (e.key === "Escape" && isShortcutsModalOpen) {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
        return;
      }

      // 3. Alt + Number / Alt + F Navigation
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
