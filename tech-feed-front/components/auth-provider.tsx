"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { authAPI, type User } from "../lib/api"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, name: string, preferences: string[]) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Clés de stockage
const TOKEN_KEY = 'techfeed_token'
const REFRESH_TOKEN_KEY = 'techfeed_refresh_token'
const USER_KEY = 'techfeed_user'

// Utilitaires de validation
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (password.length < 6) {
    errors.push("Le mot de passe doit contenir au moins 6 caractères")
  }
  
  return { valid: errors.length === 0, errors }
}

// Utilitaires de stockage
const getStorageType = (rememberMe: boolean) => rememberMe ? localStorage : sessionStorage

const saveAuthData = (user: User, accessToken: string, refreshToken: string, rememberMe: boolean) => {
  const storage = getStorageType(rememberMe)
  storage.setItem(TOKEN_KEY, accessToken)
  storage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  storage.setItem(USER_KEY, JSON.stringify(user))
}

const clearAuthData = () => {
  [localStorage, sessionStorage].forEach(storage => {
    storage.removeItem(TOKEN_KEY)
    storage.removeItem(REFRESH_TOKEN_KEY)
    storage.removeItem(USER_KEY)
  })
}

const getAuthData = () => {
  // Essayer localStorage d'abord, puis sessionStorage
  for (const storage of [localStorage, sessionStorage]) {
    const token = storage.getItem(TOKEN_KEY)
    const user = storage.getItem(USER_KEY)
    if (token && user) {
      return {
        token,
        user: JSON.parse(user) as User,
        refreshToken: storage.getItem(REFRESH_TOKEN_KEY)
      }
    }
  }
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    try {
      const authData = getAuthData()
      
      if (authData?.token) {
        // Vérifier si l'utilisateur est toujours valide en récupérant son profil
        const response = await authAPI.getProfile()
        
        if (response.success && response.data) {
          setUser(response.data)
        } else {
          // Token invalide, nettoyer le stockage
          clearAuthData()
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'auth:', error)
      clearAuthData()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string, rememberMe = false): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validation côté client
      if (!validateEmail(email)) {
        return { success: false, error: "Adresse email invalide" }
      }

      if (!password) {
        return { success: false, error: "Mot de passe requis" }
      }

      // Appel API
      const response = await authAPI.login(email, password)
      
      if (response.success && response.data) {
        const { user: userData, access_token, refresh_token } = response.data
        
        // Sauvegarder les données d'authentification
        saveAuthData(userData, access_token, refresh_token, rememberMe)
        setUser(userData)
        
        return { success: true }
      } else {
        return { success: false, error: response.error || "Erreur de connexion" }
      }

    } catch (error) {
      console.error('Erreur de connexion:', error)
      return { success: false, error: "Une erreur inattendue s'est produite" }
    }
  }

  const signup = async (email: string, password: string, name: string, preferences: string[]): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validations côté client
      if (!validateEmail(email)) {
        return { success: false, error: "Adresse email invalide" }
      }

      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return { success: false, error: passwordValidation.errors[0] }
      }

      if (!name.trim()) {
        return { success: false, error: "Le nom est requis" }
      }

      if (preferences.length === 0) {
        return { success: false, error: "Veuillez sélectionner au moins un centre d'intérêt" }
      }

      // Appel API
      const response = await authAPI.signup(email, password, name, preferences)
      
      if (response.success && response.data) {
        const { user: userData, access_token, refresh_token } = response.data
        
        // Sauvegarder les données d'authentification (par défaut avec rememberMe = true)
        saveAuthData(userData, access_token, refresh_token, true)
        setUser(userData)
        
        return { success: true }
      } else {
        return { success: false, error: response.error || "Erreur lors de l'inscription" }
      }

    } catch (error) {
      console.error('Erreur d\'inscription:', error)
      return { success: false, error: "Une erreur inattendue s'est produite" }
    }
  }

  const updateProfile = async (data: Partial<User>): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authAPI.updateProfile(data)
      
      if (response.success && response.data) {
        const updatedUser = response.data
        setUser(updatedUser)
        
        // Mettre à jour les données stockées
        const authData = getAuthData()
        if (authData) {
          const storage = localStorage.getItem(USER_KEY) ? localStorage : sessionStorage
          storage.setItem(USER_KEY, JSON.stringify(updatedUser))
        }
        
        return { success: true }
      } else {
        return { success: false, error: response.error || "Erreur lors de la mise à jour" }
      }
    } catch (error) {
      console.error('Erreur mise à jour profil:', error)
      return { success: false, error: "Une erreur inattendue s'est produite" }
    }
  }

  const logout = () => {
    clearAuthData()
    setUser(null)
  }

  const value = {
    user,
    login,
    signup,
    logout,
    updateProfile,
    isLoading,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
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
