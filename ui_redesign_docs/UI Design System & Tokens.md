# **01 — UI Design System, Aesthetics & CSS Tokens**

## **🎨 Color Palette & Theme Engine**

* **Primary Accent:** Deep Emerald (\#0F766E / teal-700)  
* **Secondary Highlight:** Mint Green (\#10B981 / emerald-500)  
* **Background Surface:** Soft Slate Cream (\#F8FAFC / slate-50)  
* **Glassmorphic Surface:** Translucent White (rgba(255, 255, 255, 0.85) with backdrop-filter: blur(12px))  
* **Dark Elements / Text:** Charcoal Slate (\#0F172A / slate-900)  
* **Status Indicators (WCAG AA Compliant):**  
  * Active / Paid / Success: Mint Emerald (emerald-600)  
  * Warning / Pending / Grace: Warm Amber (amber-500)  
  * Error / Unpaid / Locked: Vivid Rose (rose-600)

## **📐 Typography & Metric Scale**

* **Font Stack:** System UI / Inter / Arial (font-sans)  
* **Header 1 (Screen Titles):** text-xl sm:text-2xl font-bold tracking-tight text-slate-900  
* **Header 2 (Section Titles):** text-base sm:text-lg font-semibold text-slate-800  
* **Body Text:** text-xs sm:text-sm text-slate-600 leading-relaxed  
* **KPI Badges / Numbers:** font-mono font-bold text-slate-900

## **💎 Design System Components**

### **1\. Translucent Glassmorphic Card**

\<div className="bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-sm hover:shadow-md transition-all rounded-2xl p-4 sm:p-6"\>  
  {/\* Content \*/}  
\</div\>

### **2\. Bento Grid Layout**

\<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"\>  
  {/\* Telemetry Cards \*/}  
\</div\>

### **3\. Interactive Touch Action Pill**

\<button className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 bg-teal-600 text-white hover:bg-teal-700 active:scale-95 transition-all shadow-sm min-h-\[44px\]"\>  
  {/\* Icon \+ Label \*/}  
\</button\>  
