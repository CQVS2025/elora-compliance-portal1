/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		// Apple-style font family
  		fontFamily: {
  			sans: ['SF Pro Display', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  			display: ['SF Pro Display', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  		},
  		// Apple-style border radius
  		borderRadius: {
  			lg: '0.75rem', // 12px
  			md: '0.5rem', // 8px
  			sm: '0.375rem', // 6px
  			xl: '1rem', // 16px
  			'2xl': '1.25rem', // 20px
  			'3xl': '1.5rem', // 24px
  		},
  		// Apple-style box shadows (subtle)
  		boxShadow: {
  			'apple-sm': '0 1px 2px rgba(0, 0, 0, 0.04)',
  			'apple': '0 4px 12px rgba(0, 0, 0, 0.05)',
  			'apple-md': '0 8px 24px rgba(0, 0, 0, 0.08)',
  			'apple-lg': '0 12px 40px rgba(0, 0, 0, 0.12)',
  			'apple-xl': '0 24px 64px rgba(0, 0, 0, 0.16)',
  			'apple-inner': 'inset 0 1px 2px rgba(0, 0, 0, 0.06)',
  			'glass': '0 8px 32px rgba(0, 0, 0, 0.08)',
  			'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.12)',
  		},
  		colors: {
  			// ELORA Brand Colors - Updated for Apple aesthetic
  			'elora-primary': '#10B981', // emerald-500 (main accent)
  			'elora-primary-light': '#34D399', // emerald-400
  			'elora-primary-dark': '#059669', // emerald-600

  			// Apple-style gray scale
  			'apple-gray': {
  				50: '#F9FAFB',
  				100: '#F3F4F6',
  				200: '#E5E7EB',
  				300: '#D1D5DB',
  				400: '#9CA3AF',
  				500: '#6B7280',
  				600: '#4B5563',
  				700: '#374151',
  				800: '#1F2937',
  				900: '#111827',
  				950: '#030712',
  			},

  			// Shadcn UI Colors
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		// Enhanced spacing for Apple's generous padding
  		spacing: {
  			'18': '4.5rem',
  			'22': '5.5rem',
  		},
  		// Apple-style backdrop blur
  		backdropBlur: {
  			xs: '2px',
  			'3xl': '64px',
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			// Apple-style fade in
  			'fade-in': {
  				from: { opacity: '0' },
  				to: { opacity: '1' }
  			},
  			'fade-in-up': {
  				from: { opacity: '0', transform: 'translateY(10px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			// Subtle scale animation
  			'scale-in': {
  				from: { opacity: '0', transform: 'scale(0.95)' },
  				to: { opacity: '1', transform: 'scale(1)' }
  			},
  			// Slide animations
  			'slide-in-right': {
  				from: { opacity: '0', transform: 'translateX(10px)' },
  				to: { opacity: '1', transform: 'translateX(0)' }
  			},
  			'slide-in-left': {
  				from: { opacity: '0', transform: 'translateX(-10px)' },
  				to: { opacity: '1', transform: 'translateX(0)' }
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.3s ease-out',
  			'fade-in-up': 'fade-in-up 0.4s ease-out',
  			'scale-in': 'scale-in 0.2s ease-out',
  			'slide-in-right': 'slide-in-right 0.3s ease-out',
  			'slide-in-left': 'slide-in-left 0.3s ease-out',
  		},
  		// Apple-style transitions
  		transitionDuration: {
  			'250': '250ms',
  			'350': '350ms',
  			'400': '400ms',
  		},
  		transitionTimingFunction: {
  			'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  			'apple-bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
