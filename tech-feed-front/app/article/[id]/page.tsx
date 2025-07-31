"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArticleCard } from "@/components/article-card"
import { useAuth } from "@/components/auth-provider"
import { contentAPI, interactionAPI, recommendationAPI, type Content } from "@/lib/api"
import { ArrowLeft, Heart, Bookmark, Share2, Calendar, User, Clock, Eye, Loader2, AlertCircle } from "lucide-react"
import { formatDistance } from "date-fns"
import { fr } from "date-fns/locale"

interface ArticleState {
  article: Content | null
  relatedArticles: Content[]
  loading: boolean
  error: string | null
  isLiked: boolean
  isSaved: boolean
}

export default function ArticlePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const articleId = parseInt(params.id as string)

  const [state, setState] = useState<ArticleState>({
    article: null,
    relatedArticles: [],
    loading: true,
    error: null,
    isLiked: false,
    isSaved: false
  })

  useEffect(() => {
    if (articleId && !isNaN(articleId)) {
      loadArticle()
    } else {
      setState(prev => ({ ...prev, loading: false, error: "ID d'article invalide" }))
    }
  }, [articleId])

  const loadArticle = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Charger l'article principal
      const articleResponse = await contentAPI.getContent(articleId)
      
      if (!articleResponse.success || !articleResponse.data) {
        setState(prev => ({ ...prev, loading: false, error: "Article non trouvé" }))
        return
      }

      const article = articleResponse.data.content

      // Charger les articles similaires
      const relatedResponse = await recommendationAPI.getSimilar(articleId, 3)
      const relatedArticles = relatedResponse.success && relatedResponse.data 
        ? relatedResponse.data.recommendations 
        : []

      // Vérifier si l'utilisateur a liké/sauvegardé cet article (si connecté)
      let isLiked = false
      let isSaved = false
      
      if (user) {
        try {
          const [likedResponse] = await Promise.all([
            interactionAPI.getLikedContents(),
            // TODO: Ajouter API pour récupérer les favoris
          ])

          if (likedResponse.success && likedResponse.data) {
            isLiked = likedResponse.data.contents.some(c => c.id === articleId)
          }
        } catch (error) {
          console.error('Erreur lors de la vérification des interactions:', error)
        }
      }

      setState({
        article,
        relatedArticles,
        loading: false,
        error: null,
        isLiked,
        isSaved
      })

    } catch (error) {
      console.error('Erreur lors du chargement de l\'article:', error)
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Erreur lors du chargement de l'article" 
      }))
    }
  }

  const handleLike = async () => {
    if (!user) {
      router.push('/login')
      return
    }

    try {
      const response = await interactionAPI.toggleLike(articleId)
      
      if (response.success && response.data) {
        const { liked, likes_count } = response.data
        
        setState(prev => ({
          ...prev,
          isLiked: liked,
          article: prev.article ? { ...prev.article, like_count: likes_count } : null
        }))
      }
    } catch (error) {
      console.error('Erreur lors du like:', error)
    }
  }

  const handleSave = async () => {
    if (!user) {
      router.push('/login')
      return
    }

    try {
      const response = await interactionAPI.toggleFavorite(articleId)
      
      if (response.success && response.data) {
        const { favorited } = response.data
        setState(prev => ({ ...prev, isSaved: favorited }))
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error)
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: state.article?.title || 'Article TechFeed',
      text: state.article?.excerpt || '',
      url: window.location.href,
    }

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        // TODO: Ajouter une notification toast
        alert('Lien copié dans le presse-papiers !')
      }
    } catch (error) {
      console.error('Erreur lors du partage:', error)
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

  const getCategoryColor = (category: string): string => {
    const colors = {
      'IA': 'bg-purple-100 text-purple-800',
      'DevOps': 'bg-blue-100 text-blue-800',
      'Cyber': 'bg-red-100 text-red-800',
      'Mobile': 'bg-green-100 text-green-800',
      'Frontend': 'bg-orange-100 text-orange-800',
      'Backend': 'bg-gray-100 text-gray-800',
    }
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getDefaultImage = (category: string): string => {
    const images = {
      'IA': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop',
      'DevOps': 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=800&h=400&fit=crop',
      'Cyber': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=400&fit=crop',
      'Mobile': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=400&fit=crop',
      'Frontend': 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&h=400&fit=crop',
      'Backend': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=400&fit=crop',
    }
    return images[category as keyof typeof images] || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop'
  }

  // États de chargement et d'erreur
  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement de l'article...</p>
        </div>
      </div>
    )
  }

  if (state.error || !state.article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">{state.error || "Article non trouvé"}</h1>
          <div className="space-x-4">
            <Button variant="outline" onClick={() => router.back()}>
              Retour
            </Button>
            <Button asChild>
              <Link href="/feed">Voir tous les articles</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const article = state.article
  const imageUrl = article.image_url || getDefaultImage(article.category)

  return (
    <div className="min-h-screen bg-white">
      {/* Header de l'article */}
      <div className="bg-gray-50 border-b">
        <div className="container mx-auto px-4 py-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/feed">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au feed
            </Link>
          </Button>

          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Badge className={getCategoryColor(article.category)}>
                  {article.category}
                </Badge>
                {article.is_featured && (
                  <Badge className="bg-yellow-500 text-white">Featured</Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {article.difficulty_level}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLike} 
                  className={state.isLiked ? "text-red-500" : ""}
                  disabled={!user}
                >
                  <Heart className={`h-4 w-4 mr-1 ${state.isLiked ? "fill-current" : ""}`} />
                  {article.like_count}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSave} 
                  className={state.isSaved ? "text-blue-500" : ""}
                  disabled={!user}
                >
                  <Bookmark className={`h-4 w-4 ${state.isSaved ? "fill-current" : ""}`} />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <h1 className="text-4xl font-bold mb-4">{article.title}</h1>
            <p className="text-xl text-gray-600 mb-6">{article.excerpt}</p>

            <div className="flex items-center space-x-6 text-sm text-gray-500 mb-4">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-1" />
                {article.author}
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {formatDate(article.created_at)}
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {article.duration} min de lecture
              </div>
              <div className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                {article.view_count} vues
              </div>
            </div>

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image de couverture */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative h-96 w-full mb-8">
            <Image
              src={imageUrl}
              alt={article.title}
              fill
              className="object-cover rounded-lg"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              priority
            />
          </div>

          {/* Contenu de l'article */}
          <div className="prose prose-lg max-w-none mb-8">
            <div className="whitespace-pre-wrap leading-relaxed text-gray-700">
              {article.content}
            </div>
          </div>

          {/* Actions en bas d'article */}
          <div className="flex items-center justify-center space-x-4 py-8 border-t border-b my-8">
            <Button 
              variant={state.isLiked ? "default" : "outline"} 
              onClick={handleLike}
              disabled={!user}
            >
              <Heart className={`h-4 w-4 mr-2 ${state.isLiked ? "fill-current" : ""}`} />
              {state.isLiked ? "Aimé" : "Aimer"} ({article.like_count})
            </Button>
            <Button 
              variant={state.isSaved ? "default" : "outline"} 
              onClick={handleSave}
              disabled={!user}
            >
              <Bookmark className={`h-4 w-4 mr-2 ${state.isSaved ? "fill-current" : ""}`} />
              {state.isSaved ? "Sauvegardé" : "Sauvegarder"}
            </Button>
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Partager
            </Button>
          </div>

          {!user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <p className="text-blue-800 text-center">
                <Link href="/login" className="font-semibold hover:underline">
                  Connectez-vous
                </Link> pour aimer et sauvegarder cet article
              </p>
            </div>
          )}

          {/* Articles similaires */}
          {state.relatedArticles.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Articles similaires</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {state.relatedArticles.map((relatedArticle) => (
                  <ArticleCard 
                    key={relatedArticle.id} 
                    article={relatedArticle} 
                    showActions={false} 
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
