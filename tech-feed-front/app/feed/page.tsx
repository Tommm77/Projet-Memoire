"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { ArticleCard } from "@/components/article-card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { contentAPI, interactionAPI, recommendationAPI, type Content, type PaginationInfo } from "@/lib/api"
import { Loader2, Heart, RefreshCw, AlertCircle } from "lucide-react"

interface FeedState {
  contents: Content[]
  loading: boolean
  error: string | null
  pagination: PaginationInfo | null
  likedContents: Set<number>
  savedContents: Set<number>
}

export default function FeedPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  
  const [state, setState] = useState<FeedState>({
    contents: [],
    loading: true,
    error: null,
    pagination: null,
    likedContents: new Set(),
    savedContents: new Set()
  })
  
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'engagement' | 'featured'>('recent')
  const [categories, setCategories] = useState<Array<{ name: string; count: number }>>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Charger les données initiales
  useEffect(() => {
    if (user) {
      loadInitialData()
    }
  }, [user, sortBy, selectedCategory])

  // Redirection si non connecté
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const loadInitialData = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Charger les contenus selon les filtres
      const contentsPromise = user?.is_admin 
        ? contentAPI.getContents({ sort_by: sortBy, category: selectedCategory !== 'all' ? selectedCategory : undefined })
        : recommendationAPI.getPersonalized(20)

      // Charger les catégories
      const categoriesPromise = contentAPI.getCategories()

      // Charger les contenus aimés de l'utilisateur
      const likedPromise = interactionAPI.getLikedContents()

      const [contentsResponse, categoriesResponse, likedResponse] = await Promise.all([
        contentsPromise,
        categoriesPromise,
        likedPromise
      ])

      let contents: Content[] = []
      let pagination: PaginationInfo | null = null

      if (contentsResponse.success) {
        if ('contents' in contentsResponse.data!) {
          contents = contentsResponse.data.contents
          pagination = contentsResponse.data.pagination || null
        } else if ('recommendations' in contentsResponse.data!) {
          contents = contentsResponse.data.recommendations
        }
      }

      const categories = categoriesResponse.success ? categoriesResponse.data?.categories || [] : []
      const likedContents = new Set(
        likedResponse.success 
          ? likedResponse.data?.contents.map(c => c.id) || []
          : []
      )

      setState({
        contents,
        loading: false,
        error: null,
        pagination,
        likedContents,
        savedContents: new Set() // TODO: Implémenter les favoris
      })

      setCategories(categories)

    } catch (error) {
      console.error('Erreur lors du chargement:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: "Erreur lors du chargement des articles"
      }))
    }
  }

  const handleLike = async (contentId: number) => {
    try {
      const response = await interactionAPI.toggleLike(contentId)
      
      if (response.success && response.data) {
        const { liked, likes_count } = response.data
        
        setState(prev => ({
          ...prev,
          likedContents: liked 
            ? new Set([...prev.likedContents, contentId])
            : new Set([...prev.likedContents].filter(id => id !== contentId)),
          contents: prev.contents.map(content =>
            content.id === contentId 
              ? { ...content, like_count: likes_count }
              : content
          )
        }))
      }
    } catch (error) {
      console.error('Erreur lors du like:', error)
    }
  }

  const handleSave = async (contentId: number) => {
    try {
      const response = await interactionAPI.toggleFavorite(contentId)
      
      if (response.success && response.data) {
        const { favorited } = response.data
        
        setState(prev => ({
          ...prev,
          savedContents: favorited
            ? new Set([...prev.savedContents, contentId])
            : new Set([...prev.savedContents].filter(id => id !== contentId))
        }))
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error)
    }
  }

  const loadMoreContents = async () => {
    if (!state.pagination?.has_next) return

    setState(prev => ({ ...prev, loading: true }))

    try {
      const response = await contentAPI.getContents({ 
        sort_by: sortBy, 
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        page: (state.pagination?.page || 1) + 1 
      })

      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          contents: [...prev.contents, ...response.data!.contents],
          pagination: response.data!.pagination,
          loading: false
        }))
      }
    } catch (error) {
      console.error('Erreur lors du chargement de plus de contenus:', error)
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  if (authLoading || state.loading && state.contents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement de votre feed personnalisé...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (state.error && state.contents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erreur</h3>
          <p className="text-gray-600 mb-4">{state.error}</p>
          <Button onClick={loadInitialData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {user.is_admin ? 'Tous les articles' : 'Pour vous'}
            </h1>
            <p className="text-gray-600">
              {user.is_admin 
                ? `${state.contents.length} article${state.contents.length > 1 ? 's' : ''} au total`
                : `Articles personnalisés selon vos préférences : ${user.preferences.join(", ")}`
              }
            </p>
          </div>

          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            {/* Filtre par catégorie */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.name} value={category.name}>
                    {category.name} ({category.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tri */}
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récent</SelectItem>
                <SelectItem value="popular">Populaire</SelectItem>
                <SelectItem value="engagement">Engagement</SelectItem>
                <SelectItem value="featured">En vedette</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!user.is_admin && user.preferences.length > 0 && (
          <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <Heart className="h-5 w-5 text-blue-600 mr-2" />
              <p className="text-blue-800">
                <strong>Recommandations personnalisées</strong> - Ces articles correspondent à vos centres d'intérêt
              </p>
            </div>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-2xl font-bold text-blue-600">{state.contents.length}</p>
            <p className="text-sm text-gray-600">Articles</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-2xl font-bold text-green-600">{state.likedContents.size}</p>
            <p className="text-sm text-gray-600">Aimés</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-2xl font-bold text-purple-600">
              {state.contents.filter(c => c.is_featured).length}
            </p>
            <p className="text-sm text-gray-600">En vedette</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-2xl font-bold text-orange-600">{categories.length}</p>
            <p className="text-sm text-gray-600">Catégories</p>
          </div>
        </div>

        {/* Liste des articles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.contents.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onLike={handleLike}
              onSave={handleSave}
              showActions={true}
              isLiked={state.likedContents.has(article.id)}
              isSaved={state.savedContents.has(article.id)}
            />
          ))}
        </div>

        {/* Charger plus */}
        {state.pagination?.has_next && (
          <div className="mt-12 text-center">
            <Button 
              variant="outline" 
              size="lg" 
              onClick={loadMoreContents}
              disabled={state.loading}
            >
              {state.loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Charger plus d'articles
            </Button>
          </div>
        )}

        {/* Message si aucun article */}
        {state.contents.length === 0 && !state.loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">Aucun article trouvé</p>
            <Button onClick={loadInitialData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
