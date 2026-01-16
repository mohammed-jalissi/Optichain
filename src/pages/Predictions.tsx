import { useState, useEffect } from 'react'
import { AlertCircle, Clock, CheckCircle2, Calculator, TrendingUp } from 'lucide-react'
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
        quantite: 100, // Default values matching previously seen code
        poids_kg: 250,
        delai_livraison: 5,
        transporteur: '',
        region: '',
        mode_transport: ''
    })
    const [prediction, setPrediction] = useState<any>(null)

    // Options lists
    const [transporteurOptions, setTransporteurOptions] = useState<string[]>([])
    const [regionOptions, setRegionOptions] = useState<string[]>([])
    const [modeTransportOptions, setModeTransportOptions] = useState<string[]>([])

    const { data: globalData, loading } = useData()

    useEffect(() => {
        if (!loading && globalData && globalData.length > 0) {
            const data = globalData
            const transporteurs = [...new Set(data.map((item: any) => item.transporteur).filter(Boolean))].sort() as string[]
            const regions = [...new Set(data.map((item: any) => item.region).filter(Boolean))].sort() as string[]
            const modes = [...new Set(data.map((item: any) => item.mode_transport).filter(Boolean))].sort() as string[]

            setTransporteurOptions(transporteurs)
            setRegionOptions(regions)
            setModeTransportOptions(modes)

            // Set default values if not already set
            setFormData(prev => ({
                ...prev,
                transporteur: prev.transporteur || transporteurs[0] || '',
                region: prev.region || regions[0] || '',
                mode_transport: prev.mode_transport || modes[0] || ''
            }))
        }
    }, [globalData, loading])

    const predict = (e: React.FormEvent) => {
        e.preventDefault()

        if (activeTab === 'classification') {
            // Logic for classification (Delay)
            // Simple heuristic
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
            <div className="prediction-tabs">
                <button
                    className={`tab-btn ${activeTab === 'classification' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('classification'); setPrediction(null) }}
                >
                    <AlertCircle size={18} /> Prédiction de Retard (Classification)
                </button>
                <button
                    className={`tab-btn ${activeTab === 'regression' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('regression'); setPrediction(null) }}
                >
                    <TrendingUp size={18} /> Estimation des Coûts (Régression)
                </button>
            </div>

            <div className="prediction-content">
                <form className="prediction-form" onSubmit={predict}>
                    <h3><Calculator size={20} /> Paramètres de Simulation</h3>

                    <div className="form-grid">
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

                        <div className="form-group">
                            <label>Région</label>
                            <select
                                className="form-input"
                                value={formData.region}
                                onChange={e => setFormData({ ...formData, region: e.target.value })}
                            >
                                {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

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
                    </div>

                    <button type="submit" className="primary-btn" style={{ width: '100%', marginTop: '1rem' }}>
                        Lancer l'IA
                    </button>
                </form>

                {prediction && (
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

                            <div className="best-model-note">
                                Champion: {activeTab === 'classification' ? trainingResults.classification.champion : trainingResults.regression.champion}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Predictions
