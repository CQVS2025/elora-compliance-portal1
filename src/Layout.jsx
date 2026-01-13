import React from 'react';

/**
 * Layout Component - Apple-style base wrapper
 * Provides consistent styling and transitions across all pages
 */
export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <style>{`
        :root {
          /* ELORA Brand Colors - Apple aesthetic */
          --elora-primary: #10B981;
          --elora-primary-light: #34D399;
          --elora-primary-dark: #059669;

          /* Client branding variables (dynamically injected) */
          --client-primary: #10B981;
          --client-secondary: #059669;
        }

        /* Apple-style font stack */
        * {
          font-family: 'SF Pro Display', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Smooth rendering */
        html {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }

        /* Apple-style thin scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        .dark ::-webkit-scrollbar-thumb {
          background: #3f3f46;
        }

        .dark ::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }

        /* Smooth transitions for interactive elements */
        button, a, input, select, textarea {
          transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
        }

        /* Apple-style focus states */
        button:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: none;
          ring: 2px solid rgba(16, 185, 129, 0.4);
          ring-offset: 2px;
        }

        /* Remove tap highlight on mobile */
        * {
          -webkit-tap-highlight-color: transparent;
        }

        /* Selection color */
        ::selection {
          background: rgba(16, 185, 129, 0.2);
          color: inherit;
        }
      `}</style>
      {children}
    </div>
  );
}
