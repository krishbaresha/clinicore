import { useState } from "react";

/**
 * Enterprise Medical HD Image Lightbox
 * Features:
 * - Smooth Multi-Level Zoom (0.5x to 3.5x)
 * - 90-degree Step Rotation
 * - Pan / Drag navigation when zoomed
 * - 1-Click HD Download & Print
 * - Zero Origin Server Load (Edge/CDN Cachable)
 */
export default function PhotoLightbox({ src, alt = "Medical Document", onClose }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  if (!src) return null;

  function handleZoomIn() {
    setScale((prev) => Math.min(3.5, Number((prev + 0.25).toFixed(2))));
  }

  function handleZoomOut() {
    setScale((prev) => {
      const next = Math.max(0.5, Number((prev - 0.25).toFixed(2)));
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }

  function handleReset() {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }

  function handleRotate() {
    setRotation((prev) => (prev + 90) % 360);
  }

  function handleMouseDown(e) {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }

  function handleMouseMove(e) {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleDownload() {
    const link = document.createElement("a");
    link.href = src;
    link.download = `medical_document_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Print Document</title>
            <style>
              body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #fff; }
              img { max-width: 100%; max-height: 100%; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${src}" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      win.document.close();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 select-none animate-fadeIn"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Floating Header & Controls */}
      <div
        className="w-full max-w-4xl flex items-center justify-between text-white z-10 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-teal-400 text-2xl">visibility</span>
          <div>
            <div className="font-bold text-sm text-gray-100">{alt}</div>
            <div className="text-[10px] text-gray-400">HD Optical Preview · {Math.round(scale * 100)}%</div>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5 bg-gray-900/80 backdrop-blur-md border border-gray-700 px-3 py-1.5 rounded-2xl shadow-xl">
          <button
            onClick={handleZoomIn}
            title="Zoom In (+)"
            className="p-1.5 text-gray-200 hover:text-teal-400 hover:bg-gray-800 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-lg">zoom_in</span>
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            className="p-1.5 text-gray-200 hover:text-teal-400 hover:bg-gray-800 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-lg">zoom_out</span>
          </button>
          <button
            onClick={handleRotate}
            title="Rotate 90°"
            className="p-1.5 text-gray-200 hover:text-teal-400 hover:bg-gray-800 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-lg">rotate_right</span>
          </button>
          <button
            onClick={handleReset}
            title="Reset View (100%)"
            className="p-1.5 text-gray-200 hover:text-teal-400 hover:bg-gray-800 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-lg">restart_alt</span>
          </button>
          <div className="w-[1px] h-5 bg-gray-700 mx-1" />
          <button
            onClick={handleDownload}
            title="Download HD Photo"
            className="p-1.5 text-gray-200 hover:text-emerald-400 hover:bg-gray-800 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-lg">download</span>
          </button>
          <button
            onClick={handlePrint}
            title="Print Image"
            className="p-1.5 text-gray-200 hover:text-blue-400 hover:bg-gray-800 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-lg">print</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-9 h-9 bg-gray-800 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-all shadow-lg ml-2"
          title="Close Viewer (Esc)"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      {/* Main Image Viewport with Pan & Zoom */}
      <div
        className="flex-1 w-full max-w-5xl flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        <img
          src={src}
          alt={alt}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl pointer-events-auto"
          draggable={false}
        />
      </div>

      {/* Bottom Hint */}
      <div className="text-[11px] text-gray-400 pb-2 z-10 text-center">
        Use controls above to Zoom, Rotate, or Download · Click anywhere outside to close
      </div>
    </div>
  );
}
