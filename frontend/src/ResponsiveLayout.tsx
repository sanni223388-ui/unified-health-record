import React, { useState } from 'react';

interface ResponsiveLayoutProps {
  sidebarContent: React.ReactNode;
  headerContent: React.ReactNode;
  children: React.ReactNode;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  sidebarContent,
  headerContent,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col w-full overflow-x-hidden">
      {/* Mobile Top App Bar (< 1024px) */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        <div className="font-bold text-teal-400 tracking-wide text-base">
          UNIFIEDHEALTH
        </div>

        <div className="flex items-center space-x-2">
          {headerContent}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 relative w-full">
        {/* Backdrop for Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}

        {/* Sidebar: Fixed on Desktop, Slide-over Drawer on Mobile */}
        <aside
          className={`
            fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 p-4 transition-transform duration-300 ease-in-out
            lg:translate-x-0 lg:static lg:z-auto lg:min-h-screen
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex justify-between items-center mb-4 lg:hidden">
            <span className="font-bold text-teal-400 text-sm tracking-wide">NAVIGATION</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div onClick={() => setMobileMenuOpen(false)}>
            {sidebarContent}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 w-full overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Desktop Top Header Bar (>= 1024px) */}
          <div className="hidden lg:flex items-center justify-between pb-6 border-b border-slate-800/80 mb-6">
            <div className="font-bold text-xl text-teal-400 tracking-wider">
              UNIFIEDHEALTH <span className="text-xs text-slate-400 font-normal">Decentralized Healthcare Mesh</span>
            </div>
            <div className="flex items-center space-x-4">
              {headerContent}
            </div>
          </div>

          {/* Page Body */}
          <div className="w-full max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
