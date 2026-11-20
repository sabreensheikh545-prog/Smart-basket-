import React from 'react';

interface FirstLaunchAuthScreenProps {
  onLogin: () => void;
  onSignUp: () => void;
  onSkip: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const FirstLaunchAuthScreen: React.FC<FirstLaunchAuthScreenProps> = ({
  onLogin,
  onSignUp,
  onSkip,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-between">
      {/* Minimal Top Bar with Subtle Top-Right Skip Link */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-8 pt-4 pb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={onSkip}
          className="min-h-[44px] px-3 inline-flex items-center text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2874F0] rounded-lg transition"
        >
          Skip for now
        </button>
      </header>

      {/* Clean Centered Brand & Two-Action Auth Entry */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm mx-auto text-center">
          {/* Smart Basket Brand Mark */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#2874F0] shadow-sm flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              <i className="fa-solid fa-basket-shopping text-2xl text-white" aria-hidden="true"></i>
              <i
                className="fa-solid fa-bolt text-xs text-[#FFE500] absolute -top-1.5 -right-2"
                aria-hidden="true"
              ></i>
            </div>
          </div>

          <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold italic tracking-tight text-[#2874F0]">
            Smart <span className="text-slate-900 not-italic">Basket</span>{' '}
            <span className="not-italic text-amber-500" aria-hidden="true">
              ⚡
            </span>
          </h1>

          <p className="mt-2.5 text-sm sm:text-[15px] font-semibold text-slate-800 text-balance leading-snug">
            Smart Basket ⚡ – Fast Local &amp; Online Shopping
          </p>

          <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
            Sign in to view your orders, save delivery addresses, and enjoy fast doorstep delivery.
          </p>

          {/* Two Primary Action Buttons Only */}
          <div className="mt-9 space-y-3">
            <button
              type="button"
              onClick={onLogin}
              className="w-full h-12 px-6 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] active:scale-[0.99] text-white text-sm font-bold shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2874F0] transition"
            >
              Login
            </button>

            <button
              type="button"
              onClick={onSignUp}
              className="w-full h-12 px-6 rounded-lg bg-white hover:bg-slate-50 active:scale-[0.99] text-[#2874F0] border border-[#2874F0] text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2874F0] transition"
            >
              Create an Account (Sign Up)
            </button>
          </div>
        </div>
      </main>

      {/* Quiet Legal Footer */}
      <footer className="w-full max-w-md mx-auto px-6 pb-8 pt-4 text-center">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          By continuing, you agree to Smart Basket&apos;s{' '}
          <button
            type="button"
            onClick={onOpenTerms}
            className="text-slate-600 font-medium hover:text-[#2874F0] hover:underline"
          >
            Terms &amp; Conditions
          </button>{' '}
          and{' '}
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="text-slate-600 font-medium hover:text-[#2874F0] hover:underline"
          >
            Privacy Policy
          </button>
          .
        </p>
      </footer>
    </div>
  );
};
