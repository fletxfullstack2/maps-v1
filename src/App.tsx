import { useEffect, useState } from "react";
import polyline from "polyline";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import "leaflet/dist/leaflet.css";

// Interfaces de tipos
interface RoutingProps {
  start: [number, number];
  end: [number, number];
  vehicleLocation: [number, number];
  isRouting: boolean;
}

interface RouteInfo {
  geometry: [number, number][];
  distance: number;
  duration: number;
}

interface MapInfo {
  totalDistanceKm: string;
  vehicleToTargetKm: string;
  progressPercent: string;
  estimatedTime: string;
  totalEstimatedTime: string;
}

interface OsrmRoute {
  geometry: string;
  legs: {
    steps: { geometry: string }[];
  }[];
  distance: number;
  duration: number;
}

interface OsrmResponse {
  routes: OsrmRoute[];
  waypoints: any[];
  code: string;
}

// Configuración de constantes
const OSRM_SERVER = "https://dev.enrutat.com/map/route/v1/driving";

// Íconos
const greenIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const carIcon = new L.Icon({
  iconUrl:
    "https://awsfletxwhatsappfiles.s3.us-east-1.amazonaws.com/Camion+Terpel.png",
  iconSize: [40, 32],
  iconAnchor: [20, 20],
  popupAnchor: [0, -16],
});

// Función para calcular distancia entre puntos
function getDistance(a: [number, number], b: [number, number]): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371e3; // Radio de la Tierra en metros
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);

  const aVal =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}
// Función para calcular progreso ajustado según isRouting
function getProgress(
  vehicle: [number, number],
  start: [number, number],
  end: [number, number],
  routeDistance: number,
  isRouting: boolean
): number | string {
  // Cambié el tipo a string o number
  if (!isRouting) {
    return "En trayecto a la planta"; // Si no estamos en routing, no calculamos el progreso y mostramos este mensaje
  }

  if (routeDistance <= 0) return 0;

  // Determinar el punto objetivo según isRouting
  const target = isRouting ? end : start;
  const referencePoint = isRouting ? start : end;

  const distanceToTarget = getDistance(vehicle, target);
  const totalDistance = getDistance(referencePoint, target);

  const coveredDistance = totalDistance - distanceToTarget;
  const percent = (coveredDistance / totalDistance) * 100;

  return Math.min(Math.max(percent, 0), 100);
}

