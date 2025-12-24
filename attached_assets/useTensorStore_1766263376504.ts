/**
 * G3°PhiPiSud Tensor Store
 * Complete Zustand state management for the Tensor Coordinate and Flower of Life system
 */

import { create } from 'zustand';
import { Vector2 } from 'three';
import {
  TensorStore,
  TensorField,
  FlowerOfLifePattern,
  TensorPerformanceMetrics,
  GeometricProductResult,
  TensorPixel
} from '../types/tensorTypes';
import { 
  processImageToTensorField, 
  batchGeometricProducts,
  createTensorPixel
} from '../utils/geometricAlgebra';
import { 
  generateFlowerOfLifePattern, 
  optimizeRays,
  processWithFlowerOfLifeOptimization
} from '../utils/flowerOfLife';

// Mathematical constants
const PHI = 1.618033988749895;
const PI = 3.141592653589793;

// Default tensor performance metrics
const defaultTensorPerformance: TensorPerformanceMetrics = {
  fps: 0,
  frameTime: 0,
  stepCount: 0,
  tensorOperations: 0,
  geometricProducts: 0,
  activeRays: 0,
  tensorFieldSize: 0,
  optimizationRatio: 1
};

export const useTensorStore = create<TensorStore>((set, get) => ({
  // ============================================================================
  // PHI-PI STATE (Original)
  // ============================================================================
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
  showTensorField: false,
  showFlowerOfLife: false,
  performance: {
    fps: 0,
    frameTime: 0,
    stepCount: 0
  },
  activeAssetType: null,
  assetUrl: null,
  assetTexture: null,

  // ============================================================================
  // TENSOR SYSTEM STATE
  // ============================================================================
  tensorRank: 3,
  flowerOfLifeGenerations: 3,
  geometricProductThreshold: 100.0,
  tensorFieldResolution: 256,
  piRayDensity: 1.0,
  coordinateInvariance: true,
  bivectorScale: 1.0,
  trivectorScale: 1.0,
  tensorMagnitude: 1.0,
  flowerOfLifeActive: true,
  flowerOfLifeRotation: 0.0,
  sacredGeometryScale: 1.0,
  computationalOptimization: true,
  tensorFieldCulling: true,
  geometricProductBatching: true,
  tensorField: null,
  flowerOfLifePattern: null,
  tensorPerformance: defaultTensorPerformance,

  // ============================================================================
  // PHI-PI ACTIONS (Original)
  // ============================================================================
  setPhi: (phi) => set({ phi }),
  setPi: (pi) => set({ pi }),
  setPhiStepMultiplier: (phiStepMultiplier) => set({ phiStepMultiplier }),
  setPiPrecisionThreshold: (piPrecisionThreshold) => set({ piPrecisionThreshold }),
  setMaxSteps: (maxSteps) => set({ maxSteps }),
  setDepthScale: (depthScale) => set({ depthScale }),
  setMetricExtension: (metricExtension) => set({ metricExtension }),
  setEigenValue: (eigenValue) => set({ eigenValue }),
  setZkpProofConsistency: (zkpProofConsistency) => set({ zkpProofConsistency }),
  setStitchDensity: (stitchDensity) => set({ stitchDensity }),
  setVolumetricDepth: (volumetricDepth) => set({ volumetricDepth }),
  setManifoldContinuity: (manifoldContinuity) => set({ manifoldContinuity }),
  
  updateTime: (dt) => set((state) => ({ time: state.time + dt })),
  setMouse: (x, y) => set({ mouse: [x, y] }),
  toggleDebug: (key) => set((state) => ({ [key]: !state[key] } as any)),
  setCameraPosition: (cameraPosition) => set({ cameraPosition }),
  updatePerformance: (performance) => set({ performance }),
  
  setAsset: (type, url = null) => set((state) => {
    if (state.assetUrl && state.assetUrl.startsWith('blob:')) {
      URL.revokeObjectURL(state.assetUrl);
    }
    return { activeAssetType: type, assetUrl: url };
  }),
  
  setAssetTexture: (assetTexture) => set({ assetTexture }),

  // ============================================================================
  // TENSOR SYSTEM ACTIONS
  // ============================================================================
  setTensorRank: (tensorRank) => set({ tensorRank }),
  setFlowerOfLifeGenerations: (flowerOfLifeGenerations) => {
    set({ flowerOfLifeGenerations });
    // Auto-update pattern when generations change
    get().updateFlowerOfLifeRays();
  },
  setGeometricProductThreshold: (geometricProductThreshold) => set({ geometricProductThreshold }),
  setTensorFieldResolution: (tensorFieldResolution) => set({ tensorFieldResolution }),
  setPiRayDensity: (piRayDensity) => set({ piRayDensity }),
  setCoordinateInvariance: (coordinateInvariance) => set({ coordinateInvariance }),
  setBivectorScale: (bivectorScale) => set({ bivectorScale }),
  setTrivectorScale: (trivectorScale) => set({ trivectorScale }),
  setTensorMagnitude: (tensorMagnitude) => set({ tensorMagnitude }),
  setFlowerOfLifeActive: (flowerOfLifeActive) => set({ flowerOfLifeActive }),
  setFlowerOfLifeRotation: (flowerOfLifeRotation) => {
    set({ flowerOfLifeRotation });
    // Auto-update pattern when rotation changes
    get().updateFlowerOfLifeRays();
  },
  setSacredGeometryScale: (sacredGeometryScale) => {
    set({ sacredGeometryScale });
    // Auto-update pattern when scale changes
    get().updateFlowerOfLifeRays();
  },
  setComputationalOptimization: (computationalOptimization) => set({ computationalOptimization }),
  setTensorFieldCulling: (tensorFieldCulling) => set({ tensorFieldCulling }),
  setGeometricProductBatching: (geometricProductBatching) => set({ geometricProductBatching }),

  /**
   * Processes image data into a tensor field
   */
  processTensorField: (imageData: ImageData, width: number, height: number) => {
    const startTime = performance.now();
    const state = get();
    
    try {
      // Process image to tensor field
      const tensorField = processImageToTensorField(imageData, state.tensorFieldResolution);
      
      // Update state with new tensor field
      set({ tensorField });
      
      // Update Flower of Life pattern to work with new tensor field
      if (state.flowerOfLifeActive) {
        const center = new Vector2(0, 0);
        let pattern = generateFlowerOfLifePattern(
          center,
          state.flowerOfLifeGenerations,
          state.pi,
          state.phi,
          state.sacredGeometryScale,
          state.flowerOfLifeRotation
        );
        
        // Optimize rays if culling is enabled
        if (state.tensorFieldCulling) {
          const optimizedRays = optimizeRays(
            pattern.rays,
            tensorField,
            state.geometricProductThreshold,
            0.1
          );
          pattern = { ...pattern, rays: optimizedRays };
        }
        
        set({ flowerOfLifePattern: pattern });
      }
      
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      set((s) => ({
        tensorPerformance: {
          ...s.tensorPerformance,
          tensorFieldSize: tensorField.pixels.length,
          frameTime: processingTime
        }
      }));
      
    } catch (error) {
      console.error('Error processing tensor field:', error);
    }
  },

  /**
   * Calculates geometric products across the tensor field
   */
  calculateGeometricProducts: (): GeometricProductResult[] => {
    const startTime = performance.now();
    const state = get();
    const { tensorField, flowerOfLifePattern, flowerOfLifeActive, computationalOptimization } = state;
    
    if (!tensorField || tensorField.pixels.length === 0) {
      return [];
    }
    
    let results: GeometricProductResult[] = [];
    let totalOperations = 0;
    let optimizationRatio = 1;
    
    try {
      if (flowerOfLifeActive && flowerOfLifePattern && computationalOptimization) {
        // Use Flower of Life optimization
        const processed = processWithFlowerOfLifeOptimization(
          flowerOfLifePattern,
          tensorField,
          Math.floor(state.geometricProductThreshold)
        );
        
        results = processed.products;
        totalOperations = processed.totalOperations;
        optimizationRatio = processed.optimizationRatio;
        
        set((s) => ({
          tensorPerformance: {
            ...s.tensorPerformance,
            activeRays: processed.raysProcessed,
            optimizationRatio
          }
        }));
        
      } else {
        // Standard batched processing without Flower of Life optimization
        const radiusThreshold = state.piRayDensity * 0.5;
        results = batchGeometricProducts(
          tensorField.pixels,
          radiusThreshold,
          Math.floor(state.geometricProductThreshold * 10)
        );
        totalOperations = results.length;
      }
      
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      set((s) => ({
        tensorPerformance: {
          ...s.tensorPerformance,
          geometricProducts: totalOperations,
          tensorOperations: totalOperations,
          frameTime: processingTime,
          optimizationRatio
        }
      }));
      
    } catch (error) {
      console.error('Error calculating geometric products:', error);
    }
    
    return results;
  },

  /**
   * Updates the Flower of Life ray pattern
   */
  updateFlowerOfLifeRays: () => {
    const state = get();
    
    if (!state.flowerOfLifeActive) {
      set({ flowerOfLifePattern: null });
      return;
    }
    
    try {
      const center = new Vector2(0, 0);
      let pattern = generateFlowerOfLifePattern(
        center,
        state.flowerOfLifeGenerations,
        state.pi,
        state.phi,
        state.sacredGeometryScale,
        state.flowerOfLifeRotation
      );
      
      // Optimize rays if we have a tensor field and culling is enabled
      if (state.tensorField && state.tensorFieldCulling) {
        const optimizedRays = optimizeRays(
          pattern.rays,
          state.tensorField,
          state.geometricProductThreshold,
          0.1
        );
        pattern = { ...pattern, rays: optimizedRays };
      }
      
      set({ 
        flowerOfLifePattern: pattern,
        tensorPerformance: {
          ...state.tensorPerformance,
          activeRays: pattern.rays.length
        }
      });
      
    } catch (error) {
      console.error('Error updating Flower of Life rays:', error);
    }
  },

  /**
   * Updates tensor performance metrics
   */
  updateTensorPerformance: (metrics: Partial<TensorPerformanceMetrics>) => {
    set((state) => ({
      tensorPerformance: {
        ...state.tensorPerformance,
        ...metrics
      }
    }));
  },

  /**
   * Sets the tensor field directly
   */
  setTensorField: (field: TensorField | null) => set({ tensorField: field }),

  /**
   * Sets the Flower of Life pattern directly
   */
  setFlowerOfLifePattern: (pattern: FlowerOfLifePattern | null) => set({ flowerOfLifePattern: pattern })
}));

export default useTensorStore;
