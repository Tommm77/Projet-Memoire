// Configuration et utilitaires pour l'API TechFeed
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

// Interface pour les réponses API
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Interface User pour correspondre au backend
export interface User {
  id: number
  email: string
  name: string
  preferences: string[]
  is_admin: boolean
  is_active: boolean
  avatar?: string
  created_at: string
  updated_at: string
  last_login?: string
}

// Interface Content
export interface Content {
  id: number
  title: string
  excerpt: string
  content?: string
  author: string
  category: string
  tags: string[]
  image_url?: string
  external_url?: string
  duration: number
  difficulty_level: string
  is_published: boolean
  is_featured: boolean
  view_count: number
  like_count: number
  engagement_score: number
  created_at: string
  updated_at: string
  published_at: string
}

// Interface Pagination
export interface PaginationInfo {
  page: number
  per_page: number
  total: number
  pages: number
  has_next: boolean
  has_prev: boolean
}

// Interface pour les réponses avec pagination
export interface PaginatedResponse<T> {
  success: boolean
  data?: T[]
  pagination?: PaginationInfo
  error?: string
}

// Utilitaire pour récupérer le token d'authentification
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null
  
  return localStorage.getItem('techfeed_token') || 
         sessionStorage.getItem('techfeed_token')
}

// Fonction utilitaire pour les appels API
const apiCall = async <T = any>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const token = getAuthToken()
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Erreur HTTP: ${response.status}`)
    }

    const data = await response.json()
    return data
    
  } catch (error) {
    console.error(`Erreur API ${endpoint}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }
  }
}

// API Auth
export const authAPI = {
  // Connexion
  login: async (email: string, password: string): Promise<ApiResponse<{ user: User; access_token: string; refresh_token: string }>> => {
    const response: any = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.user) {
      return {
        success: true,
        data: {
          user: response.user,
          access_token: response.access_token,
          refresh_token: response.refresh_token
        }
      }
    }
    
    return response
  },

  // Inscription
  signup: async (email: string, password: string, name: string, preferences: string[]): Promise<ApiResponse<{ user: User; access_token: string; refresh_token: string }>> => {
    const response: any = await apiCall('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, preferences })
    })
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.user) {
      return {
        success: true,
        data: {
          user: response.user,
          access_token: response.access_token,
          refresh_token: response.refresh_token
        }
      }
    }
    
    return response
  },

  // Récupérer le profil
  getProfile: async (): Promise<ApiResponse<User>> => {
    const response: any = await apiCall('/auth/profile')
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.user) {
      return {
        success: true,
        data: response.user
      }
    }
    
    return response
  },

  // Mettre à jour le profil
  updateProfile: async (data: Partial<User>): Promise<ApiResponse<User>> => {
    const response: any = await apiCall('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.user) {
      return {
        success: true,
        data: response.user
      }
    }
    
    return response
  },

  // Rafraîchir le token
  refreshToken: async (refreshToken: string): Promise<ApiResponse<{ access_token: string }>> => {
    const response: any = await apiCall('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken })
    })
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.access_token) {
      return {
        success: true,
        data: {
          access_token: response.access_token
        }
      }
    }
    
    return response
  }
}

