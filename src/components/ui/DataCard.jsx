import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

/**
 * Apple-style Data Card Component
 * Replaces table rows with spacious, interactive card-style list items
 */
export default function DataCard({
  children,
  onClick,
  className = '',
  index = 0,
  showChevron = true,
  disabled = false,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.03,
        ease: [0, 0, 0.2, 1],
      }}
      whileHover={!disabled ? { scale: 1.01 } : undefined}
      whileTap={!disabled && onClick ? { scale: 0.99 } : undefined}
      onClick={!disabled ? onClick : undefined}
      className={`
        bg-card border border-border
        rounded-xl p-5
        shadow-sm shadow-black/[0.02]
        hover:shadow-md hover:shadow-black/[0.04]
        hover:bg-card
        transition-all duration-200
        ${onClick && !disabled ? 'cursor-pointer' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">{children}</div>
        {showChevron && onClick && !disabled && (
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-4" />
        )}
      </div>
    </motion.div>
  );
}

/**
 * Vehicle Data Card - Specifically designed for vehicle list items
 */
export function VehicleDataCard({
  registration,
  siteName,
  lastWash,
  washCount,
  target,
  isCompliant,
  onClick,
  index = 0,
}) {
  const compliancePercent = target > 0 ? Math.round((washCount / target) * 100) : 0;

  return (
    <DataCard onClick={onClick} index={index}>
      <div className="flex items-center gap-4">
        {/* Status indicator */}
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 ${
            isCompliant ? 'bg-primary' : 'bg-amber-500'
          }`}
        />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <p className="font-semibold text-lg text-foreground truncate">
              {registration}
            </p>
            {isCompliant && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                Compliant
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {siteName && <span>{siteName} · </span>}
            Last wash: {lastWash || 'Never'}
          </p>
        </div>

        {/* Metric */}
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-foreground">
            {washCount}
            <span className="text-sm font-normal text-muted-foreground">/{target}</span>
          </p>
          <p className="text-xs text-muted-foreground">washes</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(compliancePercent, 100)}%` }}
          transition={{ duration: 0.8, delay: index * 0.05, ease: 'easeOut' }}
          className={`h-full rounded-full ${
            isCompliant
              ? 'bg-primary'
              : compliancePercent >= 75
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
        />
      </div>
    </DataCard>
  );
}

/**
 * Activity Data Card - For recent activity items
 */
export function ActivityDataCard({
  icon: Icon,
  title,
  description,
  timestamp,
  type = 'default',
  onClick,
  index = 0,
}) {
  const typeStyles = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    error: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
    info: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
    default: 'bg-muted text-muted-foreground',
  };

  return (
    <DataCard onClick={onClick} index={index} showChevron={!!onClick}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeStyles[type]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{title}</p>
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        </div>
        {timestamp && (
          <p className="text-xs text-muted-foreground flex-shrink-0">{timestamp}</p>
        )}
      </div>
    </DataCard>
  );
}

/**
 * Container for staggered card animations
 */
export function DataCardList({ children, className = '' }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.03,
          },
        },
      }}
      className={`space-y-3 ${className}`}
    >
      {children}
    </motion.div>
  );
}
