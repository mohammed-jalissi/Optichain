import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Circle, Popup, Tooltip as LeafletTooltip, LayersControl, Polyline } from 'react-leaflet'
import { Filter, Download, AlertTriangle, Truck, Package, Scale, TrendingUp, DollarSign, Activity, Calculator } from 'lucide-react'
import Papa from 'papaparse'
import 'leaflet/dist/leaflet.css'
import './MapIntelligence.css'
import L from 'leaflet'

// Fix for default markers
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

// --- Geocoding Mapping ---
const CITY_COORDINATES: { [key: string]: [number, number] } = {
    'Casablanca': [33.5731, -7.5898],
    'Grand Casablanca': [33.5731, -7.5898],
    'Rabat': [34.0209, -6.8416],
    'Rabat-Salé-Kénitra': [34.0209, -6.8416],
    'Tanger': [35.7595, -5.8340],
    'Tanger-Tétouan-Al Hoceïma': [35.7595, -5.8340],
    'Marrakech': [31.6295, -7.9811],
    'Marrakech-Safi': [31.6295, -7.9811],
    'Agadir': [30.4278, -9.5981],
    'Souss-Massa': [30.4278, -9.5981],
    'Fès': [34.0181, -5.0078],
    'Fès-Meknès': [34.0181, -5.0078],
    'Oujda': [34.6814, -1.9076],
    'Oriental': [34.6814, -1.9076],
    'Beni Mellal': [32.3373, -6.3498],
    'Béni Mellal-Khénifra': [32.3373, -6.3498],
    'Meknès': [33.8938, -5.5516],
    'Kenitra': [34.2610, -6.5802],
    'Tetouan': [35.5785, -5.3684],
    'Safi': [32.3205, -9.2312],
    'Laâyoune': [27.1253, -13.1625],
    'Laâyoune-Sakia El Hamra': [27.1253, -13.1625],
    'Dakhla': [23.6848, -15.9579],
    'Dakhla-Oued Ed-Dahab': [23.6848, -15.9579],
    'Guelmim': [28.9864, -10.0573],
    'Guelmim-Oued Noun': [28.9864, -10.0573],
    'Errachidia': [31.9314, -4.4244],
    'Draâ-Tafilalet': [31.9314, -4.4244],
    'Mohammedia': [33.6872, -7.3912],
    'El Jadida': [33.2549, -8.5061],
    'Nador': [35.1681, -2.9335],
    'Taza': [34.2182, -4.0104],
    'Settat': [33.0010, -7.6166]
}

const HUB_COORDINATES: [number, number] = [33.5731, -7.5898] // Casablanca Hub

interface CityAggregate {
    name: string
    coordinates: [number, number]
    totalOrders: number
    delayedOrders: number
    avgDelay: number
    revenue: number
    totalWeight: number
    avgCostPerKg: number
    mainTransporteur: string
}

