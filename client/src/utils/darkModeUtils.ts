export function listenSystemMode() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    function darkModeHandler() {
        const mode = localStorage.getItem('theme')
        if (mode === null || mode === 'system') {
            if (mediaQuery.matches) {
                document.documentElement.setAttribute('data-color-mode', 'dark');
            } else {
                document.documentElement.setAttribute('data-color-mode', 'light');
            }
        }
    }

    // 判断当前模式
    darkModeHandler()
    // 监听模式变化
    mediaQuery.addEventListener('change', darkModeHandler)
}