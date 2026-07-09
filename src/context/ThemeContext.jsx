import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({});

export const useTheme = () => useContext(ThemeContext);

const COLOR_PALETTES = {
    blue: {
        label: 'Ocean Blue',
        primary: '#2F77C8',
        primaryLight: '#348FDB',
        primaryDark: '#2559A7',
        gradient: 'linear-gradient(to right, #2559A7 0%, #2F77C8 30%, #348FDB 55%, #2F86BF 75%, #2874A6 100%)',
    },
    indigo: {
        label: 'Indigo',
        primary: '#4f46e5',
        primaryLight: '#6366f1',
        primaryDark: '#3730a3',
        gradient: 'linear-gradient(to right, #3730a3 0%, #4f46e5 30%, #6366f1 55%, #818cf8 75%, #4f46e5 100%)',
    },
    emerald: {
        label: 'Emerald',
        primary: '#059669',
        primaryLight: '#10b981',
        primaryDark: '#047857',
        gradient: 'linear-gradient(to right, #047857 0%, #059669 30%, #10b981 55%, #34d399 75%, #059669 100%)',
    },
    rose: {
        label: 'Rose',
        primary: '#e11d48',
        primaryLight: '#f43f5e',
        primaryDark: '#be123c',
        gradient: 'linear-gradient(to right, #be123c 0%, #e11d48 30%, #f43f5e 55%, #fb7185 75%, #e11d48 100%)',
    },
    amber: {
        label: 'Amber',
        primary: '#d97706',
        primaryLight: '#f59e0b',
        primaryDark: '#b45309',
        gradient: 'linear-gradient(to right, #b45309 0%, #d97706 30%, #f59e0b 55%, #fbbf24 75%, #d97706 100%)',
    },
    violet: {
        label: 'Violet',
        primary: '#7c3aed',
        primaryLight: '#8b5cf6',
        primaryDark: '#6d28d9',
        gradient: 'linear-gradient(to right, #6d28d9 0%, #7c3aed 30%, #8b5cf6 55%, #a78bfa 75%, #7c3aed 100%)',
    },
};

export { COLOR_PALETTES };

export function ThemeProvider({ children }) {
    const [mode, setMode] = useState(() => {
        return localStorage.getItem('theme-mode') || 'light';
    });
    const [palette, setPalette] = useState(() => {
        return localStorage.getItem('theme-palette') || 'blue';
    });

    // Apply theme to document
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', mode);

        const colors = COLOR_PALETTES[palette] || COLOR_PALETTES.blue;
        root.style.setProperty('--color-primary', colors.primary);
        root.style.setProperty('--color-primary-light', colors.primaryLight);
        root.style.setProperty('--color-primary-dark', colors.primaryDark);
        root.style.setProperty('--color-gradient', colors.gradient);

        localStorage.setItem('theme-mode', mode);
        localStorage.setItem('theme-palette', palette);
    }, [mode, palette]);

    const toggleMode = () => {
        setMode(prev => prev === 'light' ? 'dark' : 'light');
    };

    const value = {
        mode,
        palette,
        toggleMode,
        setPalette,
        isDark: mode === 'dark',
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
