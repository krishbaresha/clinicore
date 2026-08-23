import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Zoom, Keyboard } from "swiper/modules";

// Swiper CSS
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/zoom";

/**
 * Enterprise Medical HD Image & Report Swiper Lightbox
 * Features:
 * - Swiper.js Touch / Mouse Swipe Carousel for multi-page documents
 * - Built-in Multi-Level Optical Zoom & Step Rotation
 * - Thumbnail / Dot Pagination & Keyboard Arrow Navigation
 * - 1-Click HD Download & Direct Browser Print
 */
export default function PhotoLightbox({
  src,
  images = [],
  initialIndex = 0,
  alt = "Medical Document",
  onClose,
}) {
  const imageList = images.length > 0 ? images : src ? [src] : [];
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [rotation, setRotation] = useState(0);

  if (imageList.length === 0) return null;

  function handleRotate() {
    setRotation((prev) => (prev + 90) % 360);
  }

  function handleReset() {
    setRotation(0);
  }

  function handleDownload() {
    const currentSrc = imageList[activeIndex] || imageList[0];
    const link = document.createElement("a");
    link.href = currentSrc;
    link.download = `medical_document_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    const currentSrc = imageList[activeIndex] || imageList[0];
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Print Medical Document</title>
            <style>
              body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #fff; }
              img { max-width: 100%; max-height: 100%; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${currentSrc}" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      win.document.close();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between select-none animate-fadeIn"
      onClick={onClose}
    >
      {/* Top Floating Header & Controls */}
      <div
        className="w-full flex items-center justify-between text-white z-20 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-600/30 text-teal-400 border border-teal-500/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">medical_information</span>
          </div>
          <div>
            <div className="font-bold text-sm text-gray-100 flex items-center gap-2">
              <span>{alt}</span>
              {imageList.length > 1 && (
                <span className="text-[11px] font-mono bg-white/10 px-2 py-0.5 rounded-full text-teal-300 border border-white/10">
                  {activeIndex + 1} / {imageList.length}
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-400">Swiper Touch Lightbox · Pinch / Double-click to Zoom</div>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-md border border-gray-700/80 px-3 py-1.5 rounded-2xl shadow-2xl">
          <button
            onClick={handleRotate}
            title="Rotate 90°"
            className="p-2 text-gray-200 hover:text-teal-400 hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">rotate_right</span>
          </button>
          <button
            onClick={handleReset}
            title="Reset Rotation (0°)"
            className="p-2 text-gray-200 hover:text-teal-400 hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">restart_alt</span>
          </button>
          <div className="w-[1px] h-5 bg-gray-700 mx-1" />
          <button
            onClick={handleDownload}
            title="Download HD Photo"
            className="p-2 text-gray-200 hover:text-emerald-400 hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">download</span>
          </button>
          <button
            onClick={handlePrint}
            title="Print Document"
            className="p-2 text-gray-200 hover:text-cyan-400 hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">print</span>
          </button>
          <button
            onClick={onClose}
            title="Close Lightbox (ESC)"
            className="p-2 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-xl transition-all ml-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>

      {/* Main Swiper Canvas */}
      <div
        className="w-full flex-1 flex items-center justify-center p-2 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Swiper
          modules={[Navigation, Pagination, Zoom, Keyboard]}
          zoom={true}
          keyboard={{ enabled: true }}
          navigation={imageList.length > 1}
          pagination={imageList.length > 1 ? { clickable: true, dynamicBullets: true } : false}
          initialSlide={initialIndex}
          onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
          className="w-full h-full flex items-center justify-center"
        >
          {imageList.map((imgUrl, idx) => (
            <SwiperSlide key={idx} className="flex items-center justify-center h-full">
              <div className="swiper-zoom-container flex items-center justify-center w-full h-full">
                <img
                  src={imgUrl}
                  alt={`${alt} - Page ${idx + 1}`}
                  style={{ transform: `rotate(${rotation}deg)` }}
                  className="max-h-[82vh] max-w-[92vw] object-contain rounded-xl shadow-2xl transition-transform duration-200 select-none"
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Footer Info */}
      <div
        className="w-full text-center py-2 text-[11px] text-gray-400 bg-gradient-to-t from-black/80 to-transparent z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <span>Swipe left/right or use keyboard arrows to navigate · Double-tap to zoom</span>
      </div>
    </div>
  );
}
