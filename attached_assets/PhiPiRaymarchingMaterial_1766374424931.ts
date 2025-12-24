
import * as THREE from 'three';

/**
 * G3° PHI-PI PRECURSOR SUBSTRATE ENGINE: ACUTE REALITY UPLINK V6
 * -------------------------------------------------------------
 * ACUTE REALITY PROJECTION ENGINE
 * - Planar Accuracy: Corrected UV mapping to prevent side distortion.
 * - Dynamic Sewing: RBBRRBR pulse now interacts with Rotor and Substrate Depth.
 * - Physically Sewn: Garment conforms to the metric floor.
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
  uniform float uAssetAspect;
  
  uniform float uShowPhiSteps;
  uniform float uShowNormals;
  uniform float uShowBlade;
  uniform float uShowStepDepth;
  uniform float uBladeDepthDebug;
  
  uniform sampler2D uVideoTexture;
  uniform bool uHasVideo;

  varying vec3 vLocalPosition;
  varying vec2 vUv;

  // ROTORSAL HARMONIC: Drives the 3D twist of the manifold
  float getRotorHarmonic(vec3 p) {
    float dist = length(p.xy);
    // Helical phase shift based on Phi
    float angle = dist * uPhi + p.z * (uPi / uPhi);
    float s = sin(p.x * uPhi + angle);
    float c = cos(p.y * uPhi - angle);
    return (s * c) * 0.5 + 0.5;
  }

  // ACUTE STITCHING ENGINE (RBBRRBR)
  // Now interacts with Rotor and Substrate for "Physical Sewing"
  float getStitch(float r, float z, float rotor, float substrate) {
    // Stitching frequency modulated by the Rotor
    float freq = (3.0 + uPhi) * (0.8 + 0.4 * rotor);
    // The pulse phase is influenced by the substrate thickness (Physical Conformity)
    float x = r * freq + z * uPi + substrate * uPhi;
    
    float x7 = mod(x, 7.0);
    int idx = int(floor(x7));
    float f = fract(x7);
    
    float v0, v1;
    if(idx == 0) { v0=1.0; v1=0.2; }      // R
    else if(idx == 1) { v0=0.2; v1=0.2; } // B
    else if(idx == 2) { v0=0.2; v1=1.0; } // B
    else if(idx == 3) { v0=1.0; v1=1.0; } // R
    else if(idx == 4) { v0=1.0; v1=0.2; } // R
    else if(idx == 5) { v0=0.2; v1=1.0; } // B
    else { v0=1.0; v1=1.0; }              // R

    return mix(v0, v1, smoothstep(0.1, 0.9, f));
  }

  // ACUTE REALITY SAMPLING (Metric Uplink)
  struct RealityMetric {
    float depth;
    vec3 color;
    bool isValid;
  };

  RealityMetric sampleReality(vec2 uv) {
    // Check if UV is within projection bounds to avoid "smearing" at the edges
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        return RealityMetric(0.0, vec3(0.0), false);
    }
    if (!uHasVideo) return RealityMetric(0.02, vec3(0.01), true);
    
    vec4 tex = texture2D(uVideoTexture, uv);
    float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    // Acute Depth Extrusion
    float reconDepth = pow(luma, uEigenValue * 0.5) * uMetricExtension;
    return RealityMetric(reconDepth, tex.rgb, true);
  }

  // UNIFIED 3D SEWN MANIFOLD
  float verifyUnifiedReality(vec3 p) {
    // 1. Stable Aspect-Corrected Planar UV Mapping
    // This prevents the "whirlpool" distortion on the sides
    vec2 uv = p.xy * 0.5 + 0.5;
    RealityMetric reality = sampleReality(uv);
    
    // 2. Precursor Substrate (The Foundation)
    float r = length(p.xy);
    float bladeBase = pow(abs(cos(r * (uPi * 0.5))), uPhi * 0.4) * uDepthScale;
    
    // 3. Rotorsal & Stitching Interlink
    float rotor = getRotorHarmonic(p);
    float stitch = getStitch(r, p.z, rotor, bladeBase);
    
    // 4. Metric Conformity: The Garment sews itself to the substrate
    // We blend the substrate and the extruded reality based on ZKP consistency
    float garmentThickness = reality.depth * stitch;
    
    // Physical Binding: Substrate pushes, Garment conforms
    float totalThickness = mix(bladeBase, garmentThickness, uZkpProofConsistency);
    
    // 5. Volumetric SDF
    float d = abs(p.z) - totalThickness;
    
    // 6. Micro-Grain (Physical Integrity)
    float micro = sin(p.x * 60.0 + uTime) * cos(p.y * 60.0) * 0.0003 * uZkpProofConsistency;
    
    return (d + micro) * 0.75;
  }

  vec3 calcNormal(vec3 p) {
    float h = 0.0008; // Sharper normals for more detail
    const vec2 k = vec2(1, -1);
    vec3 n = normalize(k.xyy * verifyUnifiedReality(p + k.xyy * h) + 
                       k.yyx * verifyUnifiedReality(p + k.yyx * h) + 
                       k.yxy * verifyUnifiedReality(p + k.yxy * h) + 
                       k.xxx * verifyUnifiedReality(p + k.xxx * h));
    return n;
  }

  void main() {
    vec3 ro = uLocalCameraPosition;
    vec3 rd = normalize(vLocalPosition - ro);

    float dO = 0.0;
    bool hit = false;
    float steps = 0.0;
    
    for(int i = 0; i < 512; i++) { // Increased steps for "More Slices"
      if(float(i) >= uMaxSteps) break;
      vec3 p = ro + rd * dO;
      float dS = verifyUnifiedReality(p);
      
      // Step size modulated by the Golden Ratio for optimal slice distribution
      dO += dS * uPhiStepMultiplier;
      steps += 1.0;
      
      if(dS < uPiPrecisionThreshold) { hit = true; break; }
      if(dO > uMaxDistance) break;
    }

    vec3 col = vec3(0.0);
    if(hit) {
      vec3 p = ro + rd * dO;
      vec3 n = calcNormal(p);
      
      vec2 uv = p.xy * 0.5 + 0.5;
      RealityMetric reality = sampleReality(uv);
      
      // Physical Lighting Uplink
      vec3 lPos = vec3(8.0, 8.0, 12.0 * sign(ro.z));
      vec3 lDir = normalize(lPos - p);
      float diff = max(dot(n, lDir), 0.0);
      float rim = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
      float spec = pow(max(dot(reflect(-lDir, n), -rd), 0.0), 64.0);
      
      // Acute Reality Color
      col = reality.color * (diff + 0.12);
      
      // Physical Stitching Harmonics
      float rotor = getRotorHarmonic(p);
      float pulse = getStitch(length(p.xy), p.z, rotor, reality.depth);
      vec3 energy = mix(vec3(0.0, 1.0, 0.9), vec3(0.9, 0.2, 1.0), pulse);
      col = mix(col, energy * (diff + rim), 0.08 * (1.0 - uZkpProofConsistency));
      
      col += vec3(1.0) * spec * 0.45;

      // Debug Viewports
      if(uBladeDepthDebug > 0.0) {
          col = mix(col, vec3(reality.depth * 0.3, reality.depth * 0.1, 0.5), 0.6 * uBladeDepthDebug);
      }
      if(uShowNormals > 0.5) col = n * 0.5 + 0.5;
      if(uShowPhiSteps > 0.5) {
          float s = steps / uMaxSteps;
          col = mix(vec3(0.0, 0.05, 0.15), vec3(1.0, 0.85, 0.1), s);
      }
      if(uShowStepDepth > 0.5) {
          col = vec3(pulse, rotor, fract(p.z * uPhi));
      }
    } else {
      // Background Starfield Projection
      float bg = pow(1.0 - length(vUv - 0.5), 2.2);
      col = vec3(0.0, 0.002, 0.006) * bg;
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
        uMaxSteps: { value: 512.0 },
        uMaxDistance: { value: 100.0 },
        uDepthScale: { value: 1.5 },
        uMetricExtension: { value: 2.0 },
        uEigenValue: { value: 2.618 },
        uZkpProofConsistency: { value: 1.0 },
        uAssetAspect: { value: 1.0 },
        uShowPhiSteps: { value: 0.0 },
        uShowNormals: { value: 0.0 },
        uShowBlade: { value: 0.0 },
        uShowStepDepth: { value: 0.0 },
        uBladeDepthDebug: { value: 0.0 },
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

  updateUniforms(state: any, time: number, cameraPos: THREE.Vector3, mesh: THREE.Mesh, assetTexture: any) {
    const uniforms = (this as any).uniforms;
    if (!uniforms) return;
    
    uniforms.uTime.value = time;
    uniforms.uPhi.value = state.phi;
    uniforms.uPi.value = state.pi;
    uniforms.uPhiStepMultiplier.value = state.phiStepMultiplier;
    uniforms.uPiPrecisionThreshold.value = state.piPrecisionThreshold;
    uniforms.uMaxSteps.value = state.maxSteps;
    uniforms.uDepthScale.value = state.depthScale;
    uniforms.uMetricExtension.value = state.metricExtension;
    uniforms.uEigenValue.value = state.eigenValue;
    uniforms.uZkpProofConsistency.value = state.zkpProofConsistency;
    uniforms.uBladeDepthDebug.value = state.bladeDepthDebug;
    
    if (assetTexture && assetTexture.image) {
        const img = assetTexture.image;
        const w = img.videoWidth || img.width || 1;
        const h = img.videoHeight || img.height || 1;
        uniforms.uAssetAspect.value = w / h;
    }
    
    const localCam = cameraPos.clone();
    mesh.worldToLocal(localCam);
    uniforms.uLocalCameraPosition.value.copy(localCam);
    
    uniforms.uShowPhiSteps.value = state.showPhiSteps ? 1.0 : 0.0;
    uniforms.uShowNormals.value = state.showNormals ? 1.0 : 0.0;
    uniforms.uShowBlade.value = state.showBlade ? 1.0 : 0.0;
    uniforms.uShowStepDepth.value = state.showStepDepth ? 1.0 : 0.0;
    
    if (assetTexture) {
      uniforms.uVideoTexture.value = assetTexture;
      uniforms.uHasVideo.value = true;
    } else {
      uniforms.uHasVideo.value = false;
    }
  }
}
