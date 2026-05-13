import { useEffect, useState, useContext, useRef, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast'; // IMPORTED TOAST

import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Popup,
  CircleMarker,
  useMap,
} from 'react-leaflet';

import {
  Play,
  Square,
  Activity,
  LocateFixed,
  Trophy,
  User as UserIcon,
} from 'lucide-react';

import 'leaflet/dist/leaflet.css';

import LeaderboardPanel from '../components/LeaderboardPanel';
import ProfilePanel from '../components/ProfilePanel';

// ======================================================
// RE-CENTER CONTROL
// ======================================================

function RecenterControl({ position }) {
  const map = useMap();

  return (
    <button
      onClick={() => map.flyTo(position, 18, { animate: true })}
      className="absolute bottom-28 right-6 z-[1000]
                 bg-gray-800/80 backdrop-blur-md
                 border border-gray-600
                 p-3 rounded-full shadow-lg
                 text-blue-400 hover:text-blue-300
                 hover:bg-gray-700 transition-all"
    >
      <LocateFixed size={24} />
    </button>
  );
}

// ======================================================
// GPS DISTANCE HELPER
// ======================================================

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const rad = Math.PI / 180;

  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const MAX_HUMAN_SPEED = 7; // m/s (~25 km/h)
const TELEPORT_SPEED = 10; // m/s
const MAX_GPS_ACCURACY = 40; // meters
const CHEAT_WARNING_LIMIT = 3;
const GPS_SAMPLE_SECONDS = 2;

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function MapDashboard() {
  const { token } = useContext(AuthContext);

  const [territories, setTerritories] = useState([]);
  const [position, setPosition] = useState(null);

  const [isTracking, setIsTracking] = useState(false);
  const [activeRunId, setActiveRunId] = useState(null);

  const [routePoints, setRoutePoints] = useState([]);
  const [currentDistance, setCurrentDistance] = useState(0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  const [liveSpeed, setLiveSpeed] = useState(0);
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [isCheatPaused, setIsCheatPaused] = useState(false);

  // ======================================================
  // REFS
  // ======================================================
  const watchIdRef = useRef(null);
  const syncingRef = useRef(false);
  const latestPointRef = useRef(null);
  const pendingPointsRef = useRef([]);
  const syncIntervalRef = useRef(null);
  const wakeLockRef = useRef(null); // Ref for wake lock
  const cheatWarningsRef = useRef(0);
  const isCheatPausedRef = useRef(false);

  useEffect(() => {
    cheatWarningsRef.current = cheatWarnings;
  }, [cheatWarnings]);

  useEffect(() => {
    isCheatPausedRef.current = isCheatPaused;
  }, [isCheatPaused]);

  // ======================================================
  // INITIAL GPS + TERRITORIES
  // ======================================================

  useEffect(() => {
    const controller = new AbortController();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.error('GPS Error:', err);
        if (err.code === err.PERMISSION_DENIED) {
           toast.error("GPS access denied. Please enable location to play.", { duration: 5000 });
        }
      },
      { enableHighAccuracy: true }
    );

    fetchTerritories(controller.signal);

    return () => {
      controller.abort();
    };
  }, [token]);

  // ======================================================
  // FETCH TERRITORIES
  // ======================================================

  const fetchTerritories = async (signal) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/territories`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await res.json();
      if (data.success) {
        setTerritories(data.territories);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Failed to fetch territories', err);
    }
  };

  // ======================================================
  // TERRITORY MEMOIZATION
  // ======================================================

  const territoryPolygons = useMemo(() => {
    return territories.map((territory) => {
      const leafletCoords = territory.boundary.coordinates[0].map(
        (coord) => [coord[1], coord[0]]
      );

      return (
        <Polygon
          key={territory._id}
          positions={leafletCoords}
          pathOptions={{
            color: territory.color,
            fillColor: territory.color,
            fillOpacity: 0.3,
            weight: 2,
          }}
        >
          <Popup>
            <div className="font-bold text-center">{territory.name}</div>
          </Popup>
        </Polygon>
      );
    });
  }, [territories]);

  // ======================================================
  // GPS SYNC ENGINE (Batch sync every 2 seconds)
  // ======================================================

  useEffect(() => {
    if (!isTracking || !activeRunId) return;

    syncIntervalRef.current = setInterval(async () => {
      if (syncingRef.current || pendingPointsRef.current.length === 0) return;
      syncingRef.current = true;
      const controller = new AbortController();

      try {
        const pointsToSend = [...pendingPointsRef.current];
        pendingPointsRef.current = [];

        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/runs/${activeRunId}/batch-points`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
            body: JSON.stringify({ points: pointsToSend }),
          }
        );

        const data = await res.json();
        if (data.success) setCurrentDistance(data.distance);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to sync points', err);
          pendingPointsRef.current.unshift(...pendingPointsRef.current);
        }
      } finally {
        syncingRef.current = false;
      }
    }, 2000);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isTracking, activeRunId, token]);

  // ======================================================
  // LIVE GPS WATCHER
  // ======================================================

  useEffect(() => {
    if (!isTracking || !activeRunId) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const rawSpeed = pos.coords.speed ?? 0;
        const accuracy = pos.coords.accuracy ?? 999;
        const altitude = pos.coords.altitude || 0;

        const newPoint = [lat, lng];

        setPosition(newPoint);

        if (accuracy > MAX_GPS_ACCURACY) {
          console.log('Ignoring inaccurate GPS point');
          return;
        }

        let computedSpeed = rawSpeed;
        const lastPoint = latestPointRef.current;

        if (lastPoint) {
          const movedDistance = getDistance(
            lastPoint[0],
            lastPoint[1],
            lat,
            lng
          );

          if (movedDistance < 1.5) return;

          if (!rawSpeed && movedDistance > 0) {
            computedSpeed = movedDistance / GPS_SAMPLE_SECONDS;
          }
        }

        setLiveSpeed(computedSpeed * 3.6);

        if (computedSpeed > TELEPORT_SPEED) {
          const nextWarnings = cheatWarningsRef.current + 1;

          setCheatWarnings(nextWarnings);
          cheatWarningsRef.current = nextWarnings;

          if (nextWarnings >= CHEAT_WARNING_LIMIT) {
            setIsCheatPaused(true);
            isCheatPausedRef.current = true;

            toast.error(
              'Suspicious movement detected. Tracking paused.',
              {
                id: 'cheat-paused',
                duration: 5000,
              }
            );
          }

          return;
        }

        if (computedSpeed > MAX_HUMAN_SPEED) {
          const nextWarnings = cheatWarningsRef.current + 1;

          setCheatWarnings(nextWarnings);
          cheatWarningsRef.current = nextWarnings;

          toast.error('Speed too high for on-foot tracking', {
            id: 'speed-warning',
          });

          return;
        }

        if (isCheatPausedRef.current && computedSpeed <= MAX_HUMAN_SPEED) {
          setIsCheatPaused(false);
          isCheatPausedRef.current = false;

          setCheatWarnings(0);
          cheatWarningsRef.current = 0;

          toast.success('Tracking resumed', {
            id: 'tracking-resumed',
          });
        }

        if (isCheatPausedRef.current) return;

        latestPointRef.current = newPoint;
        setRoutePoints((prev) => [...prev, newPoint]);

        pendingPointsRef.current.push({
          coordinates: [lng, lat],
          speed: computedSpeed,
          altitude,
          timestamp: Date.now(),
        });
      },
      (err) => console.error('Watch Error:', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isTracking, activeRunId]);

  // ======================================================
  // START RUN
  // ======================================================

  const handleStartRun = async () => {
    if (!position) return;

    // Wake Lock: Keep phone screen from sleeping during a run on mobile web
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.log('Wake Lock failed', err);
      }
    }

    const controller = new AbortController();

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/runs/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        body: JSON.stringify({ startCoordinates: [position[1], position[0]] }),
      });

      const data = await res.json();

      if (data.success) {
        setActiveRunId(data.run._id);
        setRoutePoints([position]);
        latestPointRef.current = position;
        pendingPointsRef.current = [];
        setCurrentDistance(0);
        setLiveSpeed(0);
        setCheatWarnings(0);
        setIsCheatPaused(false);

        cheatWarningsRef.current = 0;
        isCheatPausedRef.current = false;
        setIsTracking(true);
        
        toast.success('Run Started! GPS Active.', {
          icon: '🏃‍♂️',
          style: { borderRadius: '10px', background: '#333', color: '#fff' },
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Failed to start run', err);
    }
  };

  // ======================================================
  // END RUN
  // ======================================================

  const handleEndRun = async () => {
    setIsTracking(false);
    
    // Release wake lock so screen can sleep normally again
    if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => { wakeLockRef.current = null; });
    }

    const controller = new AbortController();

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/runs/${activeRunId}/end`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      const data = await res.json();

      if (data.success) {
        setActiveRunId(null);
        setRoutePoints([]);
        setLiveSpeed(0);
        setCheatWarnings(0);
        setIsCheatPaused(false);

        cheatWarningsRef.current = 0;
        isCheatPausedRef.current = false;
        latestPointRef.current = null;
        pendingPointsRef.current = [];

        fetchTerritories(controller.signal);

        const capturedCount = data.run.territoriesCaptured?.length || 0;
        
        if (capturedCount > 0) {
           toast.success(`Run Complete! You captured ${capturedCount} territories! ⚔️`, {
             duration: 5000,
             style: { background: '#1e40af', color: '#fff', fontWeight: 'bold' }
           });
        } else {
           toast.success(`Run Complete! Distance: ${Math.round(data.run.distance)}m`, {
             icon: '🏁',
             style: { background: '#333', color: '#fff' }
           });
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Failed to end run', err);
    }
  };

  // ======================================================
  // LOADING
  // ======================================================

  if (!position) {
    return (
      <div className="h-[100dvh] w-full bg-gray-900 flex flex-col items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
        <p className="animate-pulse">Acquiring GPS Signal...</p>
      </div>
    );
  }

  // ======================================================
  // MAIN UI
  // ======================================================

  return (
    <div className="h-[100dvh] w-full relative bg-gray-900 overflow-hidden">
      <MapContainer
        center={position}
        zoom={18}
        zoomControl={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
        />

        <CircleMarker
          center={position}
          radius={8}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#60a5fa',
            fillOpacity: 1,
            weight: 3,
          }}
        />

        {territoryPolygons}

        {isTracking && routePoints.length > 0 && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#06b6d4',
              weight: 5,
              dashArray: '10, 10',
            }}
          />
        )}

        <RecenterControl position={position} />
      </MapContainer>

      {/* TOP HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-[1000] pointer-events-none">
        <div className="pointer-events-auto">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="bg-gray-800/90 backdrop-blur-md border border-gray-600 p-3 rounded-2xl shadow-lg text-white hover:bg-gray-700 transition-all flex items-center gap-2"
          >
            <UserIcon size={24} className="text-blue-400" />
          </button>
        </div>

        <div className="flex-1 flex justify-center pointer-events-none">
          {isTracking && (
            <div className="bg-gray-800/90 backdrop-blur-md px-5 py-2 rounded-full border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-3 pointer-events-auto">
              <Activity className="text-cyan-400 animate-pulse" size={20} />
              <div className="flex flex-col items-center">
              <p className="text-xl font-black text-white leading-none tracking-wide">
                {Math.round(currentDistance)}m
              </p>

              <p className="text-sm text-cyan-300 font-bold">
                {liveSpeed.toFixed(1)} km/h
              </p>
            </div>
            </div>
          )}
        </div>

        <div className="pointer-events-auto">
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="bg-gray-800/90 backdrop-blur-md border border-gray-600 p-3 rounded-2xl shadow-lg text-white hover:bg-gray-700 transition-all flex items-center gap-2"
          >
            <Trophy size={24} className="text-yellow-500" />
          </button>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="absolute bottom-10 left-0 w-full flex justify-center z-[1000]">
        {!isTracking ? (
          <button
            onClick={handleStartRun}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-full font-black text-xl shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all transform hover:scale-105 active:scale-95 border-2 border-blue-400"
          >
            <Play fill="currentColor" size={28} />
            TAP TO RUN
          </button>
        ) : (
          <button
            onClick={handleEndRun}
            className="flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white px-10 py-5 rounded-full font-black text-xl shadow-[0_0_30px_rgba(220,38,38,0.6)] transition-all animate-pulse border-2 border-red-400 active:scale-95"
          >
            <Square fill="currentColor" size={28} />
            STOP RUN
          </button>
        )}
      </div>

      <ProfilePanel isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <LeaderboardPanel isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
    </div>
  );
}