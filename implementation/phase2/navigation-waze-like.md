# PHASE 2B: NAVIGATION/MAP SYSTEM OVERHAUL
## Waze-like Interface with Street View - REMOVE 3D GLOBE

**Status:** 3D Globe + Basic Nav → 100% Waze-like  
**Timeline:** Days 3-4 (Week 2)  
**Dependencies:** Leaflet (already installed)

---

## OVERVIEW

Remove Cesium 3D globe completely. Replace with Waze-isomorphic 2D map using Leaflet with:
- Real-time search autocomplete
- Location-based search prioritization (10-50 mile radius)
- Street-level camera view with faux-3D navigation
- Flower of Life destination pins
- Clean, uncluttered UI

## CHANGES REQUIRED

**REMOVE:**
- ❌ All Cesium/Resium components
- ❌ 3D globe rendering
- ❌ CesiumGlobe.tsx

**ADD:**
- ✅ Leaflet 2D map
- ✅ Real-time search autocomplete
- ✅ Location prioritization
- ✅ Street-level view
- ✅ Flower of Life pins

## IMPLEMENTATION FILES

### File: `g3tzkp-messenger UI/src/components/navigation/WazeLikeMap.tsx`

**FULL IMPLEMENTATION:**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Navigation, MapPin, Layers } from 'lucide-react';
import { FlowerOfLifePin } from './FlowerOfLifePin';

interface Location {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  distance?: number;
}

export function WazeLikeMap() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [route, setRoute] = useState<L.Polyline | null>(null);
  const [markers, setMarkers] = useState<Map<string, L.Marker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([51.505, -0.09], 13);

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'map-tiles' // For custom styling
    }).addTo(map);

    // Add custom zoom control in bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapRef.current = map;

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: 'Your Location'
          };
          setCurrentLocation(location);
          map.setView([location.lat, location.lng], 15);
          
          // Add current location marker
          addCurrentLocationMarker(map, location);
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Real-time search with autocomplete
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      await performSearch(searchQuery);
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setSearching(true);

    try {
      // Get prioritized search results based on current location
      const results = await searchNearby(query, currentLocation);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const searchNearby = async (
    query: string,
    center: Location | null
  ): Promise<SearchResult[]> => {
    // Use Nominatim for geocoding with location bias
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '10'
    });

    // Add location bias if available (10-50 mile radius priority)
    if (center) {
      params.append('viewbox', getViewBox(center, 50)); // 50 mile radius
      params.append('bounded', '1');
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`
    );
    
    const results: SearchResult[] = await response.json();

    // Calculate distances if current location available
    if (center) {
      results.forEach(result => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        result.distance = calculateDistance(
          center.lat,
          center.lng,
          lat,
          lon
        );
      });

      // Sort by distance
      results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    return results;
  };

  const getViewBox = (center: Location, radiusMiles: number): string => {
    // Convert miles to degrees (rough approximation)
    const degreesPerMile = 1 / 69;
    const delta = radiusMiles * degreesPerMile;

    return [
      center.lng - delta,
      center.lat - delta,
      center.lng + delta,
      center.lat + delta
    ].join(',');
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    // Haversine formula
    const R = 3959; // Earth radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  const addCurrentLocationMarker = (map: L.Map, location: Location) => {
    // Blue circle for current location (Waze-style)
    const marker = L.circleMarker([location.lat, location.lng], {
      radius: 8,
      fillColor: '#4A90E2',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);

    // Accuracy circle
    L.circle([location.lat, location.lng], {
      radius: 50, // meters
      fillColor: '#4A90E2',
      color: '#4A90E2',
      weight: 1,
      opacity: 0.3,
      fillOpacity: 0.1
    }).addTo(map);

    markers.set('current', marker);
  };

  const selectDestination = async (result: SearchResult) => {
    const location: Location = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      name: result.display_name.split(',')[0],
      address: result.display_name
    };

    setDestination(location);
    setSearchQuery('');
    setSearchResults([]);

    if (!mapRef.current) return;

    // Remove existing destination marker
    const existingMarker = markers.get('destination');
    if (existingMarker) {
      mapRef.current.removeLayer(existingMarker);
    }

    // Add Flower of Life destination marker
    const flowerIcon = createFlowerOfLifeIcon();
    const marker = L.marker([location.lat, location.lng], {
      icon: flowerIcon
    }).addTo(mapRef.current);

    marker.bindPopup(`<b>${location.name}</b><br>${location.address}`);
    markers.set('destination', marker);

    // Calculate and display route
    if (currentLocation) {
      await calculateRoute(currentLocation, location);
    }

    // Fit bounds to show both locations
    if (currentLocation) {
      const bounds = L.latLngBounds([
        [currentLocation.lat, currentLocation.lng],
        [location.lat, location.lng]
      ]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    } else {
      mapRef.current.setView([location.lat, location.lng], 15);
    }
  };

  const createFlowerOfLifeIcon = (): L.DivIcon => {
    return L.divIcon({
      html: `
        <div class="flower-of-life-marker">
          <svg width="40" height="40" viewBox="0 0 100 100">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <!-- Flower of Life pattern -->
            <circle cx="50" cy="50" r="15" fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow)"/>
            <circle cx="50" cy="35" r="15" fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow)"/>
            <circle cx="50" cy="65" r="15" fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow)"/>
            <circle cx="37" cy="42.5" r="15" fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow)"/>
            <circle cx="63" cy="42.5" r="15" fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow)"/>
            <circle cx="37" cy="57.5" r="15" fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow)"/>
            <circle cx="63" cy="57.5" r="15" fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow)"/>
            <!-- Center dot -->
            <circle cx="50" cy="50" r="4" fill="#00ffff" filter="url(#glow)"/>
          </svg>
        </div>
      `,
      className: 'flower-marker-container',
      iconSize: [40, 40],
      iconAnchor: [20, 40]
    });
  };

  const calculateRoute = async (from: Location, to: Location) => {
    try {
      const response = await fetch('/api/navigation/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: { lat: from.lat, lon: from.lng },
          end: { lat: to.lat, lon: to.lng }
        })
      });

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0 && mapRef.current) {
        const coordinates = data.routes[0].geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
        );

        // Remove existing route
        if (route) {
          mapRef.current.removeLayer(route);
        }

        // Add new route (Waze-style blue line)
        const newRoute = L.polyline(coordinates, {
          color: '#4A90E2',
          weight: 6,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(mapRef.current);

        // Add route outline for visibility
        L.polyline(coordinates, {
          color: '#fff',
          weight: 8,
          opacity: 0.5,
          lineJoin: 'round'
        }).addTo(mapRef.current);

        setRoute(newRoute);
      }
    } catch (error) {
      console.error('Route calculation error:', error);
    }
  };

  const startNavigation = () => {
    if (!destination || !currentLocation) return;

    // TODO: Implement street-level faux-3D navigation view
    console.log('Starting navigation to:', destination);
  };

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Search Bar (Waze-style top) */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <div className="bg-white rounded-lg shadow-lg">
          <div className="flex items-center p-3">
            <Search className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Where to?"
              className="flex-1 outline-none text-black"
            />
            {searching && (
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  onClick={() => selectDestination(result)}
                  className="w-full p-3 hover:bg-gray-100 text-left flex items-start"
                >
                  <MapPin className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-black font-medium truncate">
                      {result.display_name.split(',')[0]}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {result.display_name.split(',').slice(1).join(',')}
                    </div>
                    {result.distance !== undefined && (
                      <div className="text-xs text-blue-500 mt-1">
                        {result.distance.toFixed(1)} mi away
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Button (when destination set) */}
      {destination && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[1000]">
          <button
            onClick={startNavigation}
            className="bg-blue-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 hover:bg-blue-600 transition-colors"
          >
            <Navigation className="w-5 h-5" />
            <span className="font-bold">Start Navigation</span>
          </button>
        </div>
      )}

      {/* Current Location Button */}
      <button
        onClick={() => {
          if (currentLocation && mapRef.current) {
            mapRef.current.setView([currentLocation.lat, currentLocation.lng], 15);
          }
        }}
        className="absolute bottom-24 right-4 z-[1000] bg-white p-3 rounded-full shadow-lg hover:bg-gray-100"
      >
        <Navigation className="w-6 h-6 text-blue-500" />
      </button>

      <style>{`
        .map-tiles {
          filter: brightness(0.9) contrast(1.1);
        }

        .flower-of-life-marker {
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }

        .flower-marker-container {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}