function MapIntelligence() {
    const [rawData, setRawData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // --- Intelligent Filters ---
    const [filterStatus, setFilterStatus] = useState<'all' | 'delayed' | 'on-time' | 'warning'>('all')
    const [filterTransporteur, setFilterTransporteur] = useState<string>('all')
    const [filterMinWeight, setFilterMinWeight] = useState<number>(0)

    // View Options
    const [showFlows, setShowFlows] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/data/bdd_log_clean_CORRIGE_updated.csv')
                const reader = response.body?.getReader()
                const result = await reader?.read()
                const decoder = new TextDecoder('utf-8')
                const csv = decoder.decode(result?.value)

                Papa.parse(csv, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        setRawData(results.data)
                        setLoading(false)
                    }
                })
            } catch (err) {
                console.error("Error loading map data:", err)
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    // --- Dynamic Filters & Aggregation Pipeline ---

    // 1. Get Unique Transporteurs for Dropdown
    const availableTransporteurs = useMemo(() => {
        const t = new Set(rawData.map(r => r.transporteur).filter(Boolean))
        return Array.from(t).sort()
    }, [rawData])

    // 2. Filter Raw Data
    const filteredRawData = useMemo(() => {
        return rawData.filter(row => {
            // Filter by Status
            const delay = parseFloat(row.retard)
            if (filterStatus === 'delayed' && delay === 0) return false
            if (filterStatus === 'on-time' && delay > 0) return false
            if (filterStatus === 'warning' && (delay === 0 || delay >= 2)) return false // Assuming warning is small delay

            // Filter by Transporteur
            if (filterTransporteur !== 'all' && row.transporteur !== filterTransporteur) return false

            // Filter by Weight
            const weight = parseFloat(row.poids_kg) || 0
            if (weight < filterMinWeight) return false

            return true
        })
    }, [rawData, filterStatus, filterTransporteur, filterMinWeight])

    // 3. Aggregate by City/Region
    const cityAggregates = useMemo(() => {
        const cities: { [key: string]: any } = {}

        filteredRawData.forEach(row => {
            // Priority to 'region' to ensure all regions from dataset are shown
            const locationName = row.region || row.client_ville || row.ville
            const normalizedCity = Object.keys(CITY_COORDINATES).find(c =>
                locationName && locationName.toLowerCase().includes(c.toLowerCase())
            )

            if (normalizedCity) {
                if (!cities[normalizedCity]) {
                    cities[normalizedCity] = {
                        total: 0,
                        delayed: 0,
                        totalDelayDays: 0,
                        transporteurs: {},
                        revenue: 0,
                        weight: 0
                    }
                }

                const entry = cities[normalizedCity]
                entry.total++
                const delay = parseFloat(row.retard)
                if (delay > 0) entry.delayed++
                entry.totalDelayDays += parseFloat(row.delai_livraison) || 0
                entry.revenue += parseFloat(row.cout_transport) || 0
                entry.weight += parseFloat(row.poids_kg) || 0

                const transp = row.transporteur
                entry.transporteurs[transp] = (entry.transporteurs[transp] || 0) + 1
            }
        })

        return Object.keys(cities).map(key => {
            const c = cities[key]
            const mainTransp = Object.entries(c.transporteurs).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A'

            return {
                name: key,
                coordinates: CITY_COORDINATES[key],
                totalOrders: c.total,
                delayedOrders: c.delayed,
                avgDelay: c.totalDelayDays / c.total,
                revenue: c.revenue,
                totalWeight: c.weight,
                avgCostPerKg: c.weight > 0 ? c.revenue / c.weight : 0,
                mainTransporteur: mainTransp as string
            } as CityAggregate
        })
    }, [filteredRawData])

    // 4. Calculate Global Vision Stats (for the visible filtered dataset)
    const globalStats = useMemo(() => {
        const totalVol = filteredRawData.length
        if (totalVol === 0) return null

        const totalDelayed = filteredRawData.filter(r => parseFloat(r.retard) > 0).length
        const totalRevenue = filteredRawData.reduce((acc, r) => acc + (parseFloat(r.cout_transport) || 0), 0)
        const avgDelay = filteredRawData.reduce((acc, r) => acc + (parseFloat(r.delai_livraison) || 0), 0) / totalVol

        return {
            volume: totalVol,
            otif: ((1 - totalDelayed / totalVol) * 100).toFixed(1),
            revenue: (totalRevenue / 1000).toFixed(1) + 'k',
            avgDelay: avgDelay.toFixed(1)
        }
    }, [filteredRawData])

    // --- Visual Helpers ---
    const getCircleColor = (city: CityAggregate) => {
        const delayRate = city.delayedOrders / city.totalOrders
        // Sophisticated Color Scale
        if (delayRate < 0.05) return '#00E676' // Vibrant Green
        if (delayRate < 0.15) return '#FFEA00' // Vibrant Yellow
        if (delayRate < 0.25) return '#FF9100' // Orange
        return '#FF1744' // Vibrant Red
    }

    const getCircleRadius = (totalOrders: number) => {
        // Logarithmic scale for better visual distribution
        return 5000 + Math.log(totalOrders || 1) * 3500
    }

    return (
        <div className="map-intelligence-container">
            {/* Intelligent Filter Bar */}
            <div className="map-toolbar glass-panel">
                <div className="toolbar-left">
                    <h1 className="toolbar-title"><Activity size={20} /> Vision Totale</h1>

                    <div className="filter-group">
                        <Filter size={14} className="filter-icon" />
                        <span className="filter-label">Statut:</span>
                        <select
                            className="glass-select"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                        >
                            <option value="all">Tout Afficher</option>
                            <option value="on-time">✅ À l'heure</option>
                            <option value="delayed">⚠️ En Retard</option>
                            <option value="warning">⚡ Attention (Léger)</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <Truck size={14} className="filter-icon" />
                        <span className="filter-label">Transporteur:</span>
                        <select
                            className="glass-select"
                            value={filterTransporteur}
                            onChange={(e) => setFilterTransporteur(e.target.value)}
                        >
                            <option value="all">Tous les partenaires</option>
                            {availableTransporteurs.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <Scale size={14} className="filter-icon" />
                        <span className="filter-label">Poids Min:</span>
                        <select
                            className="glass-select"
                            value={filterMinWeight}
                            onChange={(e) => setFilterMinWeight(Number(e.target.value))}
                        >
                            <option value={0}>Tous poids</option>
                            <option value={10}>&gt; 10 kg</option>
                            <option value={50}>&gt; 50 kg</option>
                            <option value={100}>&gt; 100 kg</option>
                        </select>
                    </div>
                </div>

                <div className="toolbar-right">
                    <button
                        className={`sim-toggle-btn ${showFlows ? 'active' : ''}`}
                        onClick={() => setShowFlows(!showFlows)}
                        title="Visualiser les flux physiques"
                    >
                        <TrendingUp size={16} /> Flux Réseau
                    </button>
                    <button className="export-btn">
                        <Download size={16} />
                    </button>
                </div>
            </div>

            <div className="map-layout">
                <div className="map-wrapper glass-panel">
                    {/* Global Stats Overlay */}
                    {globalStats && (
                        <div className="global-stats-overlay">
                            <div className="stat-pill">
                                <Package size={14} />
                                <span>Vol: <strong>{globalStats.volume}</strong></span>
                            </div>
                            <div className="stat-pill">
                                <Activity size={14} />
                                <span>OTIF: <strong style={{ color: parseFloat(globalStats.otif) > 90 ? '#00E676' : '#FF9100' }}>{globalStats.otif}%</strong></span>
                            </div>
                            <div className="stat-pill">
                                <AlertTriangle size={14} />
                                <span>Retard Moy: <strong>{globalStats.avgDelay}j</strong></span>
                            </div>
                            <div className="stat-pill">
                                <DollarSign size={14} />
                                <span>Coût: <strong>{globalStats.revenue} MAD</strong></span>
                            </div>
                        </div>
                    )}

                    <MapContainer
                        center={[31.7917, -7.0926]}
                        zoom={6}
                        style={{ height: '100%', width: '100%', borderRadius: 'var(--radius-md)' }}
                    >
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer checked name="Plan (Standard)">
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OSM'
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="Satellite">
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution='Tiles &copy; Esri'
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="Gris (Analytique)">
                                <TileLayer
                                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                    attribution='&copy; CARTO'
                                />
                            </LayersControl.BaseLayer>
                        </LayersControl>

                        {/* Visual Flows */}
                        {showFlows && cityAggregates.map((city) => (
                            city.name !== 'Casablanca' && (
                                <Polyline
                                    key={`flow-${city.name}`}
                                    positions={[HUB_COORDINATES, city.coordinates]}
                                    pathOptions={{
                                        color: '#2196F3',
                                        weight: Math.max(1, Math.log(city.totalOrders) / 1.2),
                                        opacity: 0.3,
                                        dashArray: '5, 10'
                                    }}
                                />
                            )
                        ))}

                        {/* City Clusters */}
                        {cityAggregates.map((city) => (
                            <Circle
                                key={city.name}
                                center={city.coordinates}
                                radius={getCircleRadius(city.totalOrders)}
                                pathOptions={{
                                    color: getCircleColor(city),
                                    fillColor: getCircleColor(city),
                                    fillOpacity: 0.65,
                                    weight: 2
                                }}
                            >
                                <Popup className="custom-popup">
                                    <div className="popup-content">
                                        <h3>{city.name}</h3>
                                        <div className="data-grid">
                                            <div className="data-item">
                                                <small>📦 Vol. Filtré</small>
                                                <strong>{city.totalOrders}</strong>
                                            </div>
                                            <div className="data-item">
                                                <small>⏱️ Tx Retard</small>
                                                <strong style={{ color: getCircleColor(city) }}>
                                                    {((city.delayedOrders / city.totalOrders) * 100).toFixed(1)}%
                                                </strong>
                                            </div>
                                            <div className="data-item">
                                                <small>🚚 Partenaire</small>
                                                <strong>{city.mainTransporteur}</strong>
                                            </div>
                                            <div className="data-item">
                                                <small>💰 Coût/Kg</small>
                                                <strong>{city.avgCostPerKg.toFixed(2)} Dh</strong>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                                <LeafletTooltip direction="top" offset={[0, -10]} opacity={0.9}>
                                    {city.name} ({city.totalOrders})
                                </LeafletTooltip>
                            </Circle>
                        ))}
                    </MapContainer>

                    <div className="map-legend-overlay">
                        <h4>Indice de Performance</h4>
                        <div className="stop-light">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span className="dot" style={{ background: '#00E676' }}></span> <small>Excellent (&gt;95%)</small>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span className="dot" style={{ background: '#FFEA00' }}></span> <small>Bon (85-95%)</small>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span className="dot" style={{ background: '#FF1744' }}></span> <small>Critique (&lt;70%)</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MapIntelligence
