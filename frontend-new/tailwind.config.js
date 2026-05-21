/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F7F3E8',
        'morandi-pink': '#D4A5A5',
        'morandi-green': '#A5C4A5',
        'morandi-blue': '#A5A5C4',
        'morandi-yellow': '#D4C4A5',
        'morandi-purple': '#B8A5C4',
      },
      borderRadius: {
        '4xl': '32px',
        '5xl': '40px',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
