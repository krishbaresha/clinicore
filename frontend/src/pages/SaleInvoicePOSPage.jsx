import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import SaleInvoiceModal from "../components/SaleInvoiceModal.jsx";

export default function SaleInvoicePOSPage() {
  const navigate = useNavigate();
  const [modalKey, setModalKey] = useState(0);

  const handleReset = () => {
    setModalKey((k) => k + 1);
  };

  return (
    <div className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col p-0 font-sans">
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
