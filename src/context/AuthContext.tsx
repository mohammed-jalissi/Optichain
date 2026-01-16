import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface AuthContextType {
    isAuthenticated: boolean
    login: (username: string, password: string) => boolean
    logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    useEffect(() => {
        // Check if user is already logged in
        const auth = localStorage.getItem('optichain_auth')
        if (auth === 'true') {
            setIsAuthenticated(true)
        }
    }, [])

    const login = (username: string, password: string): boolean => {
        // Simple hardcoded credentials
        if (username === 'admin' && password === 'admin123') {
            setIsAuthenticated(true)
            localStorage.setItem('optichain_auth', 'true')
            return true
        }
        return false
    }

    const logout = () => {
        setIsAuthenticated(false)
        localStorage.removeItem('optichain_auth')
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
