import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import Papa from 'papaparse'

// Define the shape of our data (adjust based on CSV columns)
export interface LogistiqueData {
    order_id: string
    date_commande: string
    transporteur: string
    region: string
    ville_livraison: string // Mapped from region/city logic if needed, or direct column
    poids_kg: number
    cout_transport: number
    statut_livraison: string
    delai_livraison: number
    date_expedition: string
    date_livraison_prevue: string
    date_livraison_reelle: string
    satisfaction_client: number
    // Add other columns as needed
    [key: string]: any
}

interface DataContextType {
    data: LogistiqueData[]
    loading: boolean
    error: string | null
    refreshData: () => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<LogistiqueData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            console.log("Fetching full dataset...")
            // Use Papa Parse's built-in download feature which handles large files and streaming better
            Papa.parse('/data/bdd_log_clean_CORRIGE_updated.csv', {
                download: true,
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true, // Automatically convert numbers
                complete: (results) => {
                    console.log(`Dataset loaded: ${results.data.length} rows`)
                    if (results.errors.length > 0) {
                        console.warn("CSV Parsing errors:", results.errors)
                    }
                    setData(results.data as LogistiqueData[])
                    setLoading(false)
                },
                error: (err) => {
                    console.error("Error parsing CSV:", err)
                    setError(err.message)
                    setLoading(false)
                }
            })
        } catch (err) {
            console.error("Fetch error:", err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    return (
        <DataContext.Provider value={{ data, loading, error, refreshData: fetchData }}>
            {children}
        </DataContext.Provider>
    )
}

export function useData() {
    const context = useContext(DataContext)
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider')
    }
    return context
}
