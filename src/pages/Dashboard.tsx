import { useEffect, useState, useRef } from 'react'
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
import Papa from 'papaparse'
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
    const [loading, setLoading] = useState(true)
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
                    complete: (results: any) => {
                        processData(results.data)
                        setTableData(results.data.slice(0, 50)) // Load first 50 rows for preview
                        setLoading(false)
                    },
                    error: (error: any) => {
                        console.error('Error parsing CSV:', error)
                        setLoading(false)
                    }
                })
            } catch (error) {
                console.error('Error fetching data:', error)
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    const handlePowerBIClick = () => {
        powerBiFileRef.current?.click()
    }

    const handlePowerBIFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.name.endsWith('.pbix')) {
            // Créer un lien temporaire pour télécharger le fichier
            const url = URL.createObjectURL(file)
            const link = document.createElement('a')
            link.href = url
            link.download = file.name

            // Tenter d'ouvrir avec Power BI Desktop via le protocole personnalisé
            // Note: Cela fonctionne uniquement si Power BI Desktop est installé
            window.location.href = `ms-powerbi://open?path=${encodeURIComponent(file.name)}`

            // Afficher une notification à l'utilisateur
            alert(`Fichier Power BI sélectionné: ${file.name}\n\nSi Power BI Desktop est installé, il devrait s'ouvrir automatiquement.\nSinon, veuillez ouvrir le fichier manuellement depuis: ${file.name}`)

            // Nettoyer
            URL.revokeObjectURL(url)
        } else {
            alert('Veuillez sélectionner un fichier Power BI (.pbix)')
        }
        // Réinitialiser l'input pour permettre la sélection du même fichier
        event.target.value = ''
    }

    const processData = (data: any[]) => {
        // ... (existing processData logic) ...
        // --- KPI Calculation ---
        const totalLivraisons = data.length

        const avgDelay = data.reduce((sum, row) => sum + (parseFloat(row.delai_livraison) || 0), 0) / totalLivraisons

        const onTimeCount = data.filter(row => parseFloat(row.retard) === 0).length
        const satisfactionRate = (onTimeCount / totalLivraisons) * 100

        const totalCost = data.reduce((sum, row) => sum + (parseFloat(row.cout_transport) || 0), 0)

        setStats([
            { title: 'Total Livraisons', value: totalLivraisons.toLocaleString(), change: '+12%', icon: Truck, color: 'var(--color-accent-primary)' },
            { title: 'Délai Moyen (Jours)', value: avgDelay.toFixed(1) + 'j', change: '-5%', icon: Clock, color: 'var(--color-accent-secondary)' },
            { title: 'Taux Satisfaction', value: satisfactionRate.toFixed(1) + '%', change: '+2.4%', icon: CheckCircle, color: 'var(--color-success)' },
            { title: 'Coût Transport Est.', value: (totalCost / 1000).toFixed(1) + 'k MAD', change: '+8%', icon: DollarSign, color: 'var(--color-warning)' }
        ])

        // --- Chart 1: Delay Distribution (Donut) ---
        const delayCategories: any = {}
        data.forEach(row => {
            const cat = row.categorie_delai || (parseFloat(row.retard) === 0 ? 'À l\'heure' : (parseFloat(row.retard) < 2 ? 'Retard Léger' : 'Retard Critique'))
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
            if (parseFloat(row.retard) > 0) regions[region].delays++
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
            const m = parseInt(row.mois)
            if (!isNaN(m)) {
                costsByMonth[m] = (costsByMonth[m] || 0) + (parseFloat(row.cout_transport) || 0)
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

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#e0e0e0', font: { family: "'Inter', sans-serif" } }
            }
        },
        scales: {
            y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0a0a0' } },
            x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0a0a0' } }
        }
    }

    // Help content for charts
    const helpContent: { [key: string]: { title: string, description: string } } = {
        kpis: {
            title: "Indicateurs Clés de Performance (KPIs)",
            description: "Ces 4 indicateurs résument la santé globale de votre chaîne logistique :\n\n• Total Livraisons : Nombre total de commandes livrées sur la période.\n• Délai Moyen : Temps moyen (en jours) entre l'expédition et la livraison effective.\n• Taux Satisfaction : Pourcentage de livraisons effectuées à l'heure (sans retard).\n•  Coût Transport : Somme estimée des frais de transport sur la période.\n\nLe badge de changement (+/-) compare la performance avec le mois précédent."
        },
        delayDistribution: {
            title: "Distribution des Retards - Graphique Donut",
            description: "Ce graphique circulaire montre la répartition des livraisons par catégorie de retard :\n\n• À l'heure (Vert) : Livraisons effectuées dans les délais prévus.\n• Retard Léger (Jaune) : Retard de 1-2 jours.\n• Retard Critique (Rouge) : Retard > 2 jours.\n\nUtilisez ce graphique pour identifier rapidement la proportion de livraisons problématiques."
        },
        regionalPerformance: {
            title: "Performance par Région - Graphique en Barres",
            description: "Ce graphique compare le nombre de livraisons par région marocaine.\n\nLes régions avec les barres les plus hautes sont celles qui reçoivent le plus de flux logistiques.\n\n• Axe X : Régions (Casablanca, Oriental, etc.)\n• Axe Y : Nombre de livraisons\n• Gradient : Dégradé cyan indiquant l'intensité d'activité\n\nIdentifiez les zones à forte demande pour optimiser vos ressources."
        },
        monthlyCosts: {
            title: "Coûts Mensuels - Graphique Linéaire",
            description: "Cette courbe affiche l'évolution des coûts de transport par mois.\n\n• Axe X : Mois de l'année\n• Axe Y : Coût total en MAD (Dirhams marocains)\n• Tendance : Permet de détecter les pics saisonniers ou les anomalies budgétaires\n\nUtilisez ce graphique pour anticiper les dépenses futures et ajuster votre budget."
        }
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div>
                    <h1 className="page-title">Tableau de Bord</h1>
                    <p className="page-subtitle">Vue d'ensemble de vos opérations logistiques</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="date-badge">
                        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <input
                        ref={powerBiFileRef}
                        type="file"
                        accept=".pbix"
                        style={{ display: 'none' }}
                        onChange={handlePowerBIFileSelect}
                    />
                    <button
                        onClick={handlePowerBIClick}
                        className="power-bi-btn"
                        title="Sélectionner et ouvrir un fichier Power BI (.pbix)"
                    >
                        <FileText size={18} />
                        Ouvrir Power BI
                    </button>
                </div>
            </header>

            {/* KPIs Section with Help */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>Indicateurs Clés</h2>
                <button className="info-btn-dashboard" onClick={() => setActiveHelp('kpis')} title="En savoir plus">
                    <Info size={18} />
                </button>
            </div>

            {/* KPI Cards */}
            <div className="stats-grid">
                {stats.map((stat, index) => (
                    <div
                        key={index}
                        className="stat-card glass-card"
                        style={{ animationDelay: `${index * 0.1}s` }}
                    >
                        <div className="stat-icon" style={{ borderColor: stat.color, color: stat.color }}>
                            <stat.icon size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>{stat.value}</h3>
                            <p>{stat.title}</p>
                            <span className={`stat-change ${stat.change.startsWith('+') ? 'positive' : 'negative'}`}>
                                {stat.change} vs mois dernier
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            {!loading && (
                <>
                    <div className="charts-grid">
                        <div className="chart-card glass-card">
                            <div className="chart-header">
                                <h3><PieChart size={20} /> Distribution des Retards</h3>
                                <button className="info-btn-dashboard" onClick={() => setActiveHelp('delayDistribution')} title="En savoir plus">
                                    <Info size={18} />
                                </button>
                            </div>
                            <div className="chart-container" style={{ height: '300px' }}>
                                {delayData && <Doughnut data={delayData} options={{ ...commonOptions, scales: {} }} />}
                            </div>
                        </div>

                        <div className="chart-card glass-card">
                            <div className="chart-header">
                                <h3><BarChart3 size={20} /> Performance par Région</h3>
                                <button className="info-btn-dashboard" onClick={() => setActiveHelp('regionalPerformance')} title="En savoir plus">
                                    <Info size={18} />
                                </button>
                            </div>
                            <div className="chart-container" style={{ height: '300px' }}>
                                {regionData && <Bar data={regionData} options={commonOptions} />}
                            </div>
                        </div>

                        <div className="chart-card glass-card full-width">
                            <div className="chart-header">
                                <h3><TrendingUp size={20} /> Analyse des Coûts Mensuels</h3>
                                <button className="info-btn-dashboard" onClick={() => setActiveHelp('monthlyCosts')} title="En savoir plus">
                                    <Info size={18} />
                                </button>
                            </div>
                            <div className="chart-container" style={{ height: '300px' }}>
                                {costData && <Line data={costData} options={commonOptions} />}
                            </div>
                        </div>
                    </div>

                    {/* Dataset Explorer */}
                    <div className="data-explore-section">
                        <h2 className="section-title"><AlertTriangle size={24} color="var(--color-accent-primary)" /> Explorateur de Données (Aperçu)</h2>
                        <div className="data-table-container glass-card">
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID Commande</th>
                                            <th>Date</th>
                                            <th>Transporteur</th>
                                            <th>Région</th>
                                            <th>Poids (kg)</th>
                                            <th>Délai (j)</th>
                                            <th>Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableData.map((row, idx) => (
                                            <tr key={idx}>
                                                <td>{row.order_id}</td>
                                                <td>{row.date_commande}</td>
                                                <td>{row.transporteur}</td>
                                                <td>{row.region}</td>
                                                <td>{row.poids_kg}</td>
                                                <td>{row.delai_livraison}</td>
                                                <td>
                                                    <span className={`status-badge ${parseFloat(row.retard) === 0 ? 'ontime' : 'delayed'}`}>
                                                        {parseFloat(row.retard) === 0 ? 'À l\'heure' : 'En Retard'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Help Modal */}
            {activeHelp && (
                <div className="help-modal-overlay" onClick={() => setActiveHelp(null)}>
                    <div className="help-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="help-modal-header">
                            <h3>{helpContent[activeHelp].title}</h3>
                            <button className="close-btn" onClick={() => setActiveHelp(null)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="help-modal-body">
                            <p style={{ whiteSpace: 'pre-line' }}>{helpContent[activeHelp].description}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Dashboard
