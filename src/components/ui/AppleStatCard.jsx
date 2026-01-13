import React from 'react';
import { motion } from 'framer-motion';

/**
 * Apple-style Stat Card Component
 * Follows Apple Human Interface Guidelines with glassmorphism, subtle shadows, and fluid animations
 */
export default function AppleStatCard({
  icon: Icon,
  value,
  label,
  trend,
  trendValue,
  index = 0,
  accentColor = 'emerald',
  onClick,
}) {
  const accentColors = {
    emerald: {
      dot: 'bg-emerald-500',
      trend: 'text-emerald-500',
      icon: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    },
    blue: {
      dot: 'bg-blue-500',
      trend: 'text-blue-500',
      icon: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-500/20',
    },
    purple: {
      dot: 'bg-purple-500',
      trend: 'text-purple-500',
      icon: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-100 dark:bg-purple-500/20',
    },
    amber: {
      dot: 'bg-amber-500',
      trend: 'text-amber-500',
      icon: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-500/20',
    },
    gray: {
      dot: 'bg-gray-500',
      trend: 'text-gray-500',
      icon: 'text-gray-600 dark:text-gray-400',
      iconBg: 'bg-gray-100 dark:bg-gray-500/20',
    },
  };

  const colors = accentColors[accentColor] || accentColors.emerald;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0, 0, 0.2, 1],
      }}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`
        backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
        border border-gray-200/20 dark:border-zinc-800/50
        rounded-2xl p-8
        shadow-lg shadow-black/[0.03] dark:shadow-black/20
        hover:shadow-xl hover:shadow-black/[0.06] dark:hover:shadow-black/30
        transition-shadow duration-300
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Header with icon */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {label}
        </p>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.iconBg}`}>
            <Icon className={`w-5 h-5 ${colors.icon}`} />
          </div>
        )}
      </div>

      {/* Large value */}
      <p className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
        {value}
      </p>

      {/* Trend indicator */}
      {trend && (
        <div className="flex items-center gap-2 text-sm">
          <span className={trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
          <span className="text-gray-400 dark:text-gray-500">vs last period</span>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Simple stat card variant for smaller displays
 */
export function AppleStatCardCompact({
  icon: Icon,
  value,
  label,
  accentColor = 'emerald',
  index = 0,
}) {
  const accentColors = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="
        backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
        border border-gray-200/20 dark:border-zinc-800/50
        rounded-xl p-5
        shadow-sm shadow-black/[0.02]
      "
    >
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentColors[accentColor]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}
