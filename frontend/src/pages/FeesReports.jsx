import { useState, useEffect } from "react";
import { getFeesSummary } from "../api/visits.js";
import { formatCurrency } from "../utils/formatters.js";

const RANGES = ["daily", "weekly", "monthly"];

export default function FeesReports() {
  const [range,   setRange]   = useState("monthly");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const r = getFeesSummary(range);
    if (r.success) setSummary(r.data);
  }, [range]);

  const maxFee = summary?.chart_data?.length
    ? Math.max(...summary.chart_data.map((d) => d.fees), 1)
    : 1;

  return (
    <div className="p-3 sm:p-5 md:p-8 flex flex-col gap-lg max-w-4xl mx-auto w-full">
      <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Fees &amp; Reports</h1>

      {/* Range Toggle */}
      <div className="flex gap-xs bg-surface-container-low rounded-full p-1 self-start">
        {RANGES.map((r) => (
          <button
            key={r}
            id={`range-${r}`}
            onClick={() => setRange(r)}
            className={`px-md py-2 rounded-full font-label-md text-label-md uppercase transition-colors ${
              range === r
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {summary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div className="glass-card p-md flex flex-col gap-2">
              <p className="font-label-md text-label-md text-outline uppercase tracking-wider">Total Fees</p>
              <p className="font-display-lg text-display-lg font-bold text-primary">{formatCurrency(summary.total_fees)}</p>
            </div>
            <div className="glass-card p-md flex flex-col gap-2">
              <p className="font-label-md text-label-md text-outline uppercase tracking-wider">Visits</p>
              <p className="font-display-lg text-display-lg font-bold text-on-surface">{summary.visit_count}</p>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="glass-card p-md">
            <p className="font-label-md text-label-md text-outline uppercase tracking-wider mb-md">
              Fee Breakdown — {range.charAt(0).toUpperCase() + range.slice(1)}
            </p>
            {summary.chart_data.length === 0 ? (
              <p className="font-body-md text-body-md text-outline text-center py-lg">No visits in this period.</p>
            ) : (
              <div className="flex items-end gap-sm overflow-x-auto pb-2" style={{ minHeight: "140px" }}>
                {summary.chart_data.map((d, i) => {
                  const pct = Math.max(4, Math.round((d.fees / maxFee) * 120));
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                      <span className="font-label-md text-label-md text-outline text-xs">{formatCurrency(d.fees)}</span>
                      <div
                        className="w-10 bg-primary rounded-t-lg transition-all"
                        style={{ height: `${pct}px` }}
                        title={`${d.date}: ${formatCurrency(d.fees)}`}
                      />
                      <span className="font-label-md text-label-md text-outline text-xs whitespace-nowrap">{d.date}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
