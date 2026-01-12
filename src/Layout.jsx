import React from 'react';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --elora-primary: #7CB342;
          --elora-primary-light: #9CCC65;
          --elora-primary-dark: #689F38;
          --elora-navy: #0F172A;
          --elora-blue: #1E293B;
          --elora-slate: #334155;

          /* Client branding variables (dynamically injected) */
          --client-primary: #2563eb;
          --client-secondary: #1e40af;
        }
        
        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        /* Smooth transitions */
        button, a, input, select {
          transition: all 0.2s ease;
        }
        
        /* Focus states */
        button:focus-visible, input:focus-visible, select:focus-visible {
          outline: 2px solid var(--elora-primary);
          outline-offset: 2px;
        }
      `}</style>
      {children}
    </div>
  );
}