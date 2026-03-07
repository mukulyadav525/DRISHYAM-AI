"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Hotspot {
    name: string;
    lng: number;
    lat: number;
    intensity: string;
}

interface IndiaMapProps {
    hotspots?: Hotspot[];
}

export default function IndiaMap({ hotspots = [] }: IndiaMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        try {
            // Using a basic local-compatible style or OpenFreeMap with fallback
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: {
                    version: 8,
                    sources: {
                        'osm': {
                            type: 'raster',
                            tiles: [
                                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'
                            ],
                            tileSize: 256,
                            attribution: '&copy; OpenStreetMap Contributors'
                        }
                    },
                    layers: [
                        {
                            id: 'osm-layer',
                            type: 'raster',
                            source: 'osm',
                            layout: { visibility: 'visible' },
                            paint: { 'raster-opacity': 0.15 } // Faded look for tech theme
                        }
                    ]
                },
                center: [78.9629, 22.5937],
                zoom: 4,
                attributionControl: false
            });

            map.current.on('error', (e) => {
                console.error('MapLibre Error:', e);
                // Non-fatal errors (like tiles failing) shouldn't break the UI
            });

            map.current.on('load', () => {
                if (!map.current) return;

                // Load the OFFICIAL GeoJSON
                map.current.addSource('india-boundary', {
                    type: 'geojson',
                    data: '/data/india.json'
                });

                // Land fill with glow effect
                map.current.addLayer({
                    id: 'india-fill',
                    type: 'fill',
                    source: 'india-boundary',
                    paint: {
                        'fill-color': '#0f172a',
                        'fill-opacity': 0.8
                    }
                });

                // Borders - OFFICIAL SCALE
                map.current.addLayer({
                    id: 'india-border',
                    type: 'line',
                    source: 'india-boundary',
                    paint: {
                        'line-color': '#F97316',
                        'line-width': 1.5,
                        'line-opacity': 0.8
                    }
                });

                // Add pulse markers
                hotspots.forEach((spot) => {
                    const el = document.createElement('div');
                    el.className = 'map-marker';

                    const pulse = document.createElement('div');
                    pulse.className = `pulse-ring ${spot.intensity === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'}`;
                    el.appendChild(pulse);

                    const dot = document.createElement('div');
                    dot.className = `dot ${spot.intensity === 'CRITICAL' ? 'bg-red-600' : 'bg-orange-400'}`;
                    el.appendChild(dot);

                    new maplibregl.Marker({ element: el })
                        .setLngLat([spot.lng, spot.lat])
                        .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false })
                            .setHTML(`<div class="p-3 bg-white rounded-xl shadow-xl border border-silver/20 min-w-[120px]">
                                        <p class="text-[9px] font-black text-silver uppercase tracking-widest mb-1">${spot.intensity} SECTOR</p>
                                        <p class="text-xs font-bold text-indblue font-sans">${spot.name}</p>
                                      </div>`))
                        .addTo(map.current!);
                });

                // Resize to fit container
                map.current.resize();
            });

        } catch (err: any) {
            setMapError(err.message);
        }

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    return (
        <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/5 bg-[#0b1739] shadow-inner group">
            {mapError ? (
                <div className="absolute inset-0 flex items-center justify-center text-red-400 text-xs font-mono p-4 text-center">
                    [ERROR] GEO_INT_PIPELINE_FAILURE: {mapError}
                </div>
            ) : (
                <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
            )}

            {/* GRID SCANNING OVERLAY */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10"
                style={{ backgroundSize: '100% 2px, 3px 100%' }} />

            <div className="absolute top-4 left-4 z-20 space-y-2 pointer-events-none">
                <div className="bg-indblue/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-2xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-indgreen animate-pulse" />
                    <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">Geo-Intelligence Layer: ACTIVE</span>
                </div>
                <div className="flex gap-2">
                    <div className="bg-black/40 backdrop-blur-sm border border-white/5 px-2 py-1 rounded-lg text-[8px] font-mono text-white/40">
                        OFFICIAL COMMAND GRID v4.2
                    </div>
                    <div className="bg-black/40 backdrop-blur-sm border border-white/5 px-2 py-1 rounded-lg text-[8px] font-mono text-white/40">
                        SIG_INT: SECURE
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md border border-white/5 px-3 py-1.5 rounded-xl text-[9px] font-mono text-white/60">
                    LAT: 22.59 N | LNG: 78.96 E
                </div>
            </div>

            <style jsx global>{`
                .map-marker {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                }
                .pulse-ring {
                    position: absolute;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    animation: map-pulse 2s infinite;
                    opacity: 0.5;
                }
                .dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    z-index: 2;
                    border: 2px solid white;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                }
                @keyframes map-pulse {
                    0% { transform: scale(0.5); opacity: 0.8; }
                    100% { transform: scale(3); opacity: 0; }
                }
                .maplibregl-popup-content {
                    background: transparent !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .maplibregl-popup-tip {
                    display: none;
                }
            `}</style>
        </div>
    );
}
