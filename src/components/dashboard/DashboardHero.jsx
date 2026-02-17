import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Building2 } from 'lucide-react';
import { motion } from 'framer-motion';

/** Greeting based on user's local time (from their device/PC). */
function getGreeting() {
  const hour = new Date().getHours(); // 0–23 in user's local timezone
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night'; // 21:00–04:59 local
}

/**
 * Prominent welcome and organization logo for the Dashboard home page.
 */
export default function DashboardHero({ userName, companyName, companyLogoUrl, lastUpdatedAt }) {
  const firstName = (userName || '').split(/\s+/)[0] || 'there';
  const greeting = getGreeting();
  const lastUpdatedStr = lastUpdatedAt
    ? formatDistanceToNow(typeof lastUpdatedAt === 'number' ? new Date(lastUpdatedAt) : lastUpdatedAt, { addSuffix: false })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/80 shadow-sm overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 p-6 sm:p-8">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-border shadow-inner ${
            companyLogoUrl ? 'w-32 h-32 sm:w-40 sm:h-40 bg-card' : 'w-32 h-32 sm:w-40 sm:h-40 bg-muted/50'
          }`}
        >
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt={companyName || 'Organization'}
              className="w-full h-full object-contain p-3"
            />
          ) : (
            <Building2 className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 text-center sm:text-left min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            {format(new Date(), 'EEEE d MMM yyyy')}
            {companyName && ` · ${companyName}`}
            {lastUpdatedStr && ` · Updated ${lastUpdatedStr} ago`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
