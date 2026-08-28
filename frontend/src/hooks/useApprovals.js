import { useState, useEffect, useCallback, useMemo } from "react";
import { dbApprovals } from "../api/db.js";
import { useAuth } from "./useAuth.js";

export function useApprovals() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState(() => dbApprovals.getAll());
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    setApprovals(dbApprovals.getAll());
  }, []);

  useEffect(() => {
    const handleUpdate = () => reload();
    window.addEventListener("clinicflow_approvals_change", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("clinicflow_approvals_change", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [reload]);

  const pendingList = useMemo(() => approvals.filter((a) => a.status === "pending"), [approvals]);
  const pendingCount = pendingList.length;

  const canReview = useMemo(() => {
    return ["owner", "admin", "manager"].includes(user?.role) || user?.is_owner;
  }, [user]);

  const requestApproval = useCallback(
    async (requestData) => {
      setLoading(true);
      try {
        const payload = {
          ...requestData,
          requested_by_id: user?.id || "unknown",
          requested_by_name: user?.name || "Staff",
        };
        const record = dbApprovals.createRequest(payload);
        reload();
        return record;
      } finally {
        setLoading(false);
      }
    },
    [user, reload]
  );

  const reviewApproval = useCallback(
    async (id, decision, reviewNotes = "") => {
      if (!canReview) throw new Error("Unauthorized to review approvals.");
      setLoading(true);
      try {
        const res = dbApprovals.reviewRequest({
          id,
          reviewerId: user?.id || "unknown",
          reviewerName: user?.name || "Supervisor",
          reviewerRole: user?.role || "admin",
          decision,
          reviewNotes,
        });
        reload();
        return res;
      } finally {
        setLoading(false);
      }
    },
    [canReview, user, reload]
  );

  return {
    approvals,
    pendingList,
    pendingCount,
    canReview,
    loading,
    requestApproval,
    reviewApproval,
    reload,
    evaluateGovernance: dbApprovals.evaluateGovernance,
  };
}
