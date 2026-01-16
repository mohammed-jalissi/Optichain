import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Circle, Popup, Tooltip as LeafletTooltip, LayersControl, Polyline } from 'react-leaflet'
import { Filter, Download, AlertTriangle, Truck, Package, Scale, TrendingUp, DollarSign, Activity, Globe } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import './MapIntelligence.css'
import L from 'leaflet'
import { useData } from '../context/DataContext'

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
    mainTransporteur: string
}

function MapIntelligence() {
    const { data: rawData, loading } = useData()

    // --- Intelligent Filters ---
    const [filterStatus, setFilterStatus] = useState<'all' | 'delayed' | 'on-time' | 'warning'>('all')
    const [filterTransporteur, setFilterTransporteur] = useState<string>('all')
    const [filterMinWeight, setFilterMinWeight] = useState<number>(0)

    // View Options
    const [showFlows, setShowFlows] = useState(true)

    // 1. Get Unique Transporteurs for Dropdown
    const availableTransporteurs = useMemo(() => {
        const t = new Set(rawData.map(r => r.transporteur).filter(Boolean))
        return Array.from(t).sort()
    }, [rawData])

    // 2. Filter Raw Data
    // Helper to extract numeric values safely
    const getNum = (val: any) => typeof val === 'number' ? val : (parseFloat(val) || 0)

    const filteredRawData = useMemo(() => {
        return rawData.filter(row => {
            // Filter by Status
            const delay = getNum(row.retard)
            if (filterStatus === 'delayed' && delay === 0) return false
            if (filterStatus === 'on-time' && delay > 0) return false
            if (filterStatus === 'warning' && (delay === 0 || delay >= 2)) return false

            // Filter by Transporteur
            if (filterTransporteur !== 'all' && row.transporteur !== filterTransporteur) return false

            // Filter by Weight
            const weight = getNum(row.poids_kg)
            if (weight < filterMinWeight) return false

            return true
        })
    }, [rawData, filterStatus, filterTransporteur, filterMinWeight])

    // 3. Aggregate by City/Region
    const cityAggregates = useMemo(() => {
        const cities: { [key: string]: any } = {}

        filteredRawData.forEach(row => {
            const locationName = row.region || row.client_ville || row.ville
            const normalizedCity = Object.keys(CITY_COORDINATES).find(c =>
                locationName && locationName.toLowerCase().includes(c.toLowerCase())
            )

            if (normalizedCity) {
                if (!cities[normalizedCity]) {
                    cities[normalizedCity] = { total: 0, delayed: 0, totalDelayDays: 0, transporteurs: {}, revenue: 0, weight: 0 }
                }

                const entry = cities[normalizedCity]
                entry.total++

                if (getNum(row.retard) > 0) entry.delayed++

                entry.totalDelayDays += getNum(row.delai_livraison)
                entry.revenue += getNum(row.cout_transport)
                entry.weight += getNum(row.poids_kg)

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
                mainTransporteur: mainTransp as string
            } as CityAggregate
        })
    }, [filteredRawData])

    // 4. Global Stats
    const globalStats = useMemo(() => {
        const totalVol = filteredRawData.length
        if (totalVol === 0) return null

        const totalDelayed = filteredRawData.filter(r => getNum(r.retard) > 0).length
        const totalRevenue = filteredRawData.reduce((acc, r) => acc + getNum(r.cout_transport), 0)
        const avgDelay = filteredRawData.reduce((acc, r) => acc + getNum(r.delai_livraison), 0) / totalVol

        return {
            volume: totalVol,
            otif: ((1 - totalDelayed / totalVol) * 100).toFixed(1),
            revenue: (totalRevenue / 1000).toFixed(1) + 'k',
            avgDelay: avgDelay.toFixed(1)
        }
    }, [filteredRawData])

    if (loading) return <div className="loading">Chargement de la carte...</div>

    return (
        <div className="map-intelligence-container">
            <div className="map-toolbar">
                <div className="toolbar-left">
                    <h2 className="toolbar-title"><Activity size={20} /> Vision Totale</h2>

                    <div className="filter-group">
                        <span className="filter-label">Statut:</span>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="glass-select"
                        >
                            <option value="all">Tous</option>
                            <option value="delayed">Retards</option>
                            <option value="on-time">À l'heure</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <span className="filter-label">Transporteur:</span>
                        <select
                            value={filterTransporteur}
                            onChange={(e) => setFilterTransporteur(e.target.value)}
                            className="glass-select"
                        >
                            <option value="all">Tous</option>
                            {availableTransporteurs.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="toolbar-right">
                    <button
                        className={`sim-toggle-btn ${showFlows ? 'active' : ''}`}
                        onClick={() => setShowFlows(!showFlows)}
                    >
                        <Activity size={16} /> Flux
                    </button>
                </div>
            </div>

            <div className="map-layout">
                <div className="map-wrapper">
                    <MapContainer center={[31.7917, -7.0926]} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer checked name="Dark Matter">
                                <TileLayer
                                    attribution='&copy; CARTO'
                                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="OpenStreetMap">
                                <TileLayer
                                    attribution='&copy; OSM'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                            </LayersControl.BaseLayer>
                        </LayersControl>

                        {/* Hub Marker */}
                        <Circle
                            center={HUB_COORDINATES}
                            pathOptions={{ color: '#00d9ff', fillColor: '#00d9ff', fillOpacity: 0.8 }}
                            radius={15000}
                        />

                        {/* City Clusters */}
                        {cityAggregates.map((city) => {
                            const radius = Math.max(5000, Math.sqrt(city.totalOrders) * 1000)
                            const isProblematic = city.avgDelay > 1
                            const color = isProblematic ? '#ff3366' : '#00ff88'

                            return (
                                <div key={city.name}>
                                    <Circle
                                        center={city.coordinates}
                                        pathOptions={{ color: color, fillColor: color, fillOpacity: 0.4 }}
                                        radius={radius}
                                    >
                                        <Popup className="custom-popup">
                                            <div className="popup-content">
                                                <h3>{city.name}</h3>
                                                <div className="data-grid">
                                                    <div className="data-item">
                                                        <small>Volume</small>
                                                        <strong>{city.totalOrders}</strong>
                                                    </div>
                                                    <div className="data-item">
                                                        <small>Retards</small>
                                                        <strong style={{ color: isProblematic ? '#ff3366' : '#00ff88' }}>
                                                            {city.delayedOrders}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </div>
                                        </Popup>
                                    </Circle>
                                    {showFlows && <Polyline positions={[HUB_COORDINATES, city.coordinates]} pathOptions={{ color: color, weight: 1, opacity: 0.3 }} />}
                                </div>
                            )
                        })}
                    </MapContainer>

                    {globalStats && (
                        <div className="global-stats-overlay">
                            <div className="stat-pill"><Package size={14} /> <strong>{globalStats.volume}</strong> Cmds</div>
                            <div className="stat-pill"><Activity size={14} /> <strong>{globalStats.otif}%</strong> OTIF</div>
                            <div className="stat-pill"><DollarSign size={14} /> <strong>{globalStats.revenue}</strong> MAD</div>
                        </div>
                    )}

                    <div className="map-legend-overlay">
                        <h4>Légende Performance</h4>
                        <div className="stop-light">
                            <div><span className="dot" style={{ backgroundColor: '#00ff88' }}></span> Optimale</div>
                            <div><span className="dot" style={{ backgroundColor: '#ff3366' }}></span> Retard &gt; 1j</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MapIntelligence
