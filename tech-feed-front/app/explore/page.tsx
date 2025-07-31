"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArticleCard } from "@/components/article-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { contentAPI, type Content } from "@/lib/api"
import { 
  Search, 
  Filter, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  TrendingUp, 
  Clock, 
  Star,
  Eye,
  Heart,
  BookOpen,
  User
} from "lucide-react"

interface ExploreState {
  contents: Content[]
  loading: boolean
  error: string | null
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_next: boolean
  }
  categories: Array<{ name: string; count: number }>
  searchTerm: string
  selectedCategory: string
  selectedDifficulty: string
  sortBy: 'recent' | 'popular' | 'engagement' | 'featured'
  showAdvancedFilters: boolean
  selectedTags: string[]
}

// Catégories et niveaux de difficulté disponibles
const CATEGORIES = ['IA', 'DevOps', 'Cyber', 'Mobile', 'Frontend', 'Backend']
const DIFFICULTY_LEVELS = ['Débutant', 'Intermédiaire', 'Avancé', 'Expert']
const SORT_OPTIONS = [
  { value: 'recent', label: 'Plus récent', icon: Clock },
  { value: 'popular', label: 'Populaire', icon: Eye },
  { value: 'engagement', label: 'Engagement', icon: Heart },
  { value: 'featured', label: 'En vedette', icon: Star }
]

export default function ExplorePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [state, setState] = useState<ExploreState>({
    contents: [],
    loading: true,
    error: null,
    pagination: {
      page: 1,
      per_page: 12,
      total: 0,
      pages: 0,
      has_next: false
    },
    categories: [],
    searchTerm: searchParams.get('q') || '',
    selectedCategory: searchParams.get('category') || 'all',
    selectedDifficulty: searchParams.get('difficulty') || 'all',
    sortBy: (searchParams.get('sort') as any) || 'recent',
    showAdvancedFilters: false,
    selectedTags: []
  })

  // Charger les données au montage et lors des changements de filtres
  useEffect(() => {
    loadContents(true) // Reset pagination
  }, [state.searchTerm, state.selectedCategory, state.selectedDifficulty, state.sortBy])

  // Charger les catégories au montage
  useEffect(() => {
    loadCategories()
  }, [])

  const loadContents = async (resetPagination: boolean = false) => {
    const newPage = resetPagination ? 1 : state.pagination.page
    
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      ...(resetPagination && { contents: [] })
    }))

    try {
      const params = {
        page: newPage,
        per_page: state.pagination.per_page,
        search: state.searchTerm || undefined,
        category: state.selectedCategory !== 'all' ? state.selectedCategory : undefined,
        difficulty: state.selectedDifficulty !== 'all' ? state.selectedDifficulty : undefined,
        sort_by: state.sortBy
      }

      const response = await contentAPI.getContents(params)

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erreur lors du chargement des articles')
      }

      const newContents = resetPagination 
        ? response.data.contents 
        : [...state.contents, ...response.data.contents]

      setState(prev => ({
        ...prev,
        contents: newContents,
        pagination: {
          page: newPage,
          per_page: response.data!.pagination.per_page,
          total: response.data!.pagination.total,
          pages: response.data!.pagination.pages,
          has_next: response.data!.pagination.has_next
        },
        loading: false,
        error: null
      }))

      // Mettre à jour l'URL avec les paramètres de recherche
      updateURL()

    } catch (error) {
      console.error('Erreur lors du chargement des contenus:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }))
    }
  }

  const loadCategories = async () => {
    try {
      const response = await contentAPI.getCategories()
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          categories: response.data!.categories
        }))
      }
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error)
    }
  }

  const updateURL = () => {
    const params = new URLSearchParams()
    
    if (state.searchTerm) params.set('q', state.searchTerm)
    if (state.selectedCategory !== 'all') params.set('category', state.selectedCategory)
    if (state.selectedDifficulty !== 'all') params.set('difficulty', state.selectedDifficulty)
    if (state.sortBy !== 'recent') params.set('sort', state.sortBy)

    const queryString = params.toString()
    const newURL = queryString ? `/explore?${queryString}` : '/explore'
    
    if (window.location.pathname + window.location.search !== newURL) {
      router.replace(newURL, { scroll: false })
    }
  }

  const loadMore = () => {
    if (state.pagination.has_next && !state.loading) {
      setState(prev => ({
        ...prev,
        pagination: { ...prev.pagination, page: prev.pagination.page + 1 }
      }))
      loadContents(false)
    }
  }

  const resetFilters = () => {
    setState(prev => ({
      ...prev,
      searchTerm: '',
      selectedCategory: 'all',
      selectedDifficulty: 'all',
      sortBy: 'recent',
      selectedTags: []
    }))
    router.replace('/explore')
  }

  const handleSearch = (term: string) => {
    setState(prev => ({ ...prev, searchTerm: term }))
  }

  const handleCategoryChange = (category: string) => {
    setState(prev => ({ ...prev, selectedCategory: category }))
  }

  const handleDifficultyChange = (difficulty: string) => {
    setState(prev => ({ ...prev, selectedDifficulty: difficulty }))
  }

  const handleSortChange = (sort: typeof state.sortBy) => {
    setState(prev => ({ ...prev, sortBy: sort }))
  }

  // Mémorisation des tags uniques pour les filtres avancés
  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    state.contents.forEach(content => {
      content.tags.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [state.contents])

  const filteredContents = useMemo(() => {
    let filtered = state.contents

    // Filtrer par tags sélectionnés
    if (state.selectedTags.length > 0) {
      filtered = filtered.filter(content =>
        state.selectedTags.some(tag => content.tags.includes(tag))
      )
    }

    return filtered
  }, [state.contents, state.selectedTags])

  const hasActiveFilters = state.searchTerm || 
                          state.selectedCategory !== 'all' || 
                          state.selectedDifficulty !== 'all' || 
                          state.sortBy !== 'recent' ||
                          state.selectedTags.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">Explorer les articles</h1>
            <p className="text-gray-600 mb-6">
              Découvrez tous nos articles tech, filtrez par catégorie et trouvez ce qui vous intéresse
            </p>

            {/* Statistiques rapides */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{state.pagination.total}</p>
                    <p className="text-sm text-gray-600">Articles</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-blue-400" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{state.categories.length}</p>
                    <p className="text-sm text-gray-600">Catégories</p>
                  </div>
                  <Filter className="h-8 w-8 text-green-400" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{availableTags.length}</p>
                    <p className="text-sm text-gray-600">Tags</p>
                  </div>
                  <Star className="h-8 w-8 text-purple-400" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{DIFFICULTY_LEVELS.length}</p>
                    <p className="text-sm text-gray-600">Niveaux</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-400" />
                </div>
              </div>
            </div>

            {/* Barre de recherche principale */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Rechercher des articles, auteurs, tags..."
                value={state.searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-12 pr-4 py-3 text-lg"
              />
              {state.searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={() => handleSearch('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Filtres rapides */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 font-medium">Catégorie:</span>
                <Select value={state.selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 font-medium">Niveau:</span>
                <Select value={state.selectedDifficulty} onValueChange={handleDifficultyChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les niveaux</SelectItem>
                    {DIFFICULTY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 font-medium">Trier par:</span>
                <Select value={state.sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          <option.icon className="h-4 w-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={() => setState(prev => ({ ...prev, showAdvancedFilters: !prev.showAdvancedFilters }))}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtres avancés
              </Button>
            </div>

            {/* Filtres avancés */}
            {state.showAdvancedFilters && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Filtres avancés</CardTitle>
                  <CardDescription>Affinez votre recherche avec des critères spécifiques</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Tags populaires</h4>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.slice(0, 12).map((tag) => (
                          <Badge
                            key={tag}
                            variant={state.selectedTags.includes(tag) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              setState(prev => ({
                                ...prev,
                                selectedTags: prev.selectedTags.includes(tag)
                                  ? prev.selectedTags.filter(t => t !== tag)
                                  : [...prev.selectedTags, tag]
                              }))
                            }}
                          >
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tags de catégories rapides */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Badge
                variant={state.selectedCategory === "all" ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={() => handleCategoryChange("all")}
              >
                Tout
              </Badge>
              {CATEGORIES.map((category) => (
                <Badge
                  key={category}
                  variant={state.selectedCategory === category ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => handleCategoryChange(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>

            {/* Filtres actifs */}
            {hasActiveFilters && (
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-sm text-gray-600">Filtres actifs:</span>
                {state.searchTerm && (
                  <Badge variant="outline" className="cursor-pointer" onClick={() => handleSearch('')}>
                    Recherche: "{state.searchTerm}" <X className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                {state.selectedCategory !== 'all' && (
                  <Badge variant="outline" className="cursor-pointer" onClick={() => handleCategoryChange('all')}>
                    {state.selectedCategory} <X className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                {state.selectedDifficulty !== 'all' && (
                  <Badge variant="outline" className="cursor-pointer" onClick={() => handleDifficultyChange('all')}>
                    {state.selectedDifficulty} <X className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                {state.selectedTags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="outline" 
                    className="cursor-pointer"
                    onClick={() => setState(prev => ({
                      ...prev,
                      selectedTags: prev.selectedTags.filter(t => t !== tag)
                    }))}
                  >
                    #{tag} <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Réinitialiser
                </Button>
              </div>
            )}
          </div>

          {/* Résultats */}
          <div className="mb-6">
            <p className="text-gray-600">
              {filteredContents.length} article{filteredContents.length > 1 ? "s" : ""} trouvé
              {filteredContents.length > 1 ? "s" : ""}
              {state.searchTerm && ` pour "${state.searchTerm}"`}
              {state.selectedCategory !== "all" && ` dans ${state.selectedCategory}`}
            </p>
          </div>

          {/* États de chargement et d'erreur */}
          {state.error && (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Erreur</h3>
              <p className="text-gray-600 mb-4">{state.error}</p>
              <Button onClick={() => loadContents(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Réessayer
              </Button>
            </div>
          )}

          {/* Grille d'articles */}
          {!state.error && (
            <>
              {filteredContents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredContents.map((content) => (
                    <ArticleCard 
                      key={content.id} 
                      article={content} 
                      showActions={true}
                    />
                  ))}
                </div>
              ) : !state.loading ? (
                <div className="text-center py-12">
                  <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-500 mb-2">
                    Aucun article trouvé
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Essayez de modifier vos critères de recherche ou parcourez toutes les catégories
                  </p>
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={resetFilters}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Réinitialiser les filtres
                    </Button>
                  )}
                </div>
              ) : null}

              {/* Bouton Charger plus */}
              {state.pagination.has_next && (
                <div className="mt-12 text-center">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={loadMore}
                    disabled={state.loading}
                  >
                    {state.loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Chargement...
                      </>
                    ) : (
                      'Charger plus d\'articles'
                    )}
                  </Button>
                </div>
              )}

              {/* Loader initial */}
              {state.loading && state.contents.length === 0 && (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span className="text-gray-600">Chargement des articles...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
