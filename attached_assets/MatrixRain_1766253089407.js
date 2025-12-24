import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
const MatrixRain = ({ className, speed = 1, fontSize = 16, color = '#00f3ff' }) => {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);
        // Multivector Mathematical Notations & Pure Unicode Symbols (No words, No emojis)
        const chars = 'φψη_rR₄Ψ𝔾₃₂∧∨⊗∘∇∫∂∑∏√∞αβγδεζηθικλμνξοπρςστυφχψωℛℳ𝒢𝒪∇_φφ⁻¹φ²φ³φ⁴⟨⟩•⋆⁺⁻ℏℂℍℕℙℚℝℤℵℶℷℸ∆∇∈∋∎∏∐∑∓∔∕∖∗∘∙√∛∜∝∟∠∡∢∣∤∥∦∩∪∬∭∮∯∰∱∲∳∴∵∶∷∸∹∺∻∼∽∾∿≀≁≂≃≄≅≆≇≈≉≊≋≌≍≎≏≐≑≒≓≔≕≖≗≘≙≚≛≜≝≞≟≠≡≢≣≤≥≦≧≨≩≪≫≬≭≮≯≰≱≲≳≴≵≶≷≸≹≺≻≼≽≾≿⊀⊁⊂⊃⊄⊅⊆⊇⊈⊉⊊⊋⊌⊍⊎⊏⊐⊑⊒⊓⊔⊕⊖⊗⊘⊙⊚⊛⊜⊝⊞⊟⊠⊡⊢⊣⊤⊥⊦⊧⊨⊩⊪⊫⊬⊭⊮⊯⊰⊱⊲⊳⊴⊵⊶⊷⊸⊹⊺⊻⊼⊽⊾⊿⋀⋁⋂⋃⋄⋅⋆⋇⋈⋉⋊⋋⋌⋍⋎⋏⋐⋑⋒⋓⋔⋕⋖⋗⋘⋙⋚⋛⋜⋝⋞⋟⋠⋡⋢⋣⋤⋥⋦⋧⋨⋩⋪⋫⋬⋭⋮⋯⋰⋱₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾';
        const columns = Math.floor(width / fontSize);
        const drops = new Array(columns).fill(1);
        const draw = () => {
            // Background with trail effect
            ctx.fillStyle = 'rgba(1, 4, 1, 0.15)';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = color;
            ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
            for (let i = 0; i < drops.length; i++) {
                const charIndex = Math.floor(Math.random() * chars.length);
                const text = chars[charIndex];
                // Random alpha for "multivector shimmer"
                ctx.globalAlpha = Math.random() > 0.85 ? 1.0 : 0.5;
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                ctx.globalAlpha = 1.0;
                if (drops[i] * fontSize > height && Math.random() > 0.985) {
                    drops[i] = 0;
                }
                drops[i] += speed;
            }
        };
        const interval = setInterval(draw, 50);
        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);
        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', handleResize);
        };
    }, [speed, fontSize, color]);
    return (_jsx("canvas", { ref: canvasRef, className: `fixed inset-0 pointer-events-none ${className}`, style: { filter: 'blur(0.2px)' } }));
};
export default MatrixRain;
