import { useTranslation } from "react-i18next";

export default function LanguageSwitcher({ compact = false }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const isHinglish = currentLang.startsWith("ur");

  function toggleLanguage() {
    const nextLang = isHinglish ? "en" : "ur";
    i18n.changeLanguage(nextLang);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        className="w-10 h-10 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 flex items-center justify-center font-black text-xs transition-colors shadow-xs cursor-pointer"
        title={isHinglish ? "Switch to English" : "Switch to Hinglish (Roman Urdu)"}
      >
        {isHinglish ? "🇵🇰" : "🇬🇧"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-950 border border-teal-200 text-xs font-black transition-all shadow-xs cursor-pointer select-none"
      title="Toggle Language: English / Hinglish (Roman Urdu)"
    >
      <span className="text-sm">{isHinglish ? "🇵🇰" : "🇬🇧"}</span>
      <span className="tracking-wide">
        {isHinglish ? "Hinglish (Roman Urdu)" : "English"}
      </span>
      <span className="material-symbols-outlined text-sm text-teal-600">sync_alt</span>
    </button>
  );
}
