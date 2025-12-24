import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const GeodesicMap = () => {
    const [stars, setStars] = useState([]);
    useEffect(() => {
        const pts = [];
        const count = 120;
        for (let i = 0; i < count; i++) {
            pts.push({
                id: `S_${i}`,
                x: (Math.random() - 0.5) * 1000,
                y: (Math.random() - 0.5) * 1000,
                size: Math.random() * 1.2 + 0.3,
                opacity: Math.random() * 0.5 + 0.1
            });
        }
        setStars(pts);
    }, []);
    return (_jsxs("div", { className: "w-full h-full flex items-center justify-center overflow-hidden", children: [_jsxs("svg", { viewBox: "-500 -500 1000 1000", className: "w-full h-full", children: [[0, 1, 2].map(i => (_jsxs("g", { className: "animate-[spin_60s_linear_infinite]", style: { animationDirection: i % 2 === 0 ? 'normal' : 'reverse', animationDuration: `${40 + i * 20}s` }, children: [_jsx("ellipse", { cx: "0", cy: "0", rx: 320 + i * 60, ry: 140 + i * 25, fill: "none", stroke: "#00f3ff", strokeWidth: "0.5", opacity: 0.15 - i * 0.04, strokeDasharray: "5, 20" }), _jsx("ellipse", { cx: "0", cy: "0", rx: 320 + i * 60, ry: 140 + i * 25, fill: "none", stroke: "#4caf50", strokeWidth: "0.5", opacity: 0.08 })] }, i))), stars.map((star) => (_jsx("circle", { cx: star.x, cy: star.y, r: star.size, fill: Math.random() > 0.5 ? "#00f3ff" : "#4caf50", opacity: star.opacity, className: "animate-pulse", style: { animationDelay: `${Math.random() * 5}s` } }, star.id))), _jsxs("g", { opacity: "0.2", children: [_jsx("circle", { cx: "0", cy: "0", r: "100", fill: "none", stroke: "#00f3ff", strokeWidth: "0.3" }), [0, 60, 120, 180, 240, 300].map(angle => (_jsx("circle", { cx: 100 * Math.cos(angle * Math.PI / 180), cy: 100 * Math.sin(angle * Math.PI / 180), r: "100", fill: "none", stroke: "#4caf50", strokeWidth: "0.3" }, angle)))] })] }), _jsx("style", { children: `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }` })] }));
};
export default GeodesicMap;
