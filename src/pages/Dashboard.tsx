import { useEffect, useState, useRef } from 'react'
import { useData } from '../context/DataContext'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { Truck, Clock, AlertTriangle, CheckCircle, BarChart3, PieChart, TrendingUp, DollarSign, FileText, Info, X } from 'lucide-react'
import './Dashboard.css'

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement
)

function Dashboard() {
    // Stats state
    const [stats, setStats] = useState([
        { title: 'Total Livraisons', value: '...', change: '', icon: Truck, color: 'var(--color-accent-primary)' },
        { title: 'Délai Moyen', value: '...', change: '', icon: Clock, color: 'var(--color-accent-secondary)' },
        { title: 'Taux Satisfaction', value: '...', change: '', icon: CheckCircle, color: 'var(--color-success)' },
        { title: 'Coût Total', value: '...', change: '', icon: DollarSign, color: 'var(--color-warning)' }
    ])

    const [tableData, setTableData] = useState<any[]>([])
    const [delayData, setDelayData] = useState<any>(null)
    const [regionData, setRegionData] = useState<any>(null)
    const [costData, setCostData] = useState<any>(null)
    const [activeHelp, setActiveHelp] = useState<string | null>(null)
    const powerBiFileRef = useRef<HTMLInputElement>(null)

    // Use the global data context definition
    const { data: globalData, loading: globalLoading } = useData()

    useEffect(() => {
        if (!globalLoading && globalData && globalData.length > 0) {
            processData(globalData)
            setTableData(globalData.slice(0, 50))
        }
    }, [globalData, globalLoading])

    // Helper to safely parse numbers whether they are strings or numbers
    const getNum = (val: any) => {
        if (typeof val === 'number') return val
        if (typeof val === 'string') return parseFloat(val) || 0
        return 0
    }

    const processData = (data: any[]) => {
        if (!data || data.length === 0) return

        // --- KPI Calculation ---
        const totalLivraisons = data.length

        const avgDelay = data.reduce((sum, row) => sum + getNum(row.delai_livraison), 0) / totalLivraisons

        const onTimeCount = data.filter(row => getNum(row.retard) === 0).length
        const satisfactionRate = (onTimeCount / totalLivraisons) * 100

        const totalCost = data.reduce((sum, row) => sum + getNum(row.cout_transport), 0)

        setStats([
            { title: 'Total Livraisons', value: totalLivraisons.toLocaleString(), change: '+12%', icon: Truck, color: 'var(--color-accent-primary)' },
            { title: 'Délai Moyen (Jours)', value: avgDelay.toFixed(1) + 'j', change: '-5%', icon: Clock, color: 'var(--color-accent-secondary)' },
            { title: 'Taux Satisfaction', value: satisfactionRate.toFixed(1) + '%', change: '+2.4%', icon: CheckCircle, color: 'var(--color-success)' },
            { title: 'Coût Transport Est.', value: (totalCost / 1000).toFixed(1) + 'k MAD', change: '+8%', icon: DollarSign, color: 'var(--color-warning)' }
        ])

        // --- Chart 1: Delay Distribution (Donut) ---
        const delayCategories: any = {}
        data.forEach(row => {
            const retard = getNum(row.retard)
            const cat = row.categorie_delai || (retard === 0 ? 'À l\'heure' : (retard < 2 ? 'Retard Léger' : 'Retard Critique'))
            delayCategories[cat] = (delayCategories[cat] || 0) + 1
        })

        setDelayData({
            labels: Object.keys(delayCategories),
            datasets: [{
                data: Object.values(delayCategories),
                backgroundColor: [
                    'rgba(0, 255, 136, 0.7)',
                    'rgba(0, 217, 255, 0.7)',
                    'rgba(255, 51, 102, 0.7)',
                    'rgba(255, 170, 0, 0.7)',
                    'rgba(155, 89, 182, 0.7)'
                ],
                borderColor: ['#00ff88', '#00d9ff', '#ff3366', '#ffaa00', '#8e44ad'],
                borderWidth: 1
            }]
        })

        // --- Chart 2: Performance by Region (Bar) ---
        const regions: { [key: string]: { total: number, delays: number } } = {}
        data.forEach(row => {
            const region = row.region || 'Autre'
            if (!regions[region]) regions[region] = { total: 0, delays: 0 }
            regions[region].total++
            if (getNum(row.retard) > 0) regions[region].delays++
        })

        const regionLabels = Object.keys(regions)
        const regionPerformance = regionLabels.map(r => {
            const perf = ((regions[r].total - regions[r].delays) / regions[r].total) * 100
            return perf
        })

        setRegionData({
            labels: regionLabels,
            datasets: [{
                label: 'Performance (%)',
                data: regionPerformance,
                backgroundColor: 'rgba(0, 217, 255, 0.5)',
                borderColor: '#00d9ff',
                borderWidth: 1
            }]
        })

        // --- Chart 3: Cost Analysis (Line - REAL TREND) ---
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        const costsByMonth: { [key: number]: number } = {}

        data.forEach(row => {
            // Try to parse 'mois' if it exists, otherwise extract from date
            let m = parseInt(row.mois)
            if (isNaN(m) && row.date_commande) {
                // Assuming date_commande is YYYY-MM-DD or DD/MM/YYYY
                const d = new Date(row.date_commande)
                if (!isNaN(d.getTime())) m = d.getMonth() + 1
            }

            if (!isNaN(m)) {
                costsByMonth[m] = (costsByMonth[m] || 0) + getNum(row.cout_transport)
            }
        })

        const sortedMonths = Object.keys(costsByMonth).map(Number).sort((a, b) => a - b)
        const costLabels = sortedMonths.map(m => monthNames[m - 1] || `Mois ${m}`)
        const costValues = sortedMonths.map(m => costsByMonth[m])

        setCostData({
            labels: costLabels,
            datasets: [{
                label: 'Coût Mensuel (MAD)',
                data: costValues,
                borderColor: '#ffaa00',
                backgroundColor: 'rgba(255, 170, 0, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        })
    }

    const isLoading = globalLoading || (globalData && globalData.length > 0 && !delayData)

    if (isLoading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Chargement des données logistiques...</p>
            </div>
        )
    }

    const handlePowerBIClick = () => {
        powerBiFileRef.current?.click()
    }

    const handlePowerBIFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.name.endsWith('.pbix')) {
            const url = URL.createObjectURL(file)
            window.location.href = `ms-powerbi://open?path=${encodeURIComponent(file.name)}`
            alert(`Fichier Power BI sélectionné: ${file.name}\n\nSi Power BI Desktop est installé, il devrait s'ouvrir automatiquement.`)
            URL.revokeObjectURL(url)
        } else {
            alert('Veuillez sélectionner un fichier Power BI (.pbix)')
        }
        event.target.value = ''
    }

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 11 } }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#00d9ff',
                bodyColor: '#fff',
                borderColor: 'rgba(0, 217, 255, 0.3)',
                borderWidth: 1,
                padding: 10
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' },
                beginAtZero: true
            }
        }
    }

    const helpContent = {
        delays: {
            title: "Distribution des Retards",
            description: "Ce graphique montre la répartition des commandes par catégorie de retard. 'À l'heure' signifie aucun retard. 'Léger' est inférieur à 2 jours, 'Critique' est supérieur à 2 jours. Surveillez la part de retards critiques pour identifier les goulots d'étranglement majeurs."
        },
        performance: {
            title: "Performance Régionale",
            description: "Compare le taux de réussite (commandes livrées sans retard) par région. Une région avec un score faible peut indiquer des problèmes d'infrastructure locale ou des partenaires logistiques défaillants dans cette zone."
        },
        costs: {
            title: "Tendances des Coûts",
            description: "Évolution mensuelle des coûts de transport totaux. Identifiez les pics saisonniers ou les augmentations inexpliquées pour ajuster les budgets prévisionnels."
        },
        kpis: {
            title: "Indicateurs Clés",
            description: "Les KPI en haut de page donnent une vue d'ensemble instantanée. Le 'Taux de Satisfaction' est inversement corrélé aux retards. Le coût total est une estimation basée sur les données historiques."
        }
    }

    return (
        <div className="dashboard-container fade-in">
            {/* Header */}
            <header className="dashboard-header glass-card">
                <div>
                    <h1><BarChart3 className="icon-pulse" /> Tableau de Bord</h1>
                    <p className="subtitle">Vue d'ensemble de vos opérations logistiques - {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="header-actions">
                    <input
                        type="file"
                        ref={powerBiFileRef}
                        onChange={handlePowerBIFileSelect}
                        accept=".pbix"
                        style={{ display: 'none' }}
                    />
                    <button className="power-bi-btn" onClick={handlePowerBIClick}>
                        <FileText size={18} /> Connect Power BI
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="stats-grid">
                {stats.map((stat, index) => (
                    <div key={index} className="stat-card glass-card">
                        <div className="stat-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                            <stat.icon size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-title">{stat.title}</span>
                            <h3 style={{ color: stat.color }}>{stat.value}</h3>
                            <span className="stat-change">{stat.change}</span>
                        </div>
                        {index === 0 && (
                            <button
                                className="info-btn-mini absolute-top-right"
                                title="Info KPIs"
                                onClick={(e) => { e.stopPropagation(); setActiveHelp('kpis'); }}
                            >
                                <Info size={14} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="charts-grid">
                <div className="chart-card glass-card">
                    <div className="card-header-row">
                        <h3>Distribution des Retards</h3>
                        <button className="info-btn-mini" onClick={() => setActiveHelp('delays')}><Info size={14} /></button>
                    </div>
                    <div className="chart-container">
                        {delayData ? <Doughnut data={delayData} options={commonOptions} /> : <div className="spinner"></div>}
                    </div>
                </div>

                <div className="chart-card glass-card">
                    <div className="card-header-row">
                        <h3>Performance Régionale</h3>
                        <button className="info-btn-mini" onClick={() => setActiveHelp('performance')}><Info size={14} /></button>
                    </div>
                    <div className="chart-container">
                        {regionData ? <Bar data={regionData} options={commonOptions} /> : <div className="spinner"></div>}
                    </div>
                </div>

                <div className="chart-card glass-card wide">
                    <div className="card-header-row">
                        <h3>Analyse des Coûts (YTD)</h3>
                        <button className="info-btn-mini" onClick={() => setActiveHelp('costs')}><Info size={14} /></button>
                    </div>
                    <div className="chart-container">
                        {costData ? <Line data={costData} options={commonOptions} /> : <div className="spinner"></div>}
                    </div>
                </div>
            </div>

            {/* Recent Orders Table */}
            <div className="data-table-section glass-card">
                <h3><FileText size={18} /> Commandes Récentes</h3>
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>ID Commande</th>
                                <th>Date</th>
                                <th>Transporteur</th>
                                <th>Ville</th>
                                <th>Statut</th>
                                <th>Retard (J)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((row: any, index) => (
                                <tr key={index}>
                                    <td>#{row.order_id}</td>
                                    <td>{row.date_commande}</td>
                                    <td>
                                        <span className={`badge ${row.transporteur === 'DHL' ? 'badge-primary' : 'badge-secondary'}`}>
                                            {row.transporteur}
                                        </span>
                                    </td>
                                    <td>{row.ville_livraison || row.region}</td>
                                    <td>
                                        <span className={`status-dot ${getNum(row.retard) === 0 ? 'success' : 'danger'}`}></span>
                                        {getNum(row.retard) === 0 ? 'Livré' : 'Retard'}
                                    </td>
                                    <td style={{ color: getNum(row.retard) > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                        {getNum(row.retard)}j
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Help Modal */}
            {activeHelp && helpContent[activeHelp as keyof typeof helpContent] && (
                <div className="modal-overlay" onClick={() => setActiveHelp(null)}>
                    <div className="help-modal glass-card bounce-in" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <Info size={24} className="text-accent" />
                            <h2>{helpContent[activeHelp as keyof typeof helpContent].title}</h2>
                            <button className="close-btn" onClick={() => setActiveHelp(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>{helpContent[activeHelp as keyof typeof helpContent].description}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Dashboard
