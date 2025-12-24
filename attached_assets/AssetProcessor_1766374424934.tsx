
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { usePhiPiStore } from '../stores/usePhiPiStore';

export const AssetProcessor: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { activeAssetType, assetUrl, setAssetTexture } = usePhiPiStore();
  const textureLoader = useRef(new THREE.TextureLoader());

  useEffect(() => {
    let currentTexture: THREE.Texture | THREE.VideoTexture | null = null;
    let stream: MediaStream | null = null;

    const cleanup = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      if (currentTexture) {
        currentTexture.dispose();
        currentTexture = null;
      }
      setAssetTexture(null);
    };

    const processCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            const tex = new THREE.VideoTexture(videoRef.current!);
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            currentTexture = tex;
            setAssetTexture(tex);
          };
        }
      } catch (err) {
        console.error("Camera access failed:", err);
      }
    };

    const processImage = () => {
      if (!assetUrl) return;
      textureLoader.current.load(assetUrl, (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        currentTexture = tex;
        setAssetTexture(tex);
      });
    };

    const processVideo = () => {
      if (!assetUrl || !videoRef.current) return;
      videoRef.current.srcObject = null;
      videoRef.current.src = assetUrl;
      videoRef.current.loop = true;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
        const tex = new THREE.VideoTexture(videoRef.current!);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        currentTexture = tex;
        setAssetTexture(tex);
      };
    };

    cleanup();

    if (activeAssetType === 'camera') {
      processCamera();
    } else if (activeAssetType === 'image') {
      processImage();
    } else if (activeAssetType === 'video') {
      processVideo();
    }

    return cleanup;
  }, [activeAssetType, assetUrl, setAssetTexture]);

  return (
    <video
      ref={videoRef}
      className="hidden"
      autoPlay
      muted
      playsInline
      crossOrigin="anonymous"
    />
  );
};
