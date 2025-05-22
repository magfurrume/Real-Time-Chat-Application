// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}" // Ensure this covers your layout files
  ],
  theme: {
    extend: {
        colors: {
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
            // Add the new success color here
            success: {
                DEFAULT: 'hsl(var(--success))',
                foreground: 'hsl(var(--success-foreground))',
            },
            // Add specific colors for chat elements if you want more granular control
            chat: {
                'bubble-friend-bg': 'hsl(var(--chat-bubble-friend-bg))',
                'bubble-friend-border': 'hsl(var(--chat-bubble-friend-border))',
                'bubble-friend-text': 'hsl(var(--chat-bubble-friend-text))',
                'avatar-blue-light': 'hsl(var(--avatar-blue-light))',
                'avatar-blue-dark': 'hsl(var(--avatar-blue-dark))',
                'avatar-orange-light': 'hsl(var(--avatar-orange-light))',
                'avatar-orange-dark': 'hsl(var(--avatar-orange-dark))',
            },
            // You can remove or keep your sidebar specific colors if they are not used
            // sidebar: {
            //     DEFAULT: 'hsl(var(--sidebar-background))',
            //     foreground: 'hsl(var(--sidebar-foreground))',
            //     primary: 'hsl(var(--sidebar-primary))',
            //     'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
            //     accent: 'hsl(var(--sidebar-accent))',
            //     'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
            //     border: 'hsl(var(--sidebar-border))',
            //     ring: 'hsl(var(--sidebar-ring))'
            // }
        },
        borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)',
            // Add custom large border radii
            'xl': '1.25rem', // 20px
            '2xl': '1.5rem', // 24px
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
            // Add keyframes for custom animations
            fadeIn: {
                from: { opacity: '0', transform: 'translateY(10px)' },
                to: { opacity: '1', transform: 'translateY(0)' },
            },
            pulseSlow: {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.05)' },
            },
        },
        animation: {
            'accordion-down': 'accordion-down 0.2s ease-out',
            'accordion-up': 'accordion-up 0.2s ease-out',
            // Add custom animations
            'fade-in': 'fadeIn 0.3s ease-out forwards',
            'pulse-slow': 'pulseSlow 3s infinite ease-in-out',
        }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;