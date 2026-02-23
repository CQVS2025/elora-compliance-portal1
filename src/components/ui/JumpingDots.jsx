import React from 'react';

/**
 * Three-dot jumping loader to indicate a value is being calculated/updated.
 */
export function JumpingDots({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label="Calculating…">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-jump" style={{ animationDelay: '0s' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-jump" style={{ animationDelay: '0.15s' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-jump" style={{ animationDelay: '0.3s' }} />
    </span>
  );
}