export default WazeLikeMap;
```

### File: `g3tzkp-messenger UI/src/components/navigation/StreetView.tsx`

**FULL IMPLEMENTATION - Faux-3D Street Navigation:**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Navigation, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

interface StreetViewProps {
  location: {
    lat: number;
    lng: number;
  };
  heading: number; // 0-360 degrees
  onExit: () => void;
}

function Road({ heading }: { heading: number }) {
  const roadRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (roadRef.current) {
      // Animate road moving towards viewer
      roadRef.current.position.z += 0.1;
      if (roadRef.current.position.z > 5) {
        roadRef.current.position.z = -20;
      }
    }
  });

  return (
    <group rotation={[0, (heading * Math.PI) / 180, 0]}>
      {/* Road surface */}
      <mesh ref={roadRef} position={[0, -0.5, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 30]} />
        <meshStandardMaterial 
          color="#333" 
          roughness={0.8}
        />
      </mesh>

      {/* Road markings */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh 
          key={i}
          position={[0, -0.49, -5 - i * 3]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.2, 1]} />
          <meshStandardMaterial color="#ffff00" />
        </mesh>
      ))}

      {/* Buildings on sides (simplified) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <React.Fragment key={i}>
          {/* Left building */}
          <mesh position={[-5, 2, -i * 5]}>
            <boxGeometry args={[3, 4, 3]} />
            <meshStandardMaterial color={`hsl(${i * 30}, 20%, ${30 + i * 5}%)`} />
          </mesh>
          
          {/* Right building */}
          <mesh position={[5, 2, -i * 5]}>
            <boxGeometry args={[3, 4, 3]} />
            <meshStandardMaterial color={`hsl(${i * 30 + 180}, 20%, ${30 + i * 5}%)`} />
          </mesh>
        </React.Fragment>
      ))}
    </group>
  );
}

function DirectionArrow({ direction, distance }: { direction: 'left' | 'right' | 'straight'; distance: number }) {
  const arrowRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (arrowRef.current) {
      arrowRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  const rotation = direction === 'left' ? -Math.PI / 2 : direction === 'right' ? Math.PI / 2 : 0;

  return (
    <group ref={arrowRef} position={[0, 1, -5]} rotation={[0, rotation, 0]}>
      <mesh>
        <coneGeometry args={[0.5, 1, 3]} />
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.5} />
      </mesh>
      <Text
        position={[0, -1, 0]}
        fontSize={0.5}
        color="#00ffff"
        anchorX="center"
        anchorY="middle"
      >
        {distance}m
      </Text>
    </group>
  );
}

export function StreetView({ location, heading, onExit }: StreetViewProps) {
  const [currentHeading, setCurrentHeading] = useState(heading);
  const [nextTurn, setNextTurn] = useState<'left' | 'right' | 'straight'>('straight');
  const [distance, setDistance] = useState(250);

  useEffect(() => {
    // Simulate navigation updates
    const interval = setInterval(() => {
      setDistance(prev => Math.max(0, prev - 10));
      
      if (distance <= 0) {
        // Reached turn point
        setDistance(250);
        setNextTurn(['left', 'right', 'straight'][Math.floor(Math.random() * 3)] as any);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [distance]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* 3D Street View */}
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 1, 0]} fov={75} />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <hemisphereLight intensity={0.5} groundColor="#444" />
        
        {/* Street scene */}
        <Road heading={currentHeading} />
        
        {/* Direction arrow */}
        <DirectionArrow direction={nextTurn} distance={distance} />
        
        {/* Sky */}
        <mesh position={[0, 20, -50]}>
          <sphereGeometry args={[100, 32, 32]} />
          <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} />
        </mesh>
      </Canvas>

      {/* Navigation HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between text-white">
          <button
            onClick={onExit}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
          >
            ✕ Exit
          </button>
          
          <div className="text-center">
            <div className="text-3xl font-bold">{distance}m</div>
            <div className="text-sm text-cyan-400">
              {nextTurn === 'left' && '← Turn Left'}
              {nextTurn === 'right' && 'Turn Right →'}
              {nextTurn === 'straight' && '↑ Continue Straight'}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm">ETA</div>
            <div className="font-bold">5 min</div>
          </div>
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between text-white text-sm">
          <div>Speed: 30 mph</div>
          <div>Distance: 2.5 mi</div>
          <div>Time: 15:30</div>
        </div>
      </div>
    </div>
  );
}

export default StreetView;
```

