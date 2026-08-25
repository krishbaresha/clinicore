import { useState, useEffect, useRef, useCallback } from "react";

/**
 * PullToRefresh — Enterprise Universal Mobile (Touch) & Desktop (Mouse Hold-Drag) Refresh Engine.
 * - Supports touch swipes on mobile/tablets.
 * - Supports holding and dragging down on desktop (from top header/page area) when scrolled to top.
 * - Completely disables text selection during active drag via `select-none` lock.
 * - Smooth elastic physics with rotation arrow and live refresh pill.
 */
export default function PullToRefresh({ children, onRefresh, enabled = true }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const containerRef = useRef(null);

  const THRESHOLD = 65; // px pull needed to trigger refresh
  const MAX_PULL = 115; // max visual displacement

  // Execute refresh sequence
  const executeRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(THRESHOLD * 0.75); // Hold at active spinner height

    try {
      if (typeof onRefresh === "function") {
        await onRefresh();
      } else {
        // Default: Full clean webapp refresh
        await new Promise((resolve) => setTimeout(resolve, 600));
        window.location.reload();
        return;
      }
    } catch {
      window.location.reload();
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
        setIsDragging(false);
        isPointerDownRef.current = false;
        document.body.classList.remove("select-none", "cursor-grabbing");
      }, 450);
    }
  }, [onRefresh, THRESHOLD]);

  const isInteractiveElement = (target) => {
    if (!target) return false;
    // Don't intercept clicks on inputs, buttons, links, or open modals
    if (target.closest("input, textarea, select, button, a, [role='button'], [role='dialog'], .modal, .fixed")) {
      return true;
    }
    if (typeof document !== "undefined" && document.body.style.overflow === "hidden") {
      return true;
    }
    return false;
  };

  // ── Touch Event Handlers ──
  const handleTouchStart = (e) => {
    if (!enabled || isRefreshing || isInteractiveElement(e.target)) return;
    const scrollPos = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollPos <= 5) {
      startYRef.current = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;
      isPointerDownRef.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPointerDownRef.current || isRefreshing || !enabled) return;
    const scrollPos = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollPos > 5) {
      setPullDistance(0);
      setIsDragging(false);
      isPointerDownRef.current = false;
      document.body.classList.remove("select-none");
      return;
    }

    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    if (diff > 8) {
      setIsDragging(true);
      document.body.classList.add("select-none");
      const damped = Math.min(MAX_PULL, (diff - 8) * 0.48);
      setPullDistance(damped);
      if (e.cancelable) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPointerDownRef.current && !isDragging) return;
    isPointerDownRef.current = false;
    document.body.classList.remove("select-none");

    if (pullDistance >= THRESHOLD * 0.55 || pullDistance >= 40) {
      executeRefresh();
    } else {
      setIsDragging(false);
      setPullDistance(0);
    }
  };

  // ── Desktop Mouse & Window Top Drag Handlers ──
  const handleMouseDown = (e) => {
    // Only primary left-click
    if (e.button !== 0 || !enabled || isRefreshing || isInteractiveElement(e.target)) return;
    const scrollPos = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollPos <= 10) {
      startYRef.current = e.clientY;
      currentYRef.current = e.clientY;
      isPointerDownRef.current = true;
    }
  };

  useEffect(() => {
    const handleGlobalMouseDown = (e) => {
      // If clicked on top 80px of viewport (e.g. sticky header bar) and not on an interactive button/input
      if (e.button !== 0 || !enabled || isRefreshing || isInteractiveElement(e.target)) return;
      const scrollPos = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollPos <= 10 && e.clientY <= 90) {
        startYRef.current = e.clientY;
        currentYRef.current = e.clientY;
        isPointerDownRef.current = true;
      }
    };

    const handleGlobalMouseMove = (e) => {
      if (!isPointerDownRef.current || isRefreshing || !enabled) return;
      const scrollPos = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollPos > 10) {
        setPullDistance(0);
        setIsDragging(false);
        isPointerDownRef.current = false;
        document.body.classList.remove("select-none", "cursor-grabbing");
        return;
      }

      currentYRef.current = e.clientY;
      const diff = currentYRef.current - startYRef.current;

      if (diff > 8) {
        setIsDragging(true);
        document.body.classList.add("select-none", "cursor-grabbing");
        const damped = Math.min(MAX_PULL, (diff - 8) * 0.45);
        setPullDistance(damped);
      } else {
        setPullDistance(0);
      }
    };

    const handleGlobalMouseUp = () => {
      if (!isPointerDownRef.current && !isDragging) return;
      isPointerDownRef.current = false;
      document.body.classList.remove("select-none", "cursor-grabbing");

      if (pullDistance >= THRESHOLD * 0.55 || pullDistance >= 38) {
        executeRefresh();
      } else {
        setIsDragging(false);
        setPullDistance(0);
      }
    };

    window.addEventListener("mousedown", handleGlobalMouseDown);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousedown", handleGlobalMouseDown);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      document.body.classList.remove("select-none", "cursor-grabbing");
    };
  }, [enabled, isDragging, isRefreshing, pullDistance, executeRefresh]);

  const progress = Math.min(1, pullDistance / 45);
  const isReady = pullDistance >= 38 || isRefreshing;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      className={`relative w-full ${isDragging ? "select-none cursor-grabbing" : ""}`}
    >
      {/* Animated Pull-to-Refresh Indicator Pill */}
      {(pullDistance > 4 || isRefreshing) && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[120] transition-all duration-150 pointer-events-none select-none"
          style={{
            transform: `translate(-50%, ${Math.max(0, pullDistance - 20)}px) scale(${0.85 + progress * 0.15})`,
            opacity: Math.min(1, progress * 1.4),
          }}
        >
          <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border-2 border-teal-500/40 text-teal-950 flex items-center gap-2.5 text-xs font-bold ring-4 ring-teal-500/10">
            {isRefreshing ? (
              <>
                <span className="material-symbols-outlined text-teal-700 animate-spin text-lg">
                  progress_activity
                </span>
                <span className="text-teal-900 font-extrabold tracking-wide">Refreshing CliniCore...</span>
              </>
            ) : (
              <>
                <span
                  className="material-symbols-outlined text-teal-700 text-lg transition-transform duration-200"
                  style={{
                    transform: `rotate(${isReady ? 180 : progress * 180}deg)`,
                  }}
                >
                  arrow_downward
                </span>
                <span className="text-slate-800 font-bold">
                  {isReady ? "Release to reload" : "Hold & pull down to reload..."}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area with Elastic Displacement */}
      <div
        style={{
          transform: (isDragging || isRefreshing) && pullDistance > 0 ? `translateY(${pullDistance * 0.75}px)` : undefined,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
