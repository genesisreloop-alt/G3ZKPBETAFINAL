import * as THREE from 'three';
/**
 * G3° PHI-PI PRECURSOR SUBSTRATE ENGINE: VOLUMETRIC MANIFOLD CONSTRUCTION
 * -----------------------------------------------------------------------
 * VOLUMETRIC IMAGE-TO-3D CONVERSION:
 * - Each stitch renders its own distance calculation
 * - Texture and colors drive the 3D geometry iteratively
 * - 3D object constructed across the blade volume width
 * - Continuous manifold from 2D image data
 * - OPTIMIZED: Proper SDF with limited texture fetches
 */
const vertexShader = `
  varying vec3 vLocalPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vLocalPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = `
  precision highp float;

  uniform float uPhi;
  uniform float uPi;
  uniform float uTime;
  uniform vec3 uLocalCameraPosition;
  uniform float uPhiStepMultiplier;
  uniform float uPiPrecisionThreshold;
  uniform float uMaxSteps;
  uniform float uMaxDistance;
  uniform float uDepthScale;
  uniform float uMetricExtension; 
  uniform float uEigenValue;
  uniform float uZkpProofConsistency;
  
  // VOLUMETRIC MANIFOLD CONTROLS
  uniform float uStitchDensity;      // How many stitches per unit volume
  uniform float uVolumetricDepth;    // Depth of volumetric sampling
  uniform float uManifoldContinuity; // Smoothness of manifold transitions
  
  uniform float uShowPhiSteps;
  uniform float uShowNormals;
  
  uniform sampler2D uVideoTexture;
  uniform bool uHasVideo;

  varying vec3 vLocalPosition;
  varying vec2 vUv;

  mat2 rot(float a) {
    float s = sin(a); float c = cos(a);
    return mat2(c, -s, s, c);
  }

  // VOLUMETRIC STITCH PATTERN - Adds detail without breaking SDF
  float getStitchPattern(vec3 p, float intensity) {
    float stitchFreq = uStitchDensity * uPhi;
    float pattern = sin(p.x * stitchFreq * uPi) * sin(p.y * stitchFreq * uPhi);
    pattern *= sin(p.z * stitchFreq * 2.0);
    float phiHarmonic = sin(length(p.xy) * uPhi * 3.0 + p.z * uPi);
    return (pattern * 0.015 + phiHarmonic * 0.003) * intensity * uManifoldContinuity;
  }

  struct SubstrateMetric {
    float potential;
    float density;
    float edgeStitch;
    vec2 gradient;
    vec3 texColor;
  };

  // Single texture sample with gradient - OPTIMIZED (5 fetches max)
  SubstrateMetric getSubstrateMetric(vec2 uv) {
    if (!uHasVideo || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      return SubstrateMetric(0.1, 1.0, 1.0, vec2(0.0), vec3(0.02));
    }
    
    float e = 0.001;
    vec4 tex = texture2D(uVideoTexture, uv);
    vec3 texColor = tex.rgb;
    float luma = dot(texColor, vec3(0.299, 0.587, 0.114));
    
    float lR = dot(texture2D(uVideoTexture, uv + vec2(e, 0)).rgb, vec3(0.299, 0.587, 0.114));
    float lL = dot(texture2D(uVideoTexture, uv - vec2(e, 0)).rgb, vec3(0.299, 0.587, 0.114));
    float lU = dot(texture2D(uVideoTexture, uv + vec2(0, e)).rgb, vec3(0.299, 0.587, 0.114));
    float lD = dot(texture2D(uVideoTexture, uv - vec2(0, e)).rgb, vec3(0.299, 0.587, 0.114));
    
    vec2 grad = vec2(lR - lL, lU - lD) / (2.0 * e);
    float edge = length(grad);
    
    // Volumetric potential based on luminance and z-position modulation
    float basePotential = 0.1;
    float lumaPotential = pow(luma, uPhi * 0.5);
    float potential = basePotential + lumaPotential * uVolumetricDepth + edge * 0.08;
    
    float density = 1.0 + edge * uPi * 0.4;
    float edgeStitch = clamp(1.1 - edge * 0.15 * uPi * uManifoldContinuity, 0.0, 1.0);
    
    return SubstrateMetric(potential, density, edgeStitch, grad, texColor);
  }

  // PROPER SIGNED DISTANCE FUNCTION - Box + Texture-driven thickness
  float constructVolumetricManifold(vec3 p) {
    // Compute UV from XY position
    vec2 uv = p.xy * 0.5 + 0.5;
    
    // Base bounding box SDF (proper signed distance)
    vec3 boxSize = vec3(1.0, 1.0, uDepthScale * 1.5);
    vec3 q = abs(p) - boxSize;
    float boxDist = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
    
    // Early out for points clearly outside
    if (boxDist > 0.2) return boxDist;
    
    // Get texture-based metric
    SubstrateMetric m = getSubstrateMetric(uv);
    
    // VOLUMETRIC THICKNESS: Modulated by texture intensity
    // Higher potential = more volume/thickness at this XY position
    float extendedPotential = m.potential * uMetricExtension * 0.7;
    float thickness = extendedPotential * m.edgeStitch * uDepthScale;
    
    // Z-position modulates the local geometry (iterative layer construction)
    float zNorm = clamp((p.z + uDepthScale) / (2.0 * uDepthScale), 0.0, 1.0);
    float zModulation = 1.0 + sin(zNorm * uPi * uStitchDensity * 2.0) * 0.1 * m.potential;
    thickness *= zModulation;
    
    // Eigen intensity modulation
    float eigenMod = 1.0 / (uEigenValue * 0.4);
    
    // Primary manifold SDF: distance to z-planes modulated by thickness
    float manifoldDist = (abs(p.z) - thickness) / m.density * eigenMod;
    
    // Add stitch pattern detail (small perturbation, doesn't break SDF)
    float stitchDetail = getStitchPattern(p, m.potential);
    manifoldDist += stitchDetail;
    
    // Combine with bounding box using smooth max for continuous manifold
    return max(boxDist, manifoldDist);
  }

  vec3 calcNormal(vec3 p) {
    float h = 0.0001;
    const vec2 k = vec2(1, -1);
    return normalize(k.xyy * constructVolumetricManifold(p + k.xyy * h) + 
                     k.yyx * constructVolumetricManifold(p + k.yyx * h) + 
                     k.yxy * constructVolumetricManifold(p + k.yxy * h) + 
                     k.xxx * constructVolumetricManifold(p + k.xxx * h));
  }

  void main() {
    vec3 ro = uLocalCameraPosition;
    vec3 rd = normalize(vLocalPosition - ro);

    float dO = 0.0;
    bool hit = false;
    float steps = 0.0;
    
    for(int i = 0; i < 400; i++) {
      if(float(i) >= uMaxSteps) break;
      vec3 p = ro + rd * dO;
      float dS = constructVolumetricManifold(p);
      
      // Precision step scaling with minimum step to prevent stalls
      float stepSize = max(dS * clamp(uPhiStepMultiplier, 0.1, 0.9), 0.001);
      dO += stepSize;
      steps += 1.0;
      
      if(dS < uPiPrecisionThreshold) {
        hit = true;
        break;
      }
      if(dO > uMaxDistance) break;
    }

    vec3 col = vec3(0.0);
    if(hit) {
      vec3 p = ro + rd * dO;
      vec3 n = calcNormal(p);
      vec2 uv = p.xy * 0.5 + 0.5;
      
      // Get texture data for coloring
      SubstrateMetric m = getSubstrateMetric(uv);
      vec3 assetColor = m.texColor;
      
      // Volumetric depth coloring - colors shift based on z-position
      float zFactor = clamp((p.z + uDepthScale) / (2.0 * uDepthScale), 0.0, 1.0);
      vec3 depthTint = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.95, 0.88), zFactor);
      assetColor *= depthTint;
      
      // Enhanced lighting
      vec3 lPos = vec3(5.0, 5.0, 12.0 * sign(ro.z));
      vec3 lDir = normalize(lPos - p);
      float diff = max(dot(n, lDir), 0.0);
      float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
      float spec = pow(max(dot(reflect(-lDir, n), -rd), 0.0), 96.0);
      
      // Secondary fill light
      vec3 lPos2 = vec3(-4.0, -3.0, -8.0 * sign(ro.z));
      vec3 lDir2 = normalize(lPos2 - p);
      float diff2 = max(dot(n, lDir2), 0.0) * 0.25;
      
      // SUBSTRATE ENERGY FIELD
      vec3 energyCol = mix(vec3(0.0, 0.9, 1.0), vec3(0.8, 0.2, 0.95), m.potential);
      
      // Combine lighting
      col = assetColor * (diff + diff2 + 0.1);
      col = mix(col, energyCol * (diff + rim * 0.5), 0.25 * uZkpProofConsistency);
      col += vec3(1.0) * spec * 0.5;
      
      // Stitch visibility enhancement
      float stitchVis = getStitchPattern(p, m.potential);
      col += vec3(0.1, 0.7, 0.5) * abs(stitchVis) * uStitchDensity * 0.5;

      if(uShowNormals > 0.5) col = n * 0.5 + 0.5;
      if(uShowPhiSteps > 0.5) col = vec3(steps/uMaxSteps, m.edgeStitch, m.potential);
    } else {
      // Cosmic Background
      float bg = pow(1.0 - length(vUv - 0.5), 1.5);
      col = vec3(0.001, 0.005, 0.015) * bg;
    }

    gl_FragColor = vec4(pow(col, vec3(0.4545)), 1.0);
  }
