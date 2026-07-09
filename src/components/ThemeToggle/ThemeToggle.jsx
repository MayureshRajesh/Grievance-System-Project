import { useState } from 'react';
import { useTheme, COLOR_PALETTES } from '../../context/ThemeContext';
import { Sun, Moon, Palette, X } from 'lucide-react';
import './ThemeToggle.css';

function ThemeToggle() {
    const { mode, palette, toggleMode, setPalette, isDark } = useTheme();
    const [showPalette, setShowPalette] = useState(false);

    return (
        <div className="theme-toggle-container">
            {/* Palette Picker Panel */}
            {showPalette && (
                <div className="palette-panel animate-fade-in">
                    <div className="palette-panel-header">
                        <h4>Color Palette</h4>
                        <button className="palette-close" onClick={() => setShowPalette(false)}>
                            <X size={14} />
                        </button>
                    </div>
                    <div className="palette-grid">
                        {Object.entries(COLOR_PALETTES).map(([key, colors]) => (
                            <button
                                key={key}
                                className={`palette-swatch ${palette === key ? 'active' : ''}`}
                                style={{ background: colors.gradient }}
                                onClick={() => {
                                    setPalette(key);
                                    setShowPalette(false);
                                }}
                                title={colors.label}
                            >
                                {palette === key && <span className="swatch-check">✓</span>}
                            </button>
                        ))}
                    </div>
                    <div className="palette-label">
                        {COLOR_PALETTES[palette]?.label || 'Blue'}
                    </div>
                </div>
            )}

            {/* Floating Buttons */}
            <div className="theme-buttons">
                <button
                    className="theme-btn palette-btn"
                    onClick={() => setShowPalette(!showPalette)}
                    title="Color Palette"
                >
                    <Palette size={18} />
                </button>
                <button
                    className="theme-btn mode-btn"
                    onClick={toggleMode}
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
        </div>
    );
}

export default ThemeToggle;
