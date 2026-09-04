import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface GoogleTrackingMapProps {
  customerCoords: [number, number];
  technicianCoords: [number, number];
  onRouteCalculated?: (coords: [number, number][], timeInSeconds: number) => void;
  className?: string;
}

// Estilo Minimalista estilo Uber / Snazzy Maps
const UBER_MINIMAL_STYLE: google.maps.MapTypeStyle[] = [
  {
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }]
  },
  {
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }]
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }]
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f5f5f5" }]
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }]
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e8f5e9" }]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dadada" }]
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }]
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }]
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }]
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#dbeafe" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }]
  }
];

// Decodificar Polyline de Google Routes
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export default function GoogleTrackingMap({
  customerCoords,
  technicianCoords,
  onRouteCalculated,
  className = 'h-full w-full'
}: GoogleTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const routeBgPolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeMainPolylineRef = useRef<google.maps.Polyline | null>(null);
  const destMarkerRef = useRef<google.maps.OverlayView | null>(null);
  const techMarkerRef = useRef<google.maps.OverlayView | null>(null);
  const animationRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    'AIzaSyA9aYa76-YBAGlanLejHQ55ipqUxX4vkd8';

  // 1. Inicializar el mapa de Google Maps con tema minimalista
  useEffect(() => {
    if (!mapRef.current) return;

    let isMounted = true;

    async function initMap() {
      try {
        setOptions({
          key: apiKey,
          v: 'weekly'
        });

        const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary;
        await importLibrary('geometry');

        if (!isMounted || !mapRef.current) return;

        const map = new Map(mapRef.current, {
          center: { lat: customerCoords[0], lng: customerCoords[1] },
          zoom: 15,
          styles: UBER_MINIMAL_STYLE,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy'
        });

        mapInstanceRef.current = map;
        setMapLoaded(true);
      } catch (err) {
        console.error('Error cargando Google Maps API:', err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  // 2. Crear / Actualizar Marcadores Personalizados y Ruta
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google) return;

    const google = window.google;
    const map = mapInstanceRef.current;

    // Helper para crear OverlayView (Marcadores HTML personalizados sin bordes feos)
    class HTMLMarkerOverlay extends google.maps.OverlayView {
      private position: google.maps.LatLng;
      private content: HTMLElement;

      constructor(position: google.maps.LatLng, content: HTMLElement) {
        super();
        this.position = position;
        this.content = content;
      }

      onAdd() {
        const panes = this.getPanes();
        if (panes && panes.overlayMouseTarget) {
          panes.overlayMouseTarget.appendChild(this.content);
        }
      }

      draw() {
        const projection = this.getProjection();
        if (!projection) return;
        const point = projection.fromLatLngToDivPixel(this.position);
        if (point) {
          this.content.style.position = 'absolute';
          this.content.style.left = `${point.x}px`;
          this.content.style.top = `${point.y}px`;
          this.content.style.transform = 'translate(-50%, -50%)';
          this.content.style.zIndex = '10';
        }
      }

      onRemove() {
        if (this.content.parentElement) {
          this.content.parentElement.removeChild(this.content);
        }
      }

      setPosition(newPos: google.maps.LatLng) {
        this.position = newPos;
        this.draw();
      }
    }

    // --- Marcador de Casa (Destino) ---
    if (!destMarkerRef.current) {
      const destDiv = document.createElement('div');
      destDiv.className = 'custom-google-dest-pin';
      destDiv.innerHTML = `
        <div style="
          background-color: #0F090B;
          border: 3px solid #FF5A0A;
          border-radius: 50%;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(0,0,0,0.35);
          cursor: pointer;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      `;
      const destOverlay = new HTMLMarkerOverlay(
        new google.maps.LatLng(customerCoords[0], customerCoords[1]),
        destDiv
      );
      destOverlay.setMap(map);
      destMarkerRef.current = destOverlay;
    } else {
      (destMarkerRef.current as any).setPosition(
        new google.maps.LatLng(customerCoords[0], customerCoords[1])
      );
    }

    // --- Marcador de Camión del Técnico ---
    let techDiv: HTMLElement;
    if (!techMarkerRef.current) {
      techDiv = document.createElement('div');
      techDiv.className = 'custom-google-tech-pin';
      techDiv.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #FF6B1A 0%, #FF5A0A 100%);
          border: 3px solid white;
          border-radius: 50%;
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(255, 90, 10, 0.45);
          cursor: pointer;
          position: relative;
        ">
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid #FF5A0A;
            opacity: 0.6;
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
            <path d="M15 18H9"/>
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
            <circle cx="17" cy="18" r="2"/>
            <circle cx="7" cy="18" r="2"/>
          </svg>
        </div>
      `;
      const techOverlay = new HTMLMarkerOverlay(
        new google.maps.LatLng(technicianCoords[0], technicianCoords[1]),
        techDiv
      );
      techOverlay.setMap(map);
      techMarkerRef.current = techOverlay;
    } else {
      (techMarkerRef.current as any).setPosition(
        new google.maps.LatLng(technicianCoords[0], technicianCoords[1])
      );
    }

    // --- Consultar y Dibujar Ruta con Tráfico ---
    let isCancelled = false;

    const fetchRoute = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start: technicianCoords, end: customerCoords })
        });

        const result = await response.json();

        if (result.success && !isCancelled && result.polyline) {
          const pathPoints = decodePolyline(result.polyline);
          const googlePath = pathPoints.map(p => ({ lat: p[0], lng: p[1] }));

          // 1. Línea Base (borde suave estilo Uber)
          if (routeBgPolylineRef.current) routeBgPolylineRef.current.setMap(null);
          routeBgPolylineRef.current = new google.maps.Polyline({
            path: googlePath,
            geodesic: true,
            strokeColor: '#FFFFFF',
            strokeOpacity: 0.9,
            strokeWeight: 8,
            map: map,
            zIndex: 1
          });

          // 2. Línea Principal (Color Naranja WIN)
          if (routeMainPolylineRef.current) routeMainPolylineRef.current.setMap(null);
          routeMainPolylineRef.current = new google.maps.Polyline({
            path: googlePath,
            geodesic: true,
            strokeColor: '#FF5A0A',
            strokeOpacity: 0.95,
            strokeWeight: 4,
            map: map,
            zIndex: 2
          });

          // 3. Ajustar Encuadre (fitBounds) con espacio inferior para el Bottom Sheet
          const bounds = new google.maps.LatLngBounds();
          googlePath.forEach(pt => bounds.extend(pt));
          map.fitBounds(bounds, {
            top: 70,
            left: 40,
            right: 40,
            bottom: 240
          });

          if (onRouteCalculated) {
            onRouteCalculated(pathPoints, result.durationSeconds || 0);
          }

          // 4. Animación suave del vehículo a lo largo de la ruta
          if (result.durationSeconds && result.durationSeconds > 0) {
            const startPt = pathPoints[0];
            const endPt = pathPoints[pathPoints.length - 1];
            const routeKey = `route_time_${startPt[0]}_${startPt[1]}_${endPt[0]}_${endPt[1]}`;
            const savedTime = localStorage.getItem(routeKey);
            const now = Date.now();
            let startTime = now;

            if (savedTime) {
              const parsed = parseInt(savedTime, 10);
              if (now - parsed < result.durationSeconds * 1000) {
                startTime = parsed;
              } else {
                localStorage.setItem(routeKey, now.toString());
              }
            } else {
              localStorage.setItem(routeKey, now.toString());
            }

            const totalDurationMs = result.durationSeconds * 1000;

            const animateStep = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / totalDurationMs, 1);

              if (pathPoints.length > 1) {
                const totalIndex = (pathPoints.length - 1) * progress;
                const idx = Math.floor(totalIndex);
                const remainder = totalIndex - idx;

                if (idx < pathPoints.length - 1) {
                  const p1 = pathPoints[idx];
                  const p2 = pathPoints[idx + 1];
                  const curLat = p1[0] + (p2[0] - p1[0]) * remainder;
                  const curLng = p1[1] + (p2[1] - p1[1]) * remainder;

                  if (techMarkerRef.current) {
                    (techMarkerRef.current as any).setPosition(
                      new google.maps.LatLng(curLat, curLng)
                    );
                  }
                } else if (pathPoints.length > 0) {
                  const last = pathPoints[pathPoints.length - 1];
                  if (techMarkerRef.current) {
                    (techMarkerRef.current as any).setPosition(
                      new google.maps.LatLng(last[0], last[1])
                    );
                  }
                }
              }

              if (progress < 1) {
                animationRef.current = requestAnimationFrame(animateStep);
              }
            };

            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            animationRef.current = requestAnimationFrame(animateStep);
          }
        }
      } catch (err) {
        console.error('Error calculando ruta en Google Maps:', err);
      }
    };

    fetchRoute();

    return () => {
      isCancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mapLoaded, customerCoords[0], customerCoords[1], technicianCoords[0], technicianCoords[1]]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="h-full w-full" />
    </div>
  );
}
