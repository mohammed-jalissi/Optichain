import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader, Database, Brain, BarChart, Info, Zap, Trophy, TrendingUp, X, HelpCircle } from 'lucide-react'
import './Training.css'
import trainingResults from '../data/training_results.json'

interface ProcessingStep {
    id: number
    name: string
    status: 'pending' | 'processing' | 'completed' | 'error'
    description: string
    duration?: number
}

interface MetricResult {
    model: string
    accuracy?: number
    f1?: number
    auc?: number
    r2?: number
    mae?: number
    rmse?: number
    isBest?: boolean
}

interface StepExplanation {
    details: string
    techniques: string[]
    example: string
}

function Training() {
    const [dataSource, setDataSource] = useState<'default' | 'upload' | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [expandedStep, setExpandedStep] = useState<number | null>(null)
    const [benchmarkResults, setBenchmarkResults] = useState<{ classification: MetricResult[], regression: MetricResult[] } | null>(null)
    const [trainingTask, setTrainingTask] = useState<'classification' | 'regression' | 'both'>('both')
    const [autoML, setAutoML] = useState(true)
    const [selectedAlgos, setSelectedAlgos] = useState<{ classification: string[], regression: string[] }>({
        classification: trainingResults.classification.map(m => m.model),
        regression: trainingResults.regression.map(m => m.model)
    })
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [showHelp, setShowHelp] = useState(false)
    const [helpTab, setHelpTab] = useState<'algorithms' | 'metrics'>('algorithms')

    const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
        { id: 1, name: 'Chargement des Données', status: 'pending', description: 'bdd_log_clean_CORRIGE_updated.csv' },
        { id: 2, name: 'Validation & Nettoyage', status: 'pending', description: 'Vérification structure et imputation valeurs nulles' },
        { id: 3, name: 'Feature Engineering', status: 'pending', description: 'Création de variables: ratio_poids_delai, saisonnalité' },
        { id: 4, name: 'Encodage & Normalisation', status: 'pending', description: 'Label Encoding et Scaling des features' },
        { id: 5, name: 'Benchmark Classification', status: 'pending', description: 'Comparaison des algorithmes de classification' },
        { id: 6, name: 'Benchmark Régression', status: 'pending', description: 'Comparaison des algorithmes de régression' },
        { id: 7, name: 'Sélection Meilleur Modèle', status: 'pending', description: 'Choix automatique basé sur F1-Score et RMSE' }
    ])

    // Detailed explanations
    const stepExplanations: { [key: number]: StepExplanation } = {
        1: {
            details: "Chargement du dataset source. En mode 'Défaut', utilise dataset_dm1.csv optimisé pour la logistique marocaine (2000 entrées). En mode 'Upload', parse votre fichier CSV local.",
            techniques: ["Parsing CSV", "Détection d'encodage", "Mapping des types auto"],
            example: "Fichier bdd_log_clean_CORRIGE_updated.csv chargé."
        },
        2: {
            details: "Nettoyage rigoureux des données. Les valeurs manquantes sont imputées (Médiane pour numérique, Mode pour catégoriel). Les outliers aberrants sont traités.",
            techniques: ["Imputation Médiane/Mode", "Winsorization (Outliers)", "Type Casting"],
            example: "Correction : 12 dates manquantes remplacées, 5 poids négatifs corrigés."
        },
        3: {
            details: "Création de nouvelles variables prédictives (Features) pour enrichir le modèle et capturer des tendances complexes.",
            techniques: ["ratio_poids_delai", "jour_semaine", "est_weekend", "segment_trajet"],
            example: "Nouveau feature 'Traffic_Score' calculé basé sur Heure et Région."
        },
        4: {
            details: "Transformation des données pour les rendre digestes par les algorithmes mathématiques.",
            techniques: ["Label Encoding (Text -> Int)", "StandardScaler (Moyenne=0, Std=1)"],
            example: "Transporteur 'CTM' -> 0, 'Amana' -> 1. Poids normalisé de [0, 1000] à [-1.5, 1.5]."
        },
        5: {
            details: "Entraînement parallèle de plusieurs algorithmes de classification pour détecter les retards. Le but est de trouver celui qui généralise le mieux.",
            techniques: ["Random Forest", "XGBoost Classifier", "Support Vector Machine (SVM)"],
            example: "XGBoost atteint 94% de précision contre 89% pour SVM sur ce dataset."
        },
        6: {
            details: "Entraînement de modèles de régression pour prédire le délai exact en jours.",
            techniques: ["Random Forest Regressor", "Gradient Boosting", "Linear Regression"],
            example: "Random Forest prédit une erreur moyenne (MAE) de seulement 0.5 jours."
        },
        7: {
            details: "Analyse finale des performances et sélection automatique du modèle 'Champion' qui sera utilisé pour les prédictions.",
            techniques: ["Comparaison F1-Score", "Comparaison RMSE", "Cross-Validation"],
            example: "Modèle 'XGBoost' sélectionné comme champion pour la Classification."
        }
    }

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setDataSource('upload')
        }
    }

    const startTraining = async () => {
        if (!dataSource) return
        setIsProcessing(true)
        setBenchmarkResults(null)

        // Reset and Filter steps
        const steps: ProcessingStep[] = [
            { id: 1, name: 'Chargement des Données', status: 'pending', description: 'bdd_log_clean_CORRIGE_updated.csv' },
            { id: 2, name: 'Validation & Nettoyage', status: 'pending', description: 'Vérification structure et imputation valeurs nulles' },
            { id: 3, name: 'Feature Engineering', status: 'pending', description: 'Création de variables: ratio_poids_delai, saisonnalité' },
            { id: 4, name: 'Encodage & Normalisation', status: 'pending', description: 'Label Encoding et Scaling des features' }
        ]

        if (trainingTask === 'classification' || trainingTask === 'both') {
            steps.push({ id: 5, name: 'Benchmark Classification', status: 'pending', description: autoML ? 'AutoML: Tous les algos' : `Manuel: ${selectedAlgos.classification.join(', ')}` })
        }
        if (trainingTask === 'regression' || trainingTask === 'both') {
            steps.push({ id: 6, name: 'Benchmark Régression', status: 'pending', description: autoML ? 'AutoML: Tous les algos' : `Manuel: ${selectedAlgos.regression.join(', ')}` })
        }
        steps.push({ id: 7, name: 'Sélection Meilleur Modèle', status: 'pending', description: 'Choix automatique basé sur F1-Score et RMSE' })

        setProcessingSteps(steps)

        // Simulate steps
        for (let i = 0; i < steps.length; i++) {
            setProcessingSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'processing' as const } : s))

            const duration = 800 + Math.random() * 1000
            await new Promise(r => setTimeout(r, duration))

            setProcessingSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'completed' as const, duration: Math.floor(duration) } : s))
        }

        // Filter results based on selection
        const results = {
            classification: trainingResults.classification.filter(m => autoML || selectedAlgos.classification.includes(m.model)),
            regression: trainingResults.regression.filter(m => autoML || selectedAlgos.regression.includes(m.model))
        }

        setBenchmarkResults(results)
        setIsProcessing(false)
    }

    const getStepIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle className="step-icon completed" size={24} />
            case 'processing': return <Loader className="step-icon processing" size={24} />
            case 'error': return <AlertCircle className="step-icon error" size={24} />
            default: return <div className="step-icon pending"></div>
        }
    }

    const algorithmHelp = {
        classification: [
            {
                name: "Random Forest",
                description: "Combine plusieurs arbres de décision pour améliorer la précision et réduire le surapprentissage.",
                useCase: "Idéal pour des données avec beaucoup de variables et interactions complexes.",
                formula: "Vote majoritaire de N arbres indépendants"
            },
            {
                name: "XGBoost",
                description: "Algorithme de boosting très performant qui construit des arbres séquentiellement pour corriger les erreurs précédentes.",
                useCase: "Excellent pour les compétitions Kaggle et données structurées. Champion actuel.",
                formula: "Minimisation de la fonction de perte avec régularisation L1/L2"
            },
            {
                name: "SVM (Support Vector Machine)",
                description: "Trouve l'hyperplan optimal pour séparer les classes avec la marge maximale.",
                useCase: "Efficace pour les petits datasets avec séparation non-linéaire.",
                formula: "w·x + b = 0 avec maximisation de la marge"
            },
            {
                name: "Logistic Regression",
                description: "Modèle statistique simple utilisant une fonction sigmoïde pour la classification binaire.",
                useCase: "Baseline rapide et interprétable pour problèmes linéaires.",
                formula: "P(y=1) = 1 / (1 + e^(-wx+b))"
            },
            {
                name: "KNN",
                description: "Classifie un point selon la majorité de ses K plus proches voisins.",
                useCase: "Bon pour données avec frontières de décision irrégulières.",
                formula: "Vote majoritaire des K voisins les plus proches"
            },
            {
                name: "Decision Tree",
                description: "Arbre de décision unique qui segmente l'espace des features.",
                useCase: "Très interprétable mais sensible au surapprentissage.",
                formula: "Partitionnement récursif par critère de Gini ou entropie"
            },
            {
                name: "Naive Bayes",
                description: "Basé sur le théorème de Bayes avec hypothèse d'indépendance des features.",
                useCase: "Rapide et efficace pour la classification de texte.",
                formula: "P(y|X) = P(X|y)·P(y) / P(X)"
            },
            {
                name: "Gradient Boosting",
                description: "Construit des modèles faibles séquentiellement en minimisant le gradient de la perte.",
                useCase: "Alternative robuste à XGBoost pour datasets moyens.",
                formula: "F(x) = Σ γ_m · h_m(x)"
            }
        ],
        regression: [
            {
                name: "Random Forest Regressor",
                description: "Version régression de Random Forest, moyenne les prédictions de plusieurs arbres.",
                useCase: "Robuste aux outliers et non-linéarités.",
                formula: "Moyenne des prédictions de N arbres"
            },
            {
                name: "Gradient Boosting Regressor",
                description: "Champion actuel. Optimise itérativement la fonction de perte.",
                useCase: "Meilleure précision pour estimation continue avec peu d'overfitting.",
                formula: "F(x) = Σ γ_m · h_m(x) avec minimisation MSE"
            },
            {
                name: "Linear Regression",
                description: "Modèle linéaire classique cherchant la meilleure droite de régression.",
                useCase: "Baseline rapide pour relations linéaires simples.",
                formula: "y = w·x + b (minimisation des moindres carrés)"
            },
            {
                name: "Ridge Regression",
                description: "Régression linéaire avec régularisation L2 pour éviter le surapprentissage.",
                useCase: "Quand il y a beaucoup de features corrélées.",
                formula: "min(||y - Xw||² + α||w||²)"
            },
            {
                name: "Lasso",
                description: "Régression avec régularisation L1 qui peut mettre des coefficients à zéro.",
                useCase: "Sélection automatique de features importantes.",
                formula: "min(||y - Xw||² + α||w||₁)"
            },
            {
                name: "SVR (Support Vector Regression)",
                description: "Extension de SVM pour la régression avec marge epsilon.",
                useCase: "Bon pour relations complexes non-linéaires.",
                formula: "Minimisation avec marge ε-insensible"
            },
            {
                name: "XGBoost Regressor",
                description: "Version régression de XGBoost.",
                useCase: "Alternat pour Gradient Boosting Reg.",
                formula: "Boosting avec régularisation avancée"
            },
            {
                name: "Decision Tree Regressor",
                description: "Arbre unique pour prédictions continues.",
                useCase: "Interprétabilité maximale.",
                formula: "Moyenne des valeurs dans chaque feuille"
            }
        ]
    }

    const metricsHelp = {
        classification: [
            {
                name: "Accuracy (Précision)",
                formula: "(TP + TN) / (TP + TN + FP + FN)",
                description: "Pourcentage de prédictions correctes sur l'ensemble des cas.",
                interpretation: "99.2% = le modèle se trompe seulement 0.8% du temps.",
                limit: "Peut être trompeur si les classes sont déséquilibrées."
            },
            {
                name: "F1-Score",
                formula: "2 · (Precision · Recall) / (Precision + Recall)",
                description: "Moyenne harmonique entre précision et rappel. Balance entre faux positifs et faux négatifs.",
                interpretation: "Score proche de 1 = excellent équilibre.",
                limit: "Ne tient pas compte des vrais négatifs."
            },
            {
                name: "AUC-ROC",
                formula: "Aire sous la courbe ROC (TPR vs FPR)",
                description: "Mesure la capacité du modèle à discriminer entre les classes, indépendamment du seuil.",
                interpretation: "> 0.95 = excellent, 0.5 = aléatoire.",
                limit: "Peu informatif pour classes très déséquilibrées."
            }
        ],
        regression: [
            {
                name: "R² Score (Coefficient de détermination)",
                formula: "1 - (SS_res / SS_tot)",
                description: "Proportion de la variance expliquée par le modèle.",
                interpretation: "0.69 = le modèle explique 69% de la variabilité des délais.",
                limit: "Peut être négatif si le modèle est pire qu'une moyenne."
            },
            {
                name: "MAE (Mean Absolute Error)",
                formula: "Σ|y_true - y_pred| / n",
                description: "Erreur moyenne en valeur absolue (en jours pour nous).",
                interpretation: "1.1 jours = en moyenne, le modèle se trompe de 1.1 jour.",
                limit: "Ne pénalise pas les grandes erreurs."
            },
            {
                name: "RMSE (Root Mean Squared Error)",
                formula: "√(Σ(y_true - y_pred)² / n)",
                description: "Racine de l'erreur quadratique moyenne. Pénalise davantage les grandes erreurs.",
                interpretation: "1.59 jours = sensibilité accrue aux outliers vs MAE.",
                limit: "Sensible aux valeurs extrêmes."
            }
        ]
    }

    return (
        <div className="training">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Entraînement & Benchmark IA</h1>
                    <p className="page-subtitle">Comparez les algorithmes et créez le modèle optimal</p>
                </div>
                <button className="help-btn-training" onClick={() => setShowHelp(true)} title="Guide des algorithmes et métriques">
                    <HelpCircle size={24} />
                    <span>Guide IA</span>
                </button>
            </div>

            <div className="training-layout">
                <div className="left-panel">
                    {/* 1. Dataset Selection */}
                    <div className="glass-card section-card">
                        <h3><Database size={20} /> Sélection des Données</h3>
                        <div className="datasource-options">
                            <div
                                className={`ds-option ${dataSource === 'default' ? 'active' : ''}`}
                                onClick={() => setDataSource('default')}
                            >
                                <div className="ds-icon"><Database size={24} /></div>
                                <div>
                                    <h4>Dataset Par Défaut</h4>
                                    <p>bdd_log_clean_CORRIGE_updated.csv</p>
                                </div>
                                {dataSource === 'default' && <CheckCircle className="check-badge" size={16} />}
                            </div>

                            <div
                                className={`ds-option ${dataSource === 'upload' ? 'active' : ''}`}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="ds-icon"><Upload size={24} /></div>
                                <div>
                                    <h4>Importer CSV</h4>
                                    <p>{file ? file.name : "Glisser ou cliquer"}</p>
                                </div>
                                <input
                                    type="file"
                                    hidden
                                    ref={fileInputRef}
                                    accept=".csv"
                                    onChange={handleFileSelect}
                                />
                                {dataSource === 'upload' && <CheckCircle className="check-badge" size={16} />}
                            </div>
                        </div>
                    </div>

                    {/* 2. Task Selection */}
                    <div className="glass-card section-card">
                        <h3><Brain size={20} /> Type de Tâche</h3>
                        <div className="task-selector">
                            <button
                                className={`task-btn ${trainingTask === 'classification' ? 'active' : ''}`}
                                onClick={() => setTrainingTask('classification')}
                            >
                                Classification
                            </button>
                            <button
                                className={`task-btn ${trainingTask === 'regression' ? 'active' : ''}`}
                                onClick={() => setTrainingTask('regression')}
                            >
                                Régression
                            </button>
                            <button
                                className={`task-btn ${trainingTask === 'both' ? 'active' : ''}`}
                                onClick={() => setTrainingTask('both')}
                            >
                                Les deux
                            </button>
                        </div>
                    </div>

                    {/* 3. Algorithm Settings */}
                    <div className="glass-card section-card">
                        <h3><Brain size={20} /> Configuration Algorithmes</h3>
                        <div className="auto-ml-toggle">
                            <Zap size={16} className="zap-icon" />
                            <span>Mode AutoML (Tout comparer)</span>
                            <div
                                className={`toggle-switch ${autoML ? 'active' : ''}`}
                                onClick={() => setAutoML(!autoML)}
                            ></div>
                        </div>

                        {!autoML && (
                            <div className="manual-algo-selection">
                                {(trainingTask === 'classification' || trainingTask === 'both') && (
                                    <div className="algo-group">
                                        <p className="algo-group-label">Classification:</p>
                                        <div className="algo-badges">
                                            {trainingResults.classification.map(m => (
                                                <span
                                                    key={m.model}
                                                    className={`algo-badge clickable ${selectedAlgos.classification.includes(m.model) ? 'active' : ''}`}
                                                    onClick={() => {
                                                        const current = selectedAlgos.classification
                                                        setSelectedAlgos({
                                                            ...selectedAlgos,
                                                            classification: current.includes(m.model)
                                                                ? current.filter(a => a !== m.model)
                                                                : [...current, m.model]
                                                        })
                                                    }}
                                                >
                                                    {m.model}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(trainingTask === 'regression' || trainingTask === 'both') && (
                                    <div className="algo-group">
                                        <p className="algo-group-label">Régression:</p>
                                        <div className="algo-badges">
                                            {trainingResults.regression.map(m => (
                                                <span
                                                    key={m.model}
                                                    className={`algo-badge clickable ${selectedAlgos.regression.includes(m.model) ? 'active' : ''}`}
                                                    onClick={() => {
                                                        const current = selectedAlgos.regression
                                                        setSelectedAlgos({
                                                            ...selectedAlgos,
                                                            regression: current.includes(m.model)
                                                                ? current.filter(a => a !== m.model)
                                                                : [...current, m.model]
                                                        })
                                                    }}
                                                >
                                                    {m.model}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {autoML && (
                            <div className="auto-ml-status">
                                <p>Toutes les architectures ({trainingResults.classification.length + trainingResults.regression.length}) seront évaluées en parallèle.</p>
                            </div>
                        )}
                    </div>

                    {/* Start Button */}
                    <button
                        className="btn btn-primary full-width-btn"
                        disabled={!dataSource || isProcessing}
                        onClick={startTraining}
                    >
                        {isProcessing ? (
                            <><Loader className="spinning" size={20} /> Entraînement en cours...</>
                        ) : (
                            <><Zap size={20} /> Lancer le Benchmark IA</>
                        )}
                    </button>
                </div>

                <div className="right-panel">
                    {/* 3. Process Visualization */}
                    <div className="glass-card processing-section">
                        <h3><BarChart size={20} /> Pipeline d'Entraînement</h3>
                        <div className="steps-container">
                            {processingSteps.map((step) => (
                                <div key={step.id} className={`processing-step ${step.status} ${expandedStep === step.id ? 'expanded' : ''}`}>
                                    <div className="step-indicator">
                                        {getStepIcon(step.status)}
                                        <div className="step-line"></div>
                                    </div>
                                    <div className="step-content">
                                        <div className="step-header">
                                            <h4>{step.name}</h4>
                                            <div className="step-meta">
                                                {step.status === 'completed' && <span className="duration">{step.duration}ms</span>}
                                                <button className="info-btn" onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}>
                                                    <Info size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="step-desc">{step.description}</p>
                                        {step.status === 'processing' && <div className="progress-bar"><div className="fill"></div></div>}

                                        {expandedStep === step.id && (
                                            <div className="step-details-panel">
                                                <div className="detail-row"><strong>Détails:</strong> {stepExplanations[step.id]?.details}</div>
                                                <div className="detail-row"><strong>Techniques:</strong> {stepExplanations[step.id]?.techniques.join(', ')}</div>
                                                <div className="detail-row example"><strong>Exemple:</strong> {stepExplanations[step.id]?.example}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. Benchmark Results */}
                    {benchmarkResults && (
                        <div className={`benchmark-results-container fade-in ${trainingTask === 'both' ? 'split' : 'single'}`}>
                            {(trainingTask === 'classification' || trainingTask === 'both') && (
                                <div className="glass-card result-card">
                                    <div className="card-header-row">
                                        <h3><Trophy size={20} color="var(--color-warning)" /> Benchmark Classification</h3>
                                        <span className="best-model-badge">Champion: {benchmarkResults.classification.find(m => m.isBest)?.model || 'N/A'}</span>
                                    </div>
                                    <table className="benchmark-table">
                                        <thead>
                                            <tr>
                                                <th>Modèle</th>
                                                <th>Accuracy</th>
                                                <th>F1-Score</th>
                                                <th>AUC</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {benchmarkResults.classification.map((res, idx) => (
                                                <tr key={idx} className={res.isBest ? 'best-row' : ''}>
                                                    <td>{res.model} {res.isBest && <Trophy size={12} className="inline-trophy" />}</td>
                                                    <td>{(res.accuracy! * 100).toFixed(1)}%</td>
                                                    <td>{res.f1}</td>
                                                    <td>{res.auc}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {(trainingTask === 'regression' || trainingTask === 'both') && (
                                <div className="glass-card result-card">
                                    <div className="card-header-row">
                                        <h3><TrendingUp size={20} color="var(--color-accent-secondary)" /> Benchmark Régression</h3>
                                        <span className="best-model-badge secondary">Champion: {benchmarkResults.regression.find(m => m.isBest)?.model || 'N/A'}</span>
                                    </div>
                                    <table className="benchmark-table">
                                        <thead>
                                            <tr>
                                                <th>Modèle</th>
                                                <th>R² Score</th>
                                                <th>MAE (Jours)</th>
                                                <th>RMSE</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {benchmarkResults.regression.map((res, idx) => (
                                                <tr key={idx} className={res.isBest ? 'best-row' : ''}>
                                                    <td>{res.model} {res.isBest && <Trophy size={12} className="inline-trophy" />}</td>
                                                    <td>{(res.r2! * 100).toFixed(1)}%</td>
                                                    <td>{res.mae}</td>
                                                    <td>{res.rmse}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Help Modal */}
            {showHelp && (
                <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
                    <div className="help-modal-training" onClick={(e) => e.stopPropagation()}>
                        <div className="help-modal-header">
                            <h2>Guide Technique : Algorithmes & Métriques</h2>
                            <button className="close-btn" onClick={() => setShowHelp(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="help-tabs">
                            <button
                                className={`help-tab ${helpTab === 'algorithms' ? 'active' : ''}`}
                                onClick={() => setHelpTab('algorithms')}
                            >
                                Algorithmes
                            </button>
                            <button
                                className={`help-tab ${helpTab === 'metrics' ? 'active' : ''}`}
                                onClick={() => setHelpTab('metrics')}
                            >
                                Métriques
                            </button>
                        </div>

                        <div className="help-modal-body">
                            {helpTab === 'algorithms' && (
                                <div className="help-section">
                                    <h3>📊 Algorithmes de Classification</h3>
                                    <div className="algo-grid">
                                        {algorithmHelp.classification.map((algo, idx) => (
                                            <div key={idx} className="algo-card">
                                                <h4>{algo.name}</h4>
                                                <p className="algo-desc">{algo.description}</p>
                                                <div className="algo-formula"><strong>Formule:</strong> {algo.formula}</div>
                                                <div className="algo-usecase"><strong>Cas d'usage:</strong> {algo.useCase}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <h3 style={{ marginTop: '2rem' }}>📈 Algorithmes de Régression</h3>
                                    <div className="algo-grid">
                                        {algorithmHelp.regression.map((algo, idx) => (
                                            <div key={idx} className="algo-card">
                                                <h4>{algo.name}</h4>
                                                <p className="algo-desc">{algo.description}</p>
                                                <div className="algo-formula"><strong>Formule:</strong> {algo.formula}</div>
                                                <div className="algo-usecase"><strong>Cas d'usage:</strong> {algo.useCase}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {helpTab === 'metrics' && (
                                <div className="help-section">
                                    <h3>🎯 Métriques de Classification</h3>
                                    <div className="metrics-grid">
                                        {metricsHelp.classification.map((metric, idx) => (
                                            <div key={idx} className="metric-card">
                                                <h4>{metric.name}</h4>
                                                <div className="metric-formula">📐 {metric.formula}</div>
                                                <p>{metric.description}</p>
                                                <div className="metric-interpretation">💡 <strong>Interprétation:</strong> {metric.interpretation}</div>
                                                <div className="metric-limit">⚠️ <strong>Limite:</strong> {metric.limit}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <h3 style={{ marginTop: '2rem' }}>📉 Métriques de Régression</h3>
                                    <div className="metrics-grid">
                                        {metricsHelp.regression.map((metric, idx) => (
                                            <div key={idx} className="metric-card">
                                                <h4>{metric.name}</h4>
                                                <div className="metric-formula">📐 {metric.formula}</div>
                                                <p>{metric.description}</p>
                                                <div className="metric-interpretation">💡 <strong>Interprétation:</strong> {metric.interpretation}</div>
                                                <div className="metric-limit">⚠️ <strong>Limite:</strong> {metric.limit}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Training
