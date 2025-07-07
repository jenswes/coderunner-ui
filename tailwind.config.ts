module.exports = {
  extend: {
    animation: {
      spinner: 'spinner 1s linear infinite',
    },
    keyframes: {
      spinner: {
        '0%': { opacity: '1' },
        '10%': { opacity: '0.7' },
        '20%': { opacity: '0.3' },
        '35%': { opacity: '0.2' },
        '50%': { opacity: '0.1' },
        '75%': { opacity: '0.05' },
        '100%': { opacity: '0' },
      },
    },
  },
}