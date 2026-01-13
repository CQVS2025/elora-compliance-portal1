// ELORA Fleet Compliance Portal - Apple UI/UX Design System
// Following Apple's Human Interface Guidelines

export const colors = {
  // Light Mode
  light: {
    background: '#FFFFFF',
    backgroundSecondary: '#F9FAFB', // gray-50
    backgroundTertiary: '#F3F4F6', // gray-100
    text: '#111827', // gray-900
    textSecondary: '#6B7280', // gray-500
    textTertiary: '#9CA3AF', // gray-400
    accent: '#10B981', // emerald-500 (ELORA green for compliance)
    accentLight: '#D1FAE5', // emerald-100
    interactive: '#3B82F6', // blue-500
    interactiveHover: '#2563EB', // blue-600
    border: '#E5E7EB', // gray-200
    borderLight: '#F3F4F6', // gray-100
    destructive: '#EF4444', // red-500
    destructiveLight: '#FEE2E2', // red-100
    warning: '#F59E0B', // amber-500
    warningLight: '#FEF3C7', // amber-100
  },

  // Dark Mode
  dark: {
    background: '#0A0A0A', // zinc-950
    backgroundSecondary: '#18181B', // zinc-900
    backgroundTertiary: '#27272A', // zinc-800
    text: '#FFFFFF',
    textSecondary: '#A1A1AA', // zinc-400
    textTertiary: '#71717A', // zinc-500
    accent: '#10B981', // emerald-500
    accentLight: '#064E3B', // emerald-900
    interactive: '#60A5FA', // blue-400
    interactiveHover: '#3B82F6', // blue-500
    border: '#27272A', // zinc-800
    borderLight: '#3F3F46', // zinc-700
    destructive: '#F87171', // red-400
    destructiveLight: '#450A0A', // red-950
    warning: '#FBBF24', // amber-400
    warningLight: '#451A03', // amber-950
  },
};

export const typography = {
  // Font sizes with corresponding line heights
  heading1: 'text-4xl font-bold leading-tight', // 36px
  heading2: 'text-2xl font-semibold leading-snug', // 24px
  heading3: 'text-xl font-semibold leading-snug', // 20px
  heading4: 'text-lg font-semibold leading-normal', // 18px
  body: 'text-base leading-relaxed', // 16px
  bodySmall: 'text-sm leading-relaxed', // 14px
  caption: 'text-xs leading-normal', // 12px

  // Font family
  fontFamily: "font-['SF_Pro_Display','Inter','system-ui','-apple-system','BlinkMacSystemFont',sans-serif]",
};

export const spacing = {
  // Use Tailwind's spacing scale
  xs: '2', // 8px
  sm: '3', // 12px
  md: '4', // 16px
  lg: '6', // 24px
  xl: '8', // 32px
  '2xl': '12', // 48px
  '3xl': '16', // 64px
};

export const shadows = {
  // Apple-style subtle shadows
  card: 'shadow-lg shadow-black/5',
  cardHover: 'shadow-xl shadow-black/10',
  cardActive: 'shadow-md shadow-black/5',
  modal: 'shadow-2xl shadow-black/20',
  dropdown: 'shadow-xl shadow-black/10',
  button: 'shadow-md shadow-black/5',
  buttonAccent: 'shadow-lg shadow-emerald-500/30',
};

export const borderRadius = {
  small: 'rounded-lg', // 8px
  medium: 'rounded-xl', // 12px
  large: 'rounded-2xl', // 16px
  extraLarge: 'rounded-3xl', // 24px
  full: 'rounded-full', // pill shape
};

export const animation = {
  // Spring physics for Framer Motion
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  },
  springGentle: {
    type: 'spring',
    stiffness: 200,
    damping: 25,
  },
  springBouncy: {
    type: 'spring',
    stiffness: 400,
    damping: 20,
  },

  // Standard timing
  duration: {
    fast: 0.15,
    normal: 0.3,
    slow: 0.5,
  },

  // Easing
  easing: {
    easeOut: [0, 0, 0.2, 1],
    easeInOut: [0.4, 0, 0.2, 1],
  },
};

// Glassmorphism effect classes
export const glass = {
  light: 'backdrop-blur-xl bg-white/80 border border-gray-200/20',
  dark: 'backdrop-blur-xl bg-zinc-900/80 border border-zinc-800/50',
  header: 'backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-b border-gray-200/20 dark:border-zinc-800/50',
  card: 'backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/20 dark:border-zinc-800/50',
  modal: 'backdrop-blur-xl bg-white dark:bg-zinc-900',
};

// Button variants
export const buttonVariants = {
  primary: `
    h-11 px-6 rounded-full bg-emerald-500 text-white font-semibold text-sm
    hover:bg-emerald-600 active:scale-95 transition-all duration-150
    shadow-lg shadow-emerald-500/30
  `,
  secondary: `
    h-11 px-6 rounded-full bg-gray-100 dark:bg-zinc-800
    text-gray-900 dark:text-white font-semibold text-sm
    hover:bg-gray-200 dark:hover:bg-zinc-700
    active:scale-95 transition-all duration-150
  `,
  ghost: `
    h-11 px-6 rounded-full text-blue-500 font-semibold
    hover:bg-blue-500/10 active:scale-95
    transition-all duration-150
  `,
  destructive: `
    h-11 px-6 rounded-full bg-red-500/10 text-red-500
    font-semibold hover:bg-red-500/20 active:scale-95
    transition-all duration-150
  `,
  icon: `
    w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800
    flex items-center justify-center
    hover:bg-gray-200 dark:hover:bg-zinc-700
    active:scale-95 transition-all duration-150
  `,
};

// Input styles
export const inputStyles = {
  base: `
    w-full h-11 px-4 rounded-xl
    bg-gray-100 dark:bg-zinc-900
    border border-gray-200 dark:border-zinc-800
    focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    transition-all outline-none text-base
    placeholder:text-gray-400 dark:placeholder:text-zinc-500
  `,
  label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
  helper: 'text-xs text-gray-500 mt-1',
  error: 'text-xs text-red-500 mt-1',
};

// Card styles
export const cardStyles = {
  base: `
    backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
    border border-gray-200/20 dark:border-zinc-800/50
    rounded-2xl p-6 shadow-lg shadow-black/5
    hover:shadow-xl hover:shadow-black/10 transition-shadow
  `,
  interactive: `
    backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
    border border-gray-200/20 dark:border-zinc-800/50
    rounded-xl p-5 shadow-sm hover:shadow-md
    hover:bg-white dark:hover:bg-zinc-900
    transition-all cursor-pointer
  `,
  stat: `
    backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
    border border-gray-200/20 dark:border-zinc-800/50
    rounded-2xl p-8 shadow-lg shadow-black/5
    hover:shadow-xl hover:shadow-black/10 transition-shadow
  `,
};

// Framer Motion variants for animations
export const motionVariants = {
  // Page transitions
  page: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.3, ease: 'easeInOut' },
  },

  // Card entrance
  card: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' },
  },

  // Hover effects
  cardHover: {
    scale: 1.02,
    transition: { duration: 0.2, ease: 'easeOut' },
  },

  cardTap: {
    scale: 0.98,
  },

  // Button press
  buttonTap: {
    scale: 0.95,
  },

  // Stagger children
  staggerContainer: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  },

  staggerItem: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  },

  // Modal
  modalOverlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },

  modalContent: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 },
  },
};

// Export utility function to combine classes
export const cn = (...classes) => classes.filter(Boolean).join(' ');
