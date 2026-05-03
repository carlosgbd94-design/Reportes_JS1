/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./main.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#003366',
          container: '#d6e3ff',
          on: '#ffffff',
          onContainer: '#001b3d',
        },
        secondary: {
          DEFAULT: '#535f70',
          container: '#d7e3f7',
          on: '#ffffff',
          onContainer: '#101c2b',
        },
        surface: {
          DEFAULT: '#fdfcff',
          on: '#1a1c20',
          variant: '#f1f5f9',
          onVariant: '#43474e',
        },
        outline: {
          DEFAULT: '#73777f',
          variant: '#c3c7cf',
        },
        status: {
          error: '#ba1a1a',
          success: '#006b54',
          info: '#00639b',
          warning: '#7d5700'
        }
      },
      boxShadow: {
        'md3-1': '0 1px 2px 0 rgba(0,0,0,0.05), 0 1px 3px 1px rgba(0,0,0,0.02)',
        'md3-2': '0 4px 6px -1px rgba(0,0,0,0.12), 0 2px 4px -2px rgba(0,0,0,0.08)',
        'md3-3': '0 12px 24px -4px rgba(0,0,0,0.12), 0 8px 16px -4px rgba(0,0,0,0.08)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 8px 20px rgba(0, 0, 0, 0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'md3-card': '16px',
        'md3-pill': '100px',
        'md3-tab': '16px',
      }
    },
  },
  plugins: [],
}
