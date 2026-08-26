# **02 — Universal Screen Adaptability & Responsiveness Rules**

## **📱 Breakpoint Strategy (320px to 4K Displays)**

### **1\. Mobile Extra Small (320px \- 480px)**

* Single column layout (grid-cols-1).  
* Minimum **44px touch targets** for all buttons, inputs, and steppers.  
* Sticky action bars positioned at bottom-16 to clear the mobile bottom navigation bar (h-16 z-45).  
* Font size adjustments (text-xs on mobile, text-sm on desktop).

### **2\. Tablet / Compact Viewports (768px \- 1024px)**

* Dual column bento layout (grid-cols-2).  
* Sidebar navigation switches automatically to compact icon dock (w-20 / 80px).  
* Modal dialogs take 90% screen width with internal scrollable table containers.

### **3\. Desktop / Laptop (1280px \- 1536px)**

* 3 to 4 column Bento grids.  
* Full expanded sidebar (w-64 / 256px).  
* Split-screen workspace for POS Cart and Inventory matrices.

### **4\. Ultra-Wide / 4K Monitors (1920px+)**

* Enforce max-width bounds (max-w-7xl mx-auto) on main containers to prevent unnaturally stretched form inputs.

## **🛡️ Horizontal Overflow & Table Wrappers**

1. **Zero Window Horizontal Scroll:**  
   Apply max-w-full overflow-x-hidden on outer page wrappers to prevent body layout shifts.  
2. **Responsive Table Container Standard:**  
   All dense data tables (Stock Ledger, B2B Invoices, CashBook, Sales Log) MUST be wrapped inside a responsive scroll container:  
   \<div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 custom-scrollbar"\>  
     \<table className="w-full text-left border-collapse min-w-\[650px\]"\>  
       {/\* Sticky rightmost action column \*/}  
     \</table\>  
   \</div\>

3. **Touch Ergonomics Standard:**  
   Action buttons, quantity steppers (+ / \-), and table action icons MUST feature a minimum touch target area of 44px x 44px.