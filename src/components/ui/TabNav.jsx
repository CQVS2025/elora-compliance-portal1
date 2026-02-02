import React from 'react';
import { motion } from 'framer-motion';

/**
 * Apple-style Pill Tab Navigation
 * iOS/macOS style horizontal scrolling tab navigation with pill-shaped active indicator
 */
export default function TabNav({ tabs, activeTab, onChange, className = '' }) {
  return (
    <nav
      className={`
        flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide
        ${className}
      `}
    >
      {tabs.map((tab) => (
        <TabNavItem
          key={tab.value}
          tab={tab}
          isActive={activeTab === tab.value}
          onClick={() => onChange(tab.value)}
        />
      ))}
    </nav>
  );
}

function TabNavItem({ tab, isActive, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`
        relative h-10 px-4 rounded-full
        text-sm font-medium whitespace-nowrap
        transition-colors duration-200
        ${
          isActive
            ? 'text-white'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800'
        }
      `}
    >
      {isActive && (
        <motion.div
          layoutId="tab-nav-pill"
          className="absolute inset-0 bg-primary rounded-full shadow-md"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {tab.icon && <tab.icon className="w-4 h-4" />}
        {tab.label}
        {tab.badge !== undefined && (
          <span
            className={`
              ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold
              ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300'}
            `}
          >
            {tab.badge}
          </span>
        )}
      </span>
    </motion.button>
  );
}

/**
 * Underline Tab Navigation - Alternative style with underline indicator
 */
export function TabNavUnderline({ tabs, activeTab, onChange, className = '' }) {
  return (
    <nav
      className={`
        flex items-center gap-1 border-b border-gray-200 dark:border-zinc-800
        ${className}
      `}
    >
      {tabs.map((tab) => (
        <motion.button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`
            relative px-4 py-3 text-sm font-medium
            transition-colors duration-200
            ${
              activeTab === tab.value
                ? 'text-primary'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
        >
          {tab.label}
          {activeTab === tab.value && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </motion.button>
      ))}
    </nav>
  );
}

/**
 * Compact Tab Navigation - For smaller spaces
 */
export function TabNavCompact({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div
      className={`
        inline-flex p-1 rounded-xl
        bg-gray-100 dark:bg-zinc-800
        ${className}
      `}
    >
      {tabs.map((tab) => (
        <motion.button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`
            relative h-8 px-3 rounded-lg text-sm font-medium
            transition-colors duration-200
            ${
              activeTab === tab.value
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
        >
          {activeTab === tab.value && (
            <motion.div
              layoutId="tab-compact-active"
              className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-lg shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

/**
 * Period Selector - For date range selection (Today/Week/Month)
 */
export function PeriodSelector({ periods, activePeriod, onChange, className = '' }) {
  return (
    <div
      className={`
        inline-flex items-center gap-1 p-1 rounded-full
        bg-gray-100 dark:bg-zinc-800
        ${className}
      `}
    >
      {periods.map((period) => (
        <motion.button
          key={period}
          onClick={() => onChange(period)}
          whileTap={{ scale: 0.95 }}
          className={`
            relative h-9 px-4 rounded-full text-sm font-medium
            transition-colors duration-200
            ${
              activePeriod === period
                ? 'text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
        >
          {activePeriod === period && (
            <motion.div
              layoutId="period-selector-active"
              className="absolute inset-0 bg-primary rounded-full shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{period}</span>
        </motion.button>
      ))}
    </div>
  );
}
