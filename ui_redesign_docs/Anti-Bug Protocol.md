# **04 — Anti-Bug & Zero-Regression Protocol (Strict Rules)**

## **🚫 Mandatory Technical Constraints**

### **1\. Preserve State Key Names & Schemas**

* **NEVER** rename database or state object fields in db.js, syncEngine.js, or backend API endpoints (/api/v1/system/sync-state).  
* Use exact field names (e.g., relation\_name, relation\_type, token\_number, vitals\_bp, vitals\_pulse, store\_stock, location\_stocks).

### **2\. Form Input Typing State Preservation**

* Background sync pollers (3s interval) must **NEVER** overwrite active form inputs while a user is typing.  
* Always use defensive local state hooks or local draft states (preserveForm pattern).

### **3\. Thermal Printing Integrity**

* **DO NOT** alter executeThermalPrint, printThermalReceipt, printOPDTokenReceipt, or iframe print dispatches.  
* Retain exact 80mm ESC/POS layout structures and inline CSS print triggers.

### **4\. Auth & Security Guards Preservation**

* Retain all security wrappers (LicenseGuard, AdminOrOwnerRoute) and step-up PIN verifications.  
* Ensure Super Admin routes (/admin, /receipt-studio) remain strictly locked behind master passcode checks (KB2026).

### **5\. Verification Harness Required**

* After editing any component, run npm test to verify 100% pass rate across all 21 test suites (149+ unit & integration tests).  
* Run npm run build to confirm zero Vite compilation errors.