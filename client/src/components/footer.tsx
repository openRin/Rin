import { useState } from 'react';
type ThemeMode = 'light' | 'dark' | 'system';
function Footer() {
    const [modeState, setModeState] = useState<ThemeMode>('system');

    const setMode = (mode: ThemeMode) => {
        setModeState(mode);
        if (mode === 'system') {
            localStorage.removeItem('theme');
        } else {
            localStorage.theme = mode;
        }

        if (mode !== 'system' || (!('theme' in localStorage) && window.matchMedia(`(prefers-color-scheme: ${mode})`).matches)) {
            document.documentElement.setAttribute('data-color-mode', mode);
        } else {
            document.documentElement.removeAttribute('data-color-mode')
        }
    };

    return (
        <footer>
            <div className="flex flex-col mb-8 space-y-2 justify-center items-center h-16 t-primary">
                <p className="text-sm text-neutral-500 font-normal">
                    © 2024 Powered by <a className='hover:underline' href="https://github.com/OXeu/Rin" target="_blank">Rin</a>
                </p>
                <div className="w-fit-content inline-flex rounded-full border border-zinc-200 p-[3px] dark:border-zinc-700">
                    <ThemeButton mode='light' current={modeState} label="Toggle light mode" icon="ri-sun-line" onClick={setMode} />
                    <ThemeButton mode='system' current={modeState} label="Toggle system mode" icon="ri-computer-line" onClick={setMode} />
                    <ThemeButton mode='dark' current={modeState} label="Toggle dark mode" icon="ri-moon-line" onClick={setMode} />
                </div>
            </div>
        </footer>
    );
};

function ThemeButton({ current, mode, label, icon, onClick }: { current: ThemeMode, label: string, mode: ThemeMode, icon: string, onClick: (mode: ThemeMode) => void }) {
    return (<button aria-label={label} type="button" onClick={() => onClick(mode)}
        className={`rounded-inherit inline-flex h-[32px] w-[32px] items-center justify-center border-0 t-primary ${current === mode ? "bg-w rounded-full shadow-xl shadow-color" : ""}`}>
        <i className={`${icon}`} />
    </button>)
}

export default Footer;