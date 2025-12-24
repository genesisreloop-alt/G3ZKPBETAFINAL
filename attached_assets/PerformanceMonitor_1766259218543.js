import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { usePhiPiStore } from '../stores/usePhiPiStore';
export const PerformanceMonitor = () => {
    const updatePerformance = usePhiPiStore((state) => state.updatePerformance);
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());
    const rafId = useRef();
    useEffect(() => {
        const loop = () => {
            frameCount.current++;
            const now = performance.now();
            const delta = now - lastTime.current;
            if (delta >= 1000) {
                const fps = Math.round((frameCount.current * 1000) / delta);
                updatePerformance({
                    fps,
                    frameTime: delta / frameCount.current,
                    stepCount: 0, // Injected via shader usually, but we keep it in interface
                });
                frameCount.current = 0;
                lastTime.current = now;
            }
            rafId.current = requestAnimationFrame(loop);
        };
        rafId.current = requestAnimationFrame(loop);
        return () => {
            if (rafId.current)
                cancelAnimationFrame(rafId.current);
        };
    }, [updatePerformance]);
    const metrics = usePhiPiStore((state) => state.performance);
    return (_jsx("div", { className: "fixed top-4 left-4 z-50 pointer-events-none", children: _jsxs("div", { className: "bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 text-[10px] font-mono uppercase tracking-widest text-white/70", children: [_jsxs("div", { className: "flex justify-between gap-8 mb-1", children: [_jsx("span", { children: "Target" }), _jsx("span", { className: "text-emerald-400", children: "60 FPS" })] }), _jsxs("div", { className: "flex justify-between gap-8 mb-1", children: [_jsx("span", { children: "Actual" }), _jsxs("span", { className: metrics.fps < 30 ? 'text-red-400' : 'text-emerald-400', children: [metrics.fps, " FPS"] })] }), _jsxs("div", { className: "flex justify-between gap-8", children: [_jsx("span", { children: "Latency" }), _jsxs("span", { children: [metrics.frameTime.toFixed(2), " ms"] })] })] }) }));
};
