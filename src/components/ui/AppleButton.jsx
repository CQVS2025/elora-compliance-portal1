import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * Apple-style Button Component
 * Following Apple Human Interface Guidelines with pill shapes and subtle interactions
 */
const AppleButton = React.forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'default',
      icon: Icon,
      iconPosition = 'left',
      loading = false,
      disabled = false,
      fullWidth = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: `
        bg-emerald-500 text-white
        hover:bg-emerald-600
        shadow-lg shadow-emerald-500/30
        disabled:bg-emerald-500/50 disabled:shadow-none
      `,
      secondary: `
        bg-gray-100 dark:bg-zinc-800
        text-gray-900 dark:text-white
        hover:bg-gray-200 dark:hover:bg-zinc-700
        disabled:bg-gray-100/50 dark:disabled:bg-zinc-800/50
      `,
      ghost: `
        text-blue-500
        hover:bg-blue-500/10
        disabled:text-blue-500/50
      `,
      destructive: `
        bg-red-500/10 text-red-500
        hover:bg-red-500/20
        disabled:bg-red-500/5 disabled:text-red-500/50
      `,
      destructiveSolid: `
        bg-red-500 text-white
        hover:bg-red-600
        shadow-lg shadow-red-500/30
        disabled:bg-red-500/50 disabled:shadow-none
      `,
      outline: `
        border-2 border-gray-200 dark:border-zinc-700
        text-gray-900 dark:text-white
        hover:bg-gray-100 dark:hover:bg-zinc-800
        disabled:border-gray-200/50 dark:disabled:border-zinc-700/50
      `,
      link: `
        text-blue-500 underline-offset-4
        hover:underline
        disabled:text-blue-500/50
      `,
    };

    const sizes = {
      sm: 'h-9 px-4 text-sm',
      default: 'h-11 px-6 text-sm',
      lg: 'h-12 px-8 text-base',
      icon: 'h-10 w-10 p-0',
      iconSm: 'h-8 w-8 p-0',
      iconLg: 'h-12 w-12 p-0',
    };

    const isIconOnly = size === 'icon' || size === 'iconSm' || size === 'iconLg';

    return (
      <motion.button
        ref={ref}
        whileTap={!disabled && !loading ? { scale: 0.95 } : undefined}
        transition={{ duration: 0.1 }}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          rounded-full font-semibold
          transition-all duration-150
          disabled:cursor-not-allowed disabled:opacity-60
          ${variants[variant]}
          ${sizes[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {!isIconOnly && <span>Loading...</span>}
          </>
        ) : (
          <>
            {Icon && iconPosition === 'left' && <Icon className={isIconOnly ? 'w-5 h-5' : 'w-4 h-4'} />}
            {!isIconOnly && children}
            {Icon && iconPosition === 'right' && <Icon className={isIconOnly ? 'w-5 h-5' : 'w-4 h-4'} />}
          </>
        )}
      </motion.button>
    );
  }
);

AppleButton.displayName = 'AppleButton';

export default AppleButton;

/**
 * Icon Button variant for toolbar/action buttons
 */
export function IconButton({
  icon: Icon,
  variant = 'secondary',
  size = 'icon',
  tooltip,
  ...props
}) {
  return (
    <AppleButton
      variant={variant}
      size={size}
      icon={Icon}
      title={tooltip}
      {...props}
    />
  );
}

/**
 * Button Group for related actions
 */
export function ButtonGroup({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Segmented Control (iOS-style toggle button group)
 */
export function SegmentedControl({ options, value, onChange, className = '' }) {
  return (
    <div
      className={`
        inline-flex p-1 rounded-full
        bg-gray-100 dark:bg-zinc-800
        ${className}
      `}
    >
      {options.map((option) => (
        <motion.button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            relative h-9 px-4 rounded-full text-sm font-medium
            transition-colors duration-200
            ${
              value === option.value
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
        >
          {value === option.value && (
            <motion.div
              layoutId="segmented-control-active"
              className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-full shadow-sm"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10">{option.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
