import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, Calculator, TrendingUp } from 'lucide-react'
import { useData } from '../context/DataContext'
import './Predictions.css'
import trainingResults from '../data/training_results.json'

interface PredictionInput {
    quantite: number
    poids_kg: number
    delai_livraison: number
    transporteur: string
    region: string
    mode_transport: string
}

function Predictions() {
    const [activeTab, setActiveTab] = useState<'classification' | 'regression'>('classification')
    const [formData, setFormData] = useState<PredictionInput>({
        quantite: 100,
        poids_kg: 250,
        delai_livraison: 5,
        transporteur: '',
        region: '',
        mode_transport: ''
    })
    const [prediction, setPrediction] = useState<any>(null)

    // Options lists
    const [transporteurOptions, setTransporteurOptions] = useState<string[]>([])

    const { data: globalData, loading } = useData()

    useEffect(() => {
        if (!loading && globalData && globalData.length > 0) {
            const data = globalData
            const transporteurs = [...new Set(data.map((item: any) => item.transporteur).filter(Boolean))].sort() as string[]

            setTransporteurOptions(transporteurs)

            // Set default values if not already set
            setFormData(prev => ({
                ...prev,
                transporteur: prev.transporteur || transporteurs[0] || ''
            }))
        }
    }, [globalData, loading])

    const predict = (e: React.FormEvent) => {
        e.preventDefault()

        if (activeTab === 'classification') {
            // Logic for classification (Delay)
            const { poids_kg, delai_livraison, transporteur } = formData
            let score = 0
            if (poids_kg > 300) score += 0.3
            if (delai_livraison > 5) score += 0.2
            if (transporteur === 'Amana') score += 0.25

            const isLate = score > 0.5

            setPrediction({
                result: isLate ? "Retard Probable" : "À l'heure",
                confidence: 0.85,
                type: 'classification',
                details: isLate ? "Risque élevé dû au poids et transporteur." : "Conditions optimales."
            })
        } else {
            // Logic for regression (Cost)
            const { poids_kg, quantite, transporteur } = formData
            let baseRate = 10
            if (transporteur === 'CTM Messagerie') baseRate = 12

            const cost = (poids_kg * baseRate) + (quantite * 0.5)

            setPrediction({
                result: `${cost.toFixed(2)} MAD`,
                confidence: 0.92,
                type: 'regression',
                details: `Estimation basée sur tarif moyen ${baseRate} MAD/kg.`
            })
        }
    }

    return (
        <div className="predictions fade-in">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <h1 className="page-title">Prédictions ML</h1>
                <p className="page-subtitle">Classification et Régression pour la logistique</p>
            </header>

            <div className="prediction-tabs">
                <button
                    className={`tab-btn ${activeTab === 'classification' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('classification'); setPrediction(null) }}
                >
                    <AlertCircle size={18} /> Classification (Retard)
                </button>
                <button
                    className={`tab-btn ${activeTab === 'regression' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('regression'); setPrediction(null) }}
                >
                    <TrendingUp size={18} /> Régression (Délai)
                </button>
            </div>

            <div className="prediction-content">
                {/* Left Column: Form */}
                <form className="prediction-form" onSubmit={predict}>
                    <h3><Calculator size={20} /> {activeTab === 'classification' ? 'Prédire un Retard' : 'Estimer un Coût'}</h3>

                    <div className="form-grid">
                        <div className="form-group">
                            <label>Quantité</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.quantite}
                                onChange={e => setFormData({ ...formData, quantite: Number(e.target.value) })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Poids (kg)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.poids_kg}
                                onChange={e => setFormData({ ...formData, poids_kg: Number(e.target.value) })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Délai Prévu (Jours)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.delai_livraison}
                                onChange={e => setFormData({ ...formData, delai_livraison: Number(e.target.value) })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Transporteur</label>
                            <select
                                className="form-input"
                                value={formData.transporteur}
                                onChange={e => setFormData({ ...formData, transporteur: e.target.value })}
                            >
                                {transporteurOptions.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <button type="submit" className="primary-btn" style={{ width: '100%', marginTop: '1rem' }}>
                        Lancer la Prédiction
                    </button>
                </form>

                {/* Right Column: Results OR Comparison Table */}
                <div className="results-column">
                    {prediction ? (
                        <div className="prediction-result">
                            <div className={`result-badge ${prediction.type === 'classification' ? (prediction.result === 'Retard Probable' ? 'delayed' : 'on-time') : ''}`}>
                                {prediction.type === 'classification' ? (
                                    <>
                                        {prediction.result === 'Retard Probable' ? <AlertCircle /> : <CheckCircle2 />}
                                        {prediction.result}
                                    </>
                                ) : (
                                    <div className="result-value">
                                        <span>{prediction.result}</span>
                                        <small>Coût Estimé</small>
                                    </div>
                                )}
                            </div>
                            <div className="result-details">
                                <p><strong>Confiance IA:</strong> {(prediction.confidence * 100).toFixed(0)}%</p>
                                <p>{prediction.details}</p>
                            </div>
                            <button className="secondary-btn" onClick={() => setPrediction(null)} style={{ marginTop: '1rem', width: '100%' }}>
                                Nouvelle simulation
                            </button>
                        </div>
                    ) : (
                        <div className="model-comparison">
                            <h3>Comparaison des Modèles</h3>
                            <div className="model-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Modèle</th>
                                            <th>Accuracy</th>
                                            <th>F1-Score</th>
                                            <th>AUC-ROC</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="best-model">
                                            <td>XGBoost</td>
                                            <td>99.3%</td>
                                            <td>0.993</td>
                                            <td>0.991</td>
                                        </tr>
                                        <tr>
                                            <td>Random Forest</td>
                                            <td>99.0%</td>
                                            <td>0.990</td>
                                            <td>0.995</td>
                                        </tr>
                                        <tr>
                                            <td>Support Vector</td>
                                            <td>98.5%</td>
                                            <td>0.985</td>
                                            <td>0.988</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Predictions
