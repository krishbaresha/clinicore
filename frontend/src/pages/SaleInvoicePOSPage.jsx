import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import SaleInvoiceModal from "../components/SaleInvoiceModal.jsx";
import { dbSales } from "../api/db.js";

export default function SaleInvoicePOSPage() {
  const navigate = useNavigate();
  const [modalKey, setModalKey] = useState(0);

  const handleReset = () => {
    setModalKey((k) => k + 1);
  };

  return (
    <div className="w-full p-2 sm:p-4 space-y-4 font-sans">
      <SaleInvoiceModal
        key={modalKey}
        isOpen={true}
        isPage={true}
        onClose={() => navigate("/store/sales")}
        onSave={handleReset}
      />
    </div>
  );
}
