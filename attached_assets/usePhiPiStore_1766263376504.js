import { create } from 'zustand';
const PHI = 1.618033988749895;
const PI = 3.141592653589793;
export const usePhiPiStore = create((set) => ({
    phi: PHI,
    pi: PI,
    phiStepMultiplier: 0.5,
    piPrecisionThreshold: 0.0008,
    maxSteps: 300,
    maxDistance: 100.0,
    depthScale: 1.5,
    metricExtension: 2.0,
    eigenValue: 2.618,
    zkpProofConsistency: 0.4,
    // VOLUMETRIC MANIFOLD STATE
    stitchDensity: 1.0,
    volumetricDepth: 1.0,
    manifoldContinuity: 0.7,
    resolution: { x: window.innerWidth, y: window.innerHeight },
    time: 0,
    cameraPosition: [0, 0, 8],
    mouse: [0, 0],
    showPhiSteps: false,
    showDistanceField: false,
    showNormals: false,
    performance: {
        fps: 0,
        frameTime: 0,
        stepCount: 0,
    },
    activeAssetType: null,
    assetUrl: null,
    assetTexture: null,
    setPhi: (phi) => set({ phi }),
    setPi: (pi) => set({ pi }),
    setPhiStepMultiplier: (phiStepMultiplier) => set({ phiStepMultiplier }),
    setPiPrecisionThreshold: (piPrecisionThreshold) => set({ piPrecisionThreshold }),
    setMaxSteps: (maxSteps) => set({ maxSteps }),
    setDepthScale: (depthScale) => set({ depthScale }),
    setMetricExtension: (metricExtension) => set({ metricExtension }),
    setEigenValue: (eigenValue) => set({ eigenValue }),
    setZkpProofConsistency: (zkpProofConsistency) => set({ zkpProofConsistency }),
    // VOLUMETRIC MANIFOLD ACTIONS
    setStitchDensity: (stitchDensity) => set({ stitchDensity }),
    setVolumetricDepth: (volumetricDepth) => set({ volumetricDepth }),
    setManifoldContinuity: (manifoldContinuity) => set({ manifoldContinuity }),
    updateTime: (dt) => set((state) => ({ time: state.time + dt })),
    setMouse: (x, y) => set({ mouse: [x, y] }),
    toggleDebug: (key) => set((state) => ({ [key]: !state[key] })),
    setCameraPosition: (cameraPosition) => set({ cameraPosition }),
    updatePerformance: (performance) => set({ performance }),
    setAsset: (type, url = null) => set((state) => {
        if (state.assetUrl && state.assetUrl.startsWith('blob:')) {
            URL.revokeObjectURL(state.assetUrl);
        }
        return { activeAssetType: type, assetUrl: url };
    }),
    setAssetTexture: (assetTexture) => set({ assetTexture }),
}));
