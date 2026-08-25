import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function ClerkAuthControls({ compact = false }) {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-all cursor-pointer whitespace-nowrap"
      >
        <span className="material-symbols-outlined text-base text-teal-700">login</span>
        <span>Staff Login</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-teal-700 to-teal-800 hover:from-teal-800 hover:to-teal-900 text-white transition-all shadow-sm shadow-teal-900/20 cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-sm">login</span>
            <span>Sign In</span>
          </button>
        </SignInButton>
        {!compact && (
          <SignUpButton mode="modal">
            <button
              type="button"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-teal-50 text-teal-900 border border-teal-200 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>Sign Up</span>
            </button>
          </SignUpButton>
        )}
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-all"
          >
            <span className="material-symbols-outlined text-sm">dashboard</span>
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn>
    </div>
  );
}
