import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
    number: string;
    isLoggedIn: boolean;
}

interface AuthContextType {
    user: User | null;
    login: (number: string) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check local storage for existing session on mount
        const savedSession = localStorage.getItem('jiotv_session');
        if (savedSession) {
            try {
                const parsed = JSON.parse(savedSession);
                setUser(parsed);
            } catch (e) {
                console.error("Failed to parse session", e);
                localStorage.removeItem('jiotv_session');
            }
        }
        setIsLoading(false);
    }, []);

    const login = (number: string) => {
        const newUser = { number, isLoggedIn: true };
        setUser(newUser);
        localStorage.setItem('jiotv_session', JSON.stringify(newUser));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('jiotv_session');
        // Here we should also call the server's /logout endpoint ideally.
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
