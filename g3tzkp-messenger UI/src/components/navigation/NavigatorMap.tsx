import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Coordinate, Route } from '../../types/navigation';
import { BusinessLeafletLayer } from '../business/BusinessLeafletLayer';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const currentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: `
    <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow-current">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#glow-current)">
        <circle cx="50" cy="50" r="15" fill="none" stroke="#00f3ff" stroke-width="2"/>
        <circle cx="50" cy="35" r="15" fill="none" stroke="#00f3ff" stroke-width="2"/>
        <circle cx="50" cy="65" r="15" fill="none" stroke="#00f3ff" stroke-width="2"/>
        <circle cx="63" cy="42.5" r="15" fill="none" stroke="#00f3ff" stroke-width="2"/>
        <circle cx="37" cy="42.5" r="15" fill="none" stroke="#00f3ff" stroke-width="2"/>
        <circle cx="63" cy="57.5" r="15" fill="none" stroke="#00f3ff" stroke-width="2"/>
        <circle cx="37" cy="57.5" r="15" fill="none" stroke="#00f3ff" stroke-width="2"/>
        <circle cx="50" cy="50" r="4" fill="#00f3ff"/>
      </g>
    </svg>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const destinationIcon = L.divIcon({
  className: 'destination-marker',
  html: `
    <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow-dest">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#glow-dest)">
        <path d="M18 0 C8 0 0 8 0 18 C0 28 18 48 18 48 C18 48 36 28 36 18 C36 8 28 0 18 0 Z" 
              fill="#4caf50" stroke="#000" stroke-width="2"/>
        <text x="18" y="24" 
              font-family="serif" 
              font-size="20" 
              font-style="italic" 
              fill="#000" 
              text-anchor="middle" 
              dominant-baseline="middle"
              font-weight="bold">φ</text>
      </g>
    </svg>
  `,
  iconSize: [36, 48],
  iconAnchor: [18, 48]
});

interface NavigatorMapProps {
  currentLocation?: Coordinate;
  destination?: Coordinate;
  route?: Route;
  onMapClick?: (coord: Coordinate) => void;
  onLocationFound?: (coord: Coordinate) => void;
  onRefreshLocation?: () => void;
  showTraffic?: boolean;
  className?: string;
  streetLevelMode?: boolean;
  heading?: number;
  showBusinessMarkers?: boolean;
}

const LocationMarker: React.FC<{
  onLocationFound?: (coord: Coordinate) => void;
  externalLocation?: Coordinate;
}> = ({ onLocationFound, externalLocation }) => {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const map = useMap();
  const initialFlyDone = useRef(false);
  const lastLocation = useRef<string>('');

  useEffect(() => {
    if (externalLocation) {
      const locationKey = `${externalLocation[0]},${externalLocation[1]}`;
      const latlng = new L.LatLng(externalLocation[1], externalLocation[0]);
      
      if (locationKey !== lastLocation.current) {
        setPosition(latlng);
        lastLocation.current = locationKey;
        
        if (!initialFlyDone.current) {
          console.log('[LocationMarker] Initial location, flying to:', externalLocation);
          map.flyTo(latlng, 14, { duration: 1.5 });
          initialFlyDone.current = true;
        }
      }
    }
  }, [externalLocation, map]);

  useMapEvents({
    locationfound(e) {
      setPosition(e.latlng);
      if (onLocationFound) {
        onLocationFound([e.latlng.lng, e.latlng.lat]);
      }
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={currentLocationIcon}>
      <Popup className="bg-black text-cyan-400 border border-cyan-800">
        <span className="font-mono text-sm">CURRENT_LOCATION</span>
      </Popup>
    </Marker>
  );
};

const MapClickHandler: React.FC<{
  onMapClick?: (coord: Coordinate) => void;
}> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick([e.latlng.lng, e.latlng.lat]);
      }
    },
  });
  return null;
};

const StreetLevelController: React.FC<{
  currentLocation?: Coordinate;
  heading: number;
  enabled: boolean;
}> = ({ currentLocation, heading, enabled }) => {
  const map = useMap();
  
  useEffect(() => {
    if (enabled && currentLocation) {
      const targetZoom = 18;
      const currentZoom = map.getZoom();
      
      if (currentZoom < targetZoom) {
        map.flyTo([currentLocation[1], currentLocation[0]], targetZoom, {
          duration: 1.5,
          easeLinearity: 0.5
        });
      } else {
        map.setView([currentLocation[1], currentLocation[0]], targetZoom, { animate: true });
      }
    }
  }, [enabled, currentLocation, map]);

  useEffect(() => {
    if (enabled && currentLocation) {
      map.panTo([currentLocation[1], currentLocation[0]], { animate: true, duration: 0.5 });
    }
  }, [currentLocation, enabled, map]);

  return null;
};

const NavigatorMap: React.FC<NavigatorMapProps> = ({
  currentLocation,
  destination,
  route,
  onMapClick,
  onLocationFound,
  onRefreshLocation,
  className = '',
  streetLevelMode = false,
  heading = 0,
  showBusinessMarkers = true
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const initialFlyDone = useRef(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefreshLocation = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    initialFlyDone.current = false;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coord: Coordinate = [position.coords.longitude, position.coords.latitude];
          console.log('[NavigatorMap] Refreshed location:', coord);
          if (onLocationFound) {
            onLocationFound(coord);
          }
          if (onRefreshLocation) {
            onRefreshLocation();
          }
          if (mapRef.current) {
            mapRef.current.flyTo([position.coords.latitude, position.coords.longitude], 15);
          }
          setIsRefreshing(false);
        },
        (error) => {
          console.error('[NavigatorMap] Refresh location error:', error.message);
          setIsRefreshing(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    } else {
      setIsRefreshing(false);
    }
  };

  const defaultCenter: L.LatLngExpression = currentLocation 
    ? [currentLocation[1], currentLocation[0]] 
    : [47.3769, 8.5417];

  const routeCoordinates = route?.geometry.coordinates.map(
    (coord): L.LatLngExpression => [coord[1], coord[0]]
  ) || [];

  return (
    <div className={`relative ${className}`} style={{ height: '100%', width: '100%' }}>
      <div style={{ height: '100%', width: '100%' }}>
          <MapContainer
            center={defaultCenter}
            zoom={streetLevelMode ? 18 : 13}
            style={{ height: '100%', width: '100%', background: '#000' }}
            ref={(map) => { if (map) mapRef.current = map; }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              className="map-tiles-dark"
            />

            <LocationMarker 
              onLocationFound={onLocationFound} 
              externalLocation={currentLocation}
            />
            <MapClickHandler onMapClick={onMapClick} />
            <StreetLevelController 
              currentLocation={currentLocation}
              heading={heading}
              enabled={streetLevelMode}
            />

            {showBusinessMarkers && <BusinessLeafletLayer />}

            {currentLocation && (
              <Marker 
                position={[currentLocation[1], currentLocation[0]]} 
                icon={currentLocationIcon}
              >
                <Popup>
                  <span className="font-mono text-sm text-cyan-400">START_POINT</span>
                </Popup>
              </Marker>
            )}

            {destination && (
              <Marker 
                position={[destination[1], destination[0]]} 
                icon={destinationIcon}
              >
                <Popup>
                  <span className="font-mono text-sm text-green-400">DESTINATION</span>
                </Popup>
              </Marker>
            )}

            {routeCoordinates.length > 0 && (
              <Polyline
                positions={routeCoordinates}
                pathOptions={{
                  color: streetLevelMode ? '#00ff88' : '#00f3ff',
                  weight: streetLevelMode ? 8 : 4,
                  opacity: 0.9,
                  dashArray: streetLevelMode ? undefined : '10, 5'
                }}
              />
            )}
          </MapContainer>
      </div>

      {!streetLevelMode && (
        <div className="absolute bottom-4 left-4 bg-black/80 border border-cyan-800 rounded px-3 py-2 z-[1000]">
          <div className="text-cyan-400 text-xs font-mono">
            GEODESIC_NAVIGATOR_v1.0
          </div>
          <div className="text-green-400 text-xs font-mono mt-1">
            OpenStreetMap | No Tracking
          </div>
        </div>
      )}


      <style>{`
        .leaflet-container {
          background: #000 !important;
          font-family: 'JetBrains Mono', monospace;
        }
        .leaflet-popup-content-wrapper {
          background: #000 !important;
          border: 1px solid #00f3ff !important;
          border-radius: 4px !important;
        }
        .leaflet-popup-content {
          margin: 8px 12px !important;
        }
        .leaflet-popup-tip {
          background: #000 !important;
          border: 1px solid #00f3ff !important;
        }
        .map-tiles-dark {
          filter: brightness(0.8) saturate(0.8);
        }
        .street-level-container {
          overflow: hidden;
        }
        .street-level-container .leaflet-container {
          filter: brightness(1.1) contrast(1.1) saturate(1.2);
        }
      `}</style>
    </div>
  );
};

export default NavigatorMap;