`;
export class PhiPiRaymarchingMaterial extends THREE.ShaderMaterial {
    constructor() {
        super({
            uniforms: {
                uPhi: { value: 1.618033988749895 },
                uPi: { value: 3.141592653589793 },
                uTime: { value: 0 },
                uLocalCameraPosition: { value: new THREE.Vector3(0, 0, 5) },
                uPhiStepMultiplier: { value: 0.5 },
                uPiPrecisionThreshold: { value: 0.00015 },
                uMaxSteps: { value: 400.0 },
                uMaxDistance: { value: 100.0 },
                uDepthScale: { value: 1.5 },
                uMetricExtension: { value: 2.0 },
                uEigenValue: { value: 2.618 },
                uZkpProofConsistency: { value: 0.4 },
                // VOLUMETRIC MANIFOLD UNIFORMS
                uStitchDensity: { value: 1.0 },
                uVolumetricDepth: { value: 1.0 },
                uManifoldContinuity: { value: 0.7 },
                uShowPhiSteps: { value: 0.0 },
                uShowNormals: { value: 0.0 },
                uVideoTexture: { value: null },
                uHasVideo: { value: false }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: true,
            depthTest: true
        });
    }
    updateUniforms(state, time, cameraPos, mesh, assetTexture) {
        this.uniforms.uTime.value = time;
        this.uniforms.uPhi.value = state.phi;
        this.uniforms.uPi.value = state.pi;
        this.uniforms.uPhiStepMultiplier.value = state.phiStepMultiplier;
        this.uniforms.uPiPrecisionThreshold.value = state.piPrecisionThreshold;
        this.uniforms.uMaxSteps.value = state.maxSteps;
        this.uniforms.uDepthScale.value = state.depthScale;
        this.uniforms.uMetricExtension.value = state.metricExtension;
        this.uniforms.uEigenValue.value = state.eigenValue;
        this.uniforms.uZkpProofConsistency.value = state.zkpProofConsistency;
        // VOLUMETRIC UNIFORMS
        this.uniforms.uStitchDensity.value = state.stitchDensity ?? 1.0;
        this.uniforms.uVolumetricDepth.value = state.volumetricDepth ?? 1.0;
        this.uniforms.uManifoldContinuity.value = state.manifoldContinuity ?? 0.7;
        const localCam = cameraPos.clone();
        mesh.worldToLocal(localCam);
        this.uniforms.uLocalCameraPosition.value.copy(localCam);
        this.uniforms.uShowPhiSteps.value = state.showPhiSteps ? 1.0 : 0.0;
        this.uniforms.uShowNormals.value = state.showNormals ? 1.0 : 0.0;
        if (assetTexture) {
            this.uniforms.uVideoTexture.value = assetTexture;
            this.uniforms.uHasVideo.value = true;
        }
        else {
            this.uniforms.uHasVideo.value = false;
        }
    }
}