// Componente para efectos del mapa
function MapEffect({
  start,
  end,
  vehicleLocation,
  isRouting,
  setInfo,
}: RoutingProps & { setInfo: (info: MapInfo) => void }) {
  const map = useMap();
  const [fullRoute, setFullRoute] = useState<RouteInfo>({
    geometry: [],
    distance: 0,
    duration: 0,
  });
  const [currentRoute, setCurrentRoute] = useState<RouteInfo>({
    geometry: [],
    distance: 0,
    duration: 0,
  });

  useEffect(() => {
    const updateRoutes = async () => {
      try {
        // Calcular ruta completa (start -> end)
        const full = await calculateRoute(start, end);
        setFullRoute(full);

        // Calcular ruta actual (vehicle -> target)
        const target = isRouting ? end : start;
        const current = await calculateRoute(vehicleLocation, target);
        setCurrentRoute(current);

        // Calcular progreso según isRouting
        const progress = getProgress(
          vehicleLocation,
          start,
          end,
          full.distance,
          isRouting
        );

        setInfo({
          totalDistanceKm: (full.distance / 1000).toFixed(2),
          vehicleToTargetKm: (current.distance / 1000).toFixed(2),
          progressPercent:
            typeof progress === "string" ? progress : progress.toFixed(2), // Aquí verificamos si es el string o el porcentaje
          estimatedTime: formatDuration(current.duration),
          totalEstimatedTime: formatDuration(full.duration),
        });

        // Ajustar vista del mapa
        const allPoints = [
          start,
          end,
          vehicleLocation,
          ...full.geometry,
          ...current.geometry,
        ];

        if (allPoints.length > 0) {
          const bounds = L.latLngBounds(allPoints);
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error("Error al actualizar rutas:", error);
      }
    };

    updateRoutes();
    const interval = setInterval(updateRoutes, 60000);
    return () => clearInterval(interval);
  }, [start, end, vehicleLocation, isRouting, map, setInfo]);

  return (
    <>
      {fullRoute.geometry.length > 0 && (
        <Polyline positions={fullRoute.geometry} color="green" weight={4} />
      )}

      {currentRoute.geometry.length > 0 && (
        <Polyline
          positions={currentRoute.geometry}
          color={isRouting ? "red" : "blue"}
          weight={4}
          dashArray="5, 10"
        />
      )}
    </>
  );
}

// Función para formatear duración
function formatDuration(seconds: number): string {
  if (seconds <= 0 || isNaN(seconds)) return "0h 0m";
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

// Función para calcular rutas
async function calculateRoute(
  from: [number, number],
  to: [number, number]
): Promise<RouteInfo> {
  try {
    const fromStr = `${from[1]},${from[0]}`;
    const toStr = `${to[1]},${to[0]}`;

    const url = `${OSRM_SERVER}/${fromStr};${toStr}?overview=full&geometries=polyline`;
    const res = await axios.get<OsrmResponse>(url);
    const data = res.data;

    if (!data.routes || data.routes.length === 0) {
      console.warn("OSRM no devolvió ninguna ruta válida");
      return { distance: 0, duration: 0, geometry: [] };
    }

    const route = data.routes[0];
    const decoded = polyline.decode(route.geometry);
    const geometry: [number, number][] = decoded.map((point: any) => [
      point[0],
      point[1],
    ]);

    return {
      distance: route.distance,
      duration: route.duration,
      geometry,
    };
  } catch (error) {
    console.error("Error al calcular la ruta:", error);
    return { distance: 0, duration: 0, geometry: [] };
  }
}

// Componente principal
export default function App(props: RoutingProps) {
  const [info, setInfo] = useState<MapInfo>({
    totalDistanceKm: "0",
    vehicleToTargetKm: "0",
    progressPercent: "0",
    estimatedTime: "0h 0m",
    totalEstimatedTime: "0h 0m",
  });

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <MapContainer
        center={props.vehicleLocation}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "500px", width: "100%" }}
        worldCopyJump={true}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={props.start} icon={greenIcon}>
          <Popup>Punto de inicio</Popup>
        </Marker>
        <Marker position={props.end} icon={redIcon}>
          <Popup>Punto de destino</Popup>
        </Marker>
        <Marker position={props.vehicleLocation} icon={carIcon}>
          <Popup>Posición actual del vehículo</Popup>
        </Marker>
        <MapEffect {...props} setInfo={setInfo} />
      </MapContainer>

      <div className="bg-white p-4 rounded shadow w-full max-w-xl text-center text-sm">
        <p>
          🟩 Ruta completa: <strong>{info.totalDistanceKm} km</strong>
        </p>
        <p>
          {props.isRouting
            ? "🔴 Distancia al destino:"
            : "🔵 Distancia al origen:"}{" "}
          <strong>{info.vehicleToTargetKm} km</strong>
        </p>
        <p>
          📍 Progreso: <strong>{info.progressPercent}</strong>
        </p>
        <p>
          ⏱️ Tiempo estimado: <strong>{info.estimatedTime}</strong>
        </p>
        <p>
          ⏲️ Tiempo total del trayecto entre planta y destino: <strong>{info.totalEstimatedTime}</strong>
        </p>

        {info.totalDistanceKm === "0" && (
          <p className="text-red-600 font-semibold">
            ⚠️ No se pudo calcular la ruta. Verifica las coordenadas.
          </p>
        )}
      </div>
    </div>
  );
}
