import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Circle, Popup, Tooltip as LeafletTooltip, LayersControl, Polyline } from 'react-leaflet'
import { Filter, Download, AlertTriangle, Truck, Package, Scale, TrendingUp, DollarSign, Activity } from 'lucide-react'
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
    avgCostPerKg: number
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
            const delay = typeof row.retard === 'number' ? row.retard : parseFloat(row.retard as unknown as string) || 0
            if (filterStatus === 'delayed' && delay === 0) return false
            if (filterStatus === 'on-time' && delay > 0) return false
            if (filterStatus === 'warning' && (delay === 0 || delay >= 2)) return false

            // Filter by Transporteur
            if (filterTransporteur !== 'all' && row.transporteur !== filterTransporteur) return false

            // Filter by Weight
            const weight = typeof row.poids_kg === 'number' ? row.poids_kg : parseFloat(row.poids_kg as unknown as string) || 0
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

                const delay = typeof row.retard === 'number' ? row.retard : parseFloat(row.retard as unknown as string) || 0
                if (delay > 0) entry.delayed++

                entry.totalDelayDays += (typeof row.delai_livraison === 'number' ? row.delai_livraison : parseFloat(row.delai_livraison as unknown as string) || 0)
                entry.revenue += (typeof row.cout_transport === 'number' ? row.cout_transport : parseFloat(row.cout_transport as unknown as string) || 0)
                entry.weight += (typeof row.poids_kg === 'number' ? row.poids_kg : parseFloat(row.poids_kg as unknown as string) || 0)

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

        const totalDelayed = filteredRawData.filter(r => {
            const d = typeof r.retard === 'number' ? r.retard : parseFloat(r.retard as unknown as string) || 0
            return d > 0
        }).length

        const totalRevenue = filteredRawData.reduce((acc, r) => {
            const rev = typeof r.cout_transport === 'number' ? r.cout_transport : parseFloat(r.cout_transport as unknown as string) || 0
            return acc + rev
        }, 0)

        const sumDelay = filteredRawData.reduce((acc, r) => {
            const d = typeof r.delai_livraison === 'number' ? r.delai_livraison : parseFloat(r.delai_livraison as unknown as string) || 0
            return acc + d
        }, 0)

        const avgDelay = sumDelay / totalVol

        return {
            volume: totalVol,
            otif: ((1 - totalDelayed / totalVol) * 100).toFixed(1),
            revenue: (totalRevenue / 1000).toFixed(1) + 'k',
            avgDelay: avgDelay.toFixed(1)
        }
    }, [filteredRawData])

    if (loading) {
        return (
            <div className="map-loading">
                <div className="spinner"></div>
                <p>Chargement de l'intelligence géographique...</p>
            </div>
        )
    }

    return (
        <div className="map-page glass-card fade-in">
            {/* Header with Stats */}
            <header className="map-header">
                <div>
                    <h1><Activity className="icon-pulse" /> Map Intelligence</h1>
                    <p className="subtitle">Visualisation géospatiale des flux et de la performance</p>
                </div>

                {globalStats && (
                    <div className="global-stats-row">
                        <div className="mini-stat">
                            <Package size={16} />
                            <span>{globalStats.volume} Cmds</span>
                        </div>
                        <div className="mini-stat">
                            <TrendingUp size={16} className={parseFloat(globalStats.otif) > 90 ? 'text-success' : 'text-warning'} />
                            <span>{globalStats.otif}% OTIF</span>
                        </div>
                        <div className="mini-stat">
                            <DollarSign size={16} />
                            <span>{globalStats.revenue} MAD</span>
                        </div>
                    </div>
                )}
            </header>

            {/* Smart Filters Bar */}
            <div className="filters-bar glass-card">
                <div className="filter-group">
                    <Filter size={18} />
                    <span className="filter-label">Filtres :</span>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="filter-select"
                    >
                        <option value="all">Tous les status</option>
                        <option value="delayed">En Retard uniquement</option>
                        <option value="on-time">À l'heure</option>
                        <option value="warning">À Risque (Retard &lt; 2j)</option>
                    </select>

                    <select
                        value={filterTransporteur}
                        onChange={(e) => setFilterTransporteur(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">Tous les transporteurs</option>
                        {availableTransporteurs.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    <div className="range-filter">
                        <Scale size={16} />
                        <input
                            type="range"
                            min="0"
                            max="1000"
                            step="50"
                            value={filterMinWeight}
                            onChange={(e) => setFilterMinWeight(parseInt(e.target.value))}
                        />
                        <span> &gt; {filterMinWeight} kg</span>
                    </div>
                </div>

                <div className="view-toggles">
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={showFlows}
                            onChange={(e) => setShowFlows(e.target.checked)}
                        />
                        <span className="slider"></span>
                        <span className="toggle-label">Afficher Flux</span>
                    </label>
                </div>
            </div>

            {/* Map Container */}
            <div className="map-container-wrapper">
                <MapContainer center={[31.7917, -7.0926]} zoom={6} scrollWheelZoom={true} className="leaflet-map">
                    <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name="Dark Matter">
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="OpenStreetMap">
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                        </LayersControl.BaseLayer>
                    </LayersControl>

                    {/* Hub Marker */}
                    <Circle
                        center={HUB_COORDINATES}
                        pathOptions={{ color: '#00d9ff', fillColor: '#00d9ff', fillOpacity: 0.8 }}
                        radius={15000}
                    >
                        <Popup>
                            <div className="popup-content hub-popup">
                                <h3>HUB CENTRAL CASABLANCA</h3>
                                <p>Point de départ de tous les flux</p>
                            </div>
                        </Popup>
                    </Circle>

                    {/* Regional Clusters */}
                    {cityAggregates.map((city) => {
                        // Dynamic sizing based on volume
                        const radius = Math.max(5000, Math.sqrt(city.totalOrders) * 1000)

                        // Dynamic styling based on performance
                        const isProblematic = city.avgDelay > 1
                        const color = isProblematic ? '#ff3366' : '#00ff88'

                        return (
                            <div key={city.name}>
                                <Circle
                                    center={city.coordinates}
                                    pathOptions={{
                                        color: color,
                                        fillColor: color,
                                        fillOpacity: 0.4
                                    }}
                                    radius={radius}
                                >
                                    <Popup>
                                        <div className="popup-content">
                                            <h3>{city.name}</h3>
                                            <div className="popup-stat">
                                                <span>Volume:</span>
                                                <strong>{city.totalOrders} cmds</strong>
                                            </div>
                                            <div className="popup-stat">
                                                <span>Retards:</span>
                                                <strong style={{ color: isProblematic ? '#ff3366' : '#00ff88' }}>
                                                    {city.delayedOrders} ({((city.delayedOrders / city.totalOrders) * 100).toFixed(0)}%)
                                                </strong>
                                            </div>
                                            <div className="popup-stat">
                                                <span>Délai Moy:</span>
                                                <strong>{city.avgDelay.toFixed(1)} jours</strong>
                                            </div>
                                            <div className="popup-stat">
                                                <span>Revenue:</span>
                                                <strong>{(city.revenue).toLocaleString()} MAD</strong>
                                            </div>
                                            <div className="transporteur-badge">
                                                <Truck size={12} /> {city.mainTransporteur}
                                            </div>
                                        </div>
                                    </Popup>
                                    <LeafletTooltip direction="top" offset={[0, -10]} opacity={0.8}>
                                        {city.name}: {city.totalOrders} cmds
                                    </LeafletTooltip>
                                </Circle>

                                {/* Flow Lines from Hub */}
                                {showFlows && (
                                    <Polyline
                                        positions={[HUB_COORDINATES, city.coordinates]}
                                        pathOptions={{
                                            color: color,
                                            weight: Math.max(1, city.totalOrders / 50), // Thicker lines for more volume
                                            opacity: 0.3,
                                            dashArray: '10, 10'
                                        }}
                                    />
                                )}
                            </div>
                        )
                    })}
                </MapContainer>
            </div>

            <div className="map-legend">
                <div className="legend-item">
                    <span className="dot hub"></span> Hub Central
                </div>
                <div className="legend-item">
                    <span className="dot healthy"></span> Performance Optimale
                </div>
                <div className="legend-item">
                    <span className="dot warning"></span> Retards Détectés
                </div>
                <div className="legend-item">
                    <span className="line flow"></span> Flux Logistique (Épaisseur = Volume)
                </div>
            </div>
        </div>
    )
}

export default MapIntelligence
