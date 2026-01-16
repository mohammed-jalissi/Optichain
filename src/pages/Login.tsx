import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, User, LogIn } from 'lucide-react'
import './Login.css'

function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const { login } = useAuth()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (login(username, password)) {
            navigate('/')
        } else {
            setError('Identifiants incorrects. Utilisez admin/admin123')
        }
    }

    return (
        <div className="login-container">
            <div className="login-background">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="login-card">
                <div className="login-header">
                    <div className="logo-container">
                        <div className="logo-cube"></div>
                        <h1>OptiChain</h1>
                    </div>
                    <p className="login-subtitle">Système Intelligent de Prédiction Logistique</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="username">
                            <User size={18} />
                            Nom d'utilisateur
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="admin"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">
                            <Lock size={18} />
                            Mot de passe
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <button type="submit" className="login-button">
                        <LogIn size={20} />
                        Se connecter
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Login
