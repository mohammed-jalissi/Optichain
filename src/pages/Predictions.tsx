import { useState, useEffect } from 'react'
import { AlertCircle, Clock, CheckCircle2, Calculator } from 'lucide-react'
import Papa from 'papaparse'
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
    
    const [transporteurOptions, setTransporteurOptions] = useState<string[]>([])
    const [regionOptions, setRegionOptions] = useState<string[]>([])
    const [modeTransportOptions, setModeTransportOptions] = useState<string[]>([])

    useEffect(() => {
        const fetchCSV = async () => {
            try {
                const response = await fetch('/data/bdd_log_clean_CORRIGE_updated.csv')
                const reader = response.body?.getReader()
                const result = await reader?.read()
                const decoder = new TextDecoder('utf-8')
                const csv = decoder.decode(result?.value)

                Papa.parse(csv, {
                    header: true,
                    complete: (results: any) => {
                        const data = results.data
                        
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
                })
            } catch (error) {
                console.error('Error loading CSV:', error)
            }
        }

        fetchCSV()
    }, [])

    // Simplified prediction logic
    const predictDelay = () => {
        const { poids_kg, delai_livraison, transporteur } = formData

        // Simple heuristic
        let score = 0
        if (poids_kg > 300) score += 0.3
        if (delai_livraison > 5) score += 0.2
        if (transporteur === 'Amana') score += 0.25

        const probability = Math.min(score + Math.random() * 0.2, 0.95)
        const isDelayed = probability > 0.5

        setPrediction({
            type: 'classification',
            isDelayed,
            probability: probability.toFixed(2),
            confidence: probability > 0.7 ? 'Haute' : probability > 0.4 ? 'Moyenne' : 'Faible'
        })
    }

    const predictDeliveryTime = () => {
        const { poids_kg, delai_livraison, transporteur } = formData

        let adjustedTime = delai_livraison
        if (poids_kg > 300) adjustedTime *= 1.3
        if (transporteur === 'Amana') adjustedTime *= 1.15

        const predictedDays = Math.max(1, adjustedTime + (Math.random() * 2 - 1))

        setPrediction({
            type: 'regression',
            predictedDays: predictedDays.toFixed(1),
            range: [(predictedDays * 0.9).toFixed(1), (predictedDays * 1.1).toFixed(1)],
            difference: (predictedDays - delai_livraison).toFixed(1)
        })
    }

    const handlePredict = () => {
        if (activeTab === 'classification') {
            predictDelay()
        } else {
            predictDeliveryTime()
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: name === 'transporteur' || name === 'region' || name === 'mode_transport'
                ? value
                : parseFloat(value) || 0
        }))
        setPrediction(null)
    }

    // Model comparison data from JSON
    const classificationModels = trainingResults.classification.map(m => ({
        name: m.model,
        accuracy: m.accuracy || 0,
        f1: m.f1 || 0,
        auc: m.auc || 0,
        isBest: m.isBest
    })).sort((a, b) => b.f1! - a.f1!)

    const regressionModels = trainingResults.regression.map(m => ({
        name: m.model,
        r2: m.r2 || 0,
        mae: m.mae || 0,
        rmse: m.rmse || 0,
        isBest: m.isBest
    })).sort((a, b) => a.rmse! - b.rmse!)

    const bestClf = classificationModels.find(m => m.isBest) || classificationModels[0]
    const bestReg = regressionModels.find(m => m.isBest) || regressionModels[0]

    return (
        <div className="predictions">
            <div className="page-header">
                <h1 className="page-title">Prédictions ML</h1>
                <p className="page-subtitle">Classification et Régression pour la logistique</p>
            </div>

            <div className="prediction-tabs">
                <button
                    className={`tab-btn ${activeTab === 'classification' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('classification')
                        setPrediction(null)
                    }}
                >
                    <AlertCircle size={20} />
                    Classification (Retard)
                </button>
                <button
                    className={`tab-btn ${activeTab === 'regression' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('regression')
                        setPrediction(null)
                    }}
                >
                    <Clock size={20} />
                    Régression (Délai)
                </button>
            </div>

            <div className="prediction-content">
                <div className="prediction-form glass-card">
                    <h3>
                        <Calculator size={24} />
                        {activeTab === 'classification' ? 'Prédire un Retard' : 'Estimer le Délai'}
                    </h3>

                    <div className="form-grid">
                        <div className="form-group">
                            <label>Quantité</label>
                            <input
                                type="number"
                                name="quantite"
                                value={formData.quantite}
                                onChange={handleInputChange}
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Poids (kg)</label>
                            <input
                                type="number"
                                name="poids_kg"
                                value={formData.poids_kg}
                                onChange={handleInputChange}
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Délai Prévu (jours)</label>
                            <input
                                type="number"
                                name="delai_livraison"
                                value={formData.delai_livraison}
                                onChange={handleInputChange}
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Transporteur</label>
                            <select
                                name="transporteur"
                                value={formData.transporteur}
                                onChange={handleInputChange}
                                className="form-input"
                            >
                                {transporteurOptions.map((opt, idx) => (
                                    <option key={idx} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Région</label>
                            <select
                                name="region"
                                value={formData.region}
                                onChange={handleInputChange}
                                className="form-input"
                            >
                                {regionOptions.map((opt, idx) => (
                                    <option key={idx} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Mode Transport</label>
                            <select
                                name="mode_transport"
                                value={formData.mode_transport}
                                onChange={handleInputChange}
                                className="form-input"
                            >
                                {modeTransportOptions.map((opt, idx) => (
                                    <option key={idx} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button className="btn btn-primary" onClick={handlePredict}>
                        Générer la Prédiction
                    </button>

                    {prediction && prediction.type === activeTab && (
                        <div className="prediction-result">
                            {activeTab === 'classification' ? (
                                <>
                                    <div className={`result-badge ${prediction.isDelayed ? 'delayed' : 'on-time'}`}>
                                        {prediction.isDelayed ? (
                                            <><AlertCircle size={24} /> RETARD PROBABLE</>
                                        ) : (
                                            <><CheckCircle2 size={24} /> À L'HEURE</>
                                        )}
                                    </div>
                                    <div className="result-details">
                                        <p><strong>Probabilité de retard:</strong> {(prediction.probability * 100).toFixed(0)}%</p>
                                        <p><strong>Confiance:</strong> {prediction.confidence}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="result-value">
                                        <Clock size={32} />
                                        <span>{prediction.predictedDays} jours</span>
                                    </div>
                                    <div className="result-details">
                                        <p><strong>Fourchette:</strong> {prediction.range[0]} - {prediction.range[1]} jours</p>
                                        <p><strong>Différence vs prévu:</strong> {prediction.difference > 0 ? '+' : ''}{prediction.difference} jours</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="model-comparison glass-card">
                    <h3>Comparaison des Modèles</h3>

                    {activeTab === 'classification' ? (
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
                                    {classificationModels.map((model, idx) => (
                                        <tr key={idx} className={model.isBest ? 'best-model' : ''}>
                                            <td>{model.name}</td>
                                            <td>{(model.accuracy * 100).toFixed(1)}%</td>
                                            <td>{model.f1!.toFixed(3)}</td>
                                            <td>{model.auc!.toFixed(3)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="best-model-note">
                                🏆 Meilleur modèle: {bestClf.name} ({(bestClf.accuracy * 100).toFixed(1)}% accuracy)
                            </p>
                        </div>
                    ) : (
                        <div className="model-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Modèle</th>
                                        <th>R²</th>
                                        <th>MAE</th>
                                        <th>RMSE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {regressionModels.map((model, idx) => (
                                        <tr key={idx} className={model.isBest ? 'best-model' : ''}>
                                            <td>{model.name}</td>
                                            <td>{(model.r2! * 100).toFixed(1)}%</td>
                                            <td>{model.mae!.toFixed(2)} j</td>
                                            <td>{model.rmse!.toFixed(2)} j</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="best-model-note">
                                🏆 Meilleur modèle: {bestReg.name} (R²={(bestReg.r2! * 100).toFixed(1)}%, MAE={bestReg.mae!.toFixed(2)} jours)
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Predictions