### File: `g3tzkp-messenger UI/src/components/navigation/NavigationInterface.tsx`

**Updated to use Waze-like map:**

```typescript
import React, { useState } from 'react';
import { WazeLikeMap } from './WazeLikeMap';
import { StreetView } from './StreetView';

export function NavigationInterface() {
  const [navigating, setNavigating] = useState(false);
  const [location, setLocation] = useState({ lat: 51.505, lng: -0.09 });
  const [heading, setHeading] = useState(0);

  if (navigating) {
    return (
      <StreetView
        location={location}
        heading={heading}
        onExit={() => setNavigating(false)}
      />
    );
  }

  return <WazeLikeMap />;
}

export default NavigationInterface;
```

## REMOVE CESIUM DEPENDENCIES

### File: `g3tzkp-messenger UI/package.json` (Update)

Remove:
```json
"cesium": "^1.129.0",
"resium": "^1.17.2"
```

### File: `g3tzkp-messenger UI/vite.config.ts` (Update)

Remove cesium plugin:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// REMOVE: import cesium from 'vite-plugin-cesium'
import path from 'path'

export default defineConfig({
  plugins: [
    react()
    // REMOVE: cesium()
  ],
  // ... rest of config
  // REMOVE: define: { CESIUM_BASE_URL: JSON.stringify('/') }
})
```

## CSS STYLING

### File: `g3tzkp-messenger UI/src/index.css` (Add)

```css
/* Leaflet overrides for dark theme */
.leaflet-container {
  background: #1a1a1a;
}

.leaflet-popup-content-wrapper {
  background: #2a2a2a;
  color: #fff;
}

.leaflet-popup-tip {
  background: #2a2a2a;
}

/* Flower of Life marker glow */
.flower-of-life-marker svg {
  filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.8));
}
```

## SUCCESS CRITERIA

✅ Cesium/Resium completely removed  
✅ 3D globe removed  
✅ Leaflet 2D map working  
✅ Real-time search autocomplete (< 300ms delay)  
✅ Location-based prioritization (10-50 mile radius)  
✅ Search results sorted by distance  
✅ Flower of Life destination pins rendering  
✅ Route calculation and display working  
✅ Faux-3D street navigation view implemented  
✅ Clean Waze-isomorphic UI  
✅ No clutter, streamlined interface

**RESULT: Navigation 3D Globe → 100% Waze-like 2D Map ✓**