// API Content
export const contentAPI = {
  // Liste des contenus avec pagination et filtres
  getContents: async (params?: {
    page?: number
    per_page?: number
    category?: string
    search?: string
    sort_by?: 'recent' | 'popular' | 'engagement' | 'featured'
    difficulty?: string
  }): Promise<ApiResponse<{ contents: Content[]; pagination: PaginationInfo }>> => {
    const queryParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString())
        }
      })
    }
    
    const endpoint = `/content/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    const response: any = await apiCall(endpoint)
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.contents) {
      return {
        success: true,
        data: {
          contents: response.contents,
          pagination: response.pagination
        }
      }
    }
    
    return response
  },

  // Contenu spécifique
  getContent: async (id: number): Promise<ApiResponse<{ content: Content }>> => {
    const response: any = await apiCall(`/content/${id}`)
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.content) {
      return {
        success: true,
        data: {
          content: response.content
        }
      }
    }
    
    return response
  },

  // Contenus mis en avant
  getFeatured: async (limit?: number): Promise<ApiResponse<{ contents: Content[] }>> => {
    const endpoint = `/content/featured${limit ? `?limit=${limit}` : ''}`
    return apiCall(endpoint)
  },

  // Contenus populaires
  getPopular: async (limit?: number): Promise<ApiResponse<{ contents: Content[] }>> => {
    const endpoint = `/content/popular${limit ? `?limit=${limit}` : ''}`
    return apiCall(endpoint)
  },

  // Contenus récents
  getRecent: async (limit?: number): Promise<ApiResponse<{ contents: Content[] }>> => {
    const endpoint = `/content/recent${limit ? `?limit=${limit}` : ''}`
    return apiCall(endpoint)
  },

  // Catégories
  getCategories: async (): Promise<ApiResponse<{ categories: Array<{ name: string; count: number }> }>> => {
    return apiCall('/content/categories')
  },

  // Recherche
  search: async (query: string, filters?: {
    category?: string
    difficulty?: string
    page?: number
  }): Promise<ApiResponse<{ contents: Content[]; pagination: PaginationInfo }>> => {
    const queryParams = new URLSearchParams({ search: query })
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString())
        }
      })
    }
    
    return apiCall(`/content/search?${queryParams.toString()}`)
  }
}

// API Interactions
export const interactionAPI = {
  // Toggle like
  toggleLike: async (contentId: number): Promise<ApiResponse<{ liked: boolean; likes_count: number }>> => {
    const response: any = await apiCall('/interaction/toggle', {
      method: 'POST',
      body: JSON.stringify({
        content_id: contentId,
        interaction_type: 'like'
      })
    })
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success) {
      return {
        success: true,
        data: {
          liked: response.action === 'added',
          likes_count: 0 // TODO: récupérer le vrai compteur depuis le contenu
        }
      }
    }
    
    return response
  },

  // Toggle favori
  toggleFavorite: async (contentId: number): Promise<ApiResponse<{ favorited: boolean }>> => {
    const response: any = await apiCall('/interaction/toggle', {
      method: 'POST',
      body: JSON.stringify({
        content_id: contentId,
        interaction_type: 'favorite'
      })
    })
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success) {
      return {
        success: true,
        data: {
          favorited: response.action === 'added'
        }
      }
    }
    
    return response
  },

  // Historique utilisateur
  getUserHistory: async (): Promise<ApiResponse<{ interactions: any[] }>> => {
    return apiCall('/interaction/user/history')
  },

  // Contenus aimés
  getLikedContents: async (): Promise<ApiResponse<{ contents: Content[] }>> => {
    const response: any = await apiCall('/interaction/user/liked')
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.liked_contents) {
      return {
        success: true,
        data: {
          contents: response.liked_contents
        }
      }
    }
    
    return response
  }
}

// API Recommandations
export const recommendationAPI = {
  // Recommandations personnalisées
  getPersonalized: async (limit?: number): Promise<ApiResponse<{ recommendations: Content[] }>> => {
    const endpoint = `/recommendation/for-you${limit ? `?limit=${limit}` : ''}`
    const response: any = await apiCall(endpoint)
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.recommendations) {
      return {
        success: true,
        data: {
          recommendations: response.recommendations
        }
      }
    }
    
    return response
  },

  // Contenus similaires
  getSimilar: async (contentId: number, limit?: number): Promise<ApiResponse<{ recommendations: Content[] }>> => {
    const endpoint = `/recommendation/similar/${contentId}${limit ? `?limit=${limit}` : ''}`
    return apiCall(endpoint)
  },

  // Tendances
  getTrending: async (limit?: number): Promise<ApiResponse<{ recommendations: Content[] }>> => {
    const endpoint = `/recommendation/trending${limit ? `?limit=${limit}` : ''}`
    return apiCall(endpoint)
  }
}

// API Admin
export const adminAPI = {
  // Statistiques globales
  getStats: async (): Promise<ApiResponse<{
    users: { total: number; active: number; admins: number }
    contents: { total: number; published: number; featured: number }
    interactions: { total: number; likes: number; views: number }
    top_contents: Content[]
    categories: Array<{ name: string; content_count: number; total_views: number }>
  }>> => {
    const response: any = await apiCall('/admin/stats')
    
    // Mapper la réponse backend vers le format attendu par le frontend
    if (response.success && response.stats) {
      return {
        success: true,
        data: response.stats
      }
    }
    
    return response
  },

  // Gestion des utilisateurs
  getUsers: async (params?: {
    page?: number
    per_page?: number
    search?: string
  }): Promise<ApiResponse<{ users: User[]; pagination: PaginationInfo }>> => {
    const queryParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString())
        }
      })
    }
    
    const endpoint = `/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiCall(endpoint)
  },

  // Mettre à jour un utilisateur
  updateUser: async (userId: number, data: Partial<User>): Promise<ApiResponse<{ user: User }>> => {
    return apiCall(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  // Gestion des contenus admin
  getContents: async (params?: {
    page?: number
    per_page?: number
    status?: 'published' | 'draft' | 'featured'
    category?: string
    search?: string
  }): Promise<ApiResponse<{ contents: Content[]; pagination: PaginationInfo }>> => {
    const queryParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString())
        }
      })
    }
    
    const endpoint = `/admin/contents${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiCall(endpoint)
  },

  // Créer un contenu
  createContent: async (data: Partial<Content>): Promise<ApiResponse<{ content: Content }>> => {
    return apiCall('/admin/contents', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // Mettre à jour un contenu
  updateContent: async (contentId: number, data: Partial<Content>): Promise<ApiResponse<{ content: Content }>> => {
    return apiCall(`/admin/contents/${contentId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  // Supprimer un contenu
  deleteContent: async (contentId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiCall(`/admin/contents/${contentId}`, {
      method: 'DELETE'
    })
  },

  // Interactions admin
  getInteractions: async (params?: {
    page?: number
    per_page?: number
    type?: string
    user_id?: number
    content_id?: number
  }): Promise<ApiResponse<{ interactions: any[]; pagination: PaginationInfo }>> => {
    const queryParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString())
        }
      })
    }
    
    const endpoint = `/admin/interactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiCall(endpoint)
  }
}

// Export par défaut
export default {
  auth: authAPI,
  content: contentAPI,
  interaction: interactionAPI,
  recommendation: recommendationAPI,
  admin: adminAPI
} 