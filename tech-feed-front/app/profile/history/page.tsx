"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { ArticleCard } from "@/components/article-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { interactionAPI, contentAPI, type Content } from "@/lib/api"
import { Loader2, AlertCircle, History, Heart, Bookmark, Eye, ArrowLeft, Calendar } from "lucide-react"
import { formatDistance } from "date-fns"
import { fr } from "date-fns/locale"

interface Interaction {
  id: number
  content_id: number
  type: 'view' | 'like' | 'favorite'
  rating?: number
  duration?: number
  created_at: string
  content?: Content
}

interface HistoryState {
  interactions: Interaction[]
  likedContents: Content[]
  loading: boolean
  error: string | null
  filter: 'all' | 'likes' | 'views' | 'favorites'
}

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [state, setState] = useState<HistoryState>({
    interactions: [],
    likedContents: [],
    loading: true,
    error: null,
    filter: 'all'
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    } else if (user) {
      loadHistory()
    }
  }, [user, authLoading, router])

  const loadHistory = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Charger l'historique et les contenus aimés en parallèle
      const [historyResponse, likedResponse] = await Promise.all([
        interactionAPI.getUserHistory(),
        interactionAPI.getLikedContents()
      ])

      let interactions: Interaction[] = []
      let likedContents: Content[] = []

      if (historyResponse.success && historyResponse.data) {
        interactions = historyResponse.data.interactions || []
      }

      if (likedResponse.success && likedResponse.data) {
        likedContents = likedResponse.data.contents || []
      }

      setState({
        interactions,
        likedContents,
        loading: false,
        error: null,
        filter: 'all'
      })

    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: "Erreur lors du chargement de l'historique"
      }))
    }
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return formatDistance(date, new Date(), { addSuffix: true, locale: fr })
    } catch {
      return "Récemment"
    }
  }

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="h-4 w-4 text-red-500" />
      case 'favorite': return <Bookmark className="h-4 w-4 text-blue-500" />
      case 'view': return <Eye className="h-4 w-4 text-gray-500" />
      default: return <History className="h-4 w-4 text-gray-500" />
    }
  }

  const getInteractionText = (type: string) => {
    switch (type) {
      case 'like': return 'Aimé'
      case 'favorite': return 'Ajouté aux favoris'
      case 'view': return 'Consulté'
      default: return 'Interaction'
    }
  }

  const getFilteredContent = () => {
    switch (state.filter) {
      case 'likes':
        return state.likedContents
      case 'views':
        return state.interactions
          .filter(i => i.type === 'view' && i.content)
          .map(i => i.content!)
          .filter((content, index, arr) => 
            arr.findIndex(c => c.id === content.id) === index
          ) // Supprimer les doublons
      case 'favorites':
        return state.interactions
          .filter(i => i.type === 'favorite' && i.content)
          .map(i => i.content!)
      default:
        return [
          ...state.likedContents,
          ...state.interactions
            .filter(i => i.content)
            .map(i => i.content!)
        ].filter((content, index, arr) => 
          arr.findIndex(c => c.id === content.id) === index
        )
    }
  }

  const getStats = () => {
    const totalViews = state.interactions.filter(i => i.type === 'view').length
    const totalLikes = state.likedContents.length
    const totalFavorites = state.interactions.filter(i => i.type === 'favorite').length

    return { totalViews, totalLikes, totalFavorites }
  }

  if (authLoading || state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement de votre historique...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erreur</h3>
          <p className="text-gray-600 mb-4">{state.error}</p>
          <Button onClick={loadHistory}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  const filteredContent = getFilteredContent()
  const stats = getStats()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/profile">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au profil
            </Link>
          </Button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                <History className="h-8 w-8 mr-3" />
                Mon historique
              </h1>
              <p className="text-gray-600">
                Retrouvez tous vos articles consultés, aimés et sauvegardés
              </p>
            </div>

            <div className="mt-4 md:mt-0">
              <Select 
                value={state.filter} 
                onValueChange={(value: any) => setState(prev => ({ ...prev, filter: value }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrer par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout voir</SelectItem>
                  <SelectItem value="likes">Articles aimés</SelectItem>
                  <SelectItem value="favorites">Favoris</SelectItem>
                  <SelectItem value="views">Consultés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-500">{stats.totalViews}</p>
                <p className="text-sm text-gray-600">Articles consultés</p>
              </div>
              <Eye className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-500">{stats.totalLikes}</p>
                <p className="text-sm text-gray-600">Articles aimés</p>
              </div>
              <Heart className="h-8 w-8 text-red-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-500">{stats.totalFavorites}</p>
                <p className="text-sm text-gray-600">Favoris</p>
              </div>
              <Bookmark className="h-8 w-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Timeline des interactions récentes */}
        {state.filter === 'all' && state.interactions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Activité récente</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {state.interactions.slice(0, 10).map((interaction) => (
                <div key={interaction.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  {getInteractionIcon(interaction.type)}
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{getInteractionText(interaction.type)}</span>
                      {interaction.content && (
                        <span> • </span>
                      )}
                      {interaction.content && (
                        <Link 
                          href={`/article/${interaction.content_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {interaction.content.title}
                        </Link>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(interaction.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liste des articles */}
        {filteredContent.length > 0 ? (
          <div>
            <h2 className="text-xl font-semibold mb-6">
              {state.filter === 'likes' && 'Articles que vous aimez'}
              {state.filter === 'favorites' && 'Vos favoris'}
              {state.filter === 'views' && 'Articles consultés'}
              {state.filter === 'all' && 'Tous vos articles'}
              <span className="text-gray-500 ml-2">({filteredContent.length})</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContent.map((content) => (
                <ArticleCard
                  key={content.id}
                  article={content}
                  showActions={true}
                  isLiked={state.likedContents.some(c => c.id === content.id)}
                  isSaved={state.interactions.some(i => 
                    i.type === 'favorite' && i.content_id === content.id
                  )}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-500 mb-2">
              {state.filter === 'likes' && 'Aucun article aimé'}
              {state.filter === 'favorites' && 'Aucun favori'}
              {state.filter === 'views' && 'Aucun article consulté'}
              {state.filter === 'all' && 'Aucune activité'}
            </h3>
            <p className="text-gray-400 mb-4">
              Commencez à explorer les articles pour voir votre historique ici.
            </p>
            <Button asChild>
              <Link href="/feed">Découvrir des articles</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 