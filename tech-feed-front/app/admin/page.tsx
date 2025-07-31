"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminAPI, type Content, type User } from "@/lib/api"
import { 
  Users, 
  FileText, 
  Eye, 
  Heart, 
  Loader2, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  TrendingUp, 
  BarChart3,
  Settings,
  Trash2,
  Edit3,
  ToggleLeft,
  ToggleRight
} from "lucide-react"
import { formatDistance } from "date-fns"
import { fr } from "date-fns/locale"

interface AdminStats {
  users: { total: number; active: number; admins: number }
  contents: { total: number; published: number; featured: number }
  interactions: { total: number; likes: number; views: number }
  top_contents: Content[]
  categories: Array<{ name: string; content_count: number; total_views: number }>
}

interface AdminState {
  stats: AdminStats | null
  users: User[]
  contents: Content[]
  loading: boolean
  error: string | null
  userSearch: string
  contentSearch: string
  selectedStatus: string
}

export default function AdminPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const [state, setState] = useState<AdminState>({
    stats: null,
    users: [],
    contents: [],
    loading: true,
    error: null,
    userSearch: '',
    contentSearch: '',
    selectedStatus: 'all'
  })

  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    if (!isLoading && (!user || !user.is_admin)) {
      router.push("/")
    } else if (user?.is_admin) {
      loadAdminData()
    }
  }, [user, isLoading, router])

  const loadAdminData = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const statsResponse = await adminAPI.getStats()
      
      if (!statsResponse.success || !statsResponse.data) {
        throw new Error(statsResponse.error || 'Erreur lors du chargement des statistiques')
      }

      setState(prev => ({
        ...prev,
        stats: statsResponse.data!,
        loading: false,
        error: null
      }))

    } catch (error) {
      console.error('Erreur lors du chargement des données admin:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }))
    }
  }

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getUsers({
        search: state.userSearch || undefined,
        per_page: 50
      })
      
      if (response.success && response.data) {
        setState(prev => ({ ...prev, users: response.data!.users }))
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error)
    }
  }

  const loadContents = async () => {
    try {
      const response = await adminAPI.getContents({
        search: state.contentSearch || undefined,
        status: state.selectedStatus !== 'all' ? state.selectedStatus as any : undefined,
        per_page: 50
      })
      
      if (response.success && response.data) {
        setState(prev => ({ ...prev, contents: response.data!.contents }))
      }
    } catch (error) {
      console.error('Erreur lors du chargement des contenus:', error)
    }
  }

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      const response = await adminAPI.updateUser(userId, { is_active: !currentStatus })
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          users: prev.users.map(u => 
            u.id === userId ? { ...u, is_active: !currentStatus } : u
          )
        }))
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', error)
    }
  }

  const toggleContentStatus = async (contentId: number, field: 'is_published' | 'is_featured', currentValue: boolean) => {
    try {
      const response = await adminAPI.updateContent(contentId, { [field]: !currentValue })
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          contents: prev.contents.map(c => 
            c.id === contentId ? { ...c, [field]: !currentValue } : c
          )
        }))
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du contenu:', error)
    }
  }

  const deleteContent = async (contentId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) return

    try {
      const response = await adminAPI.deleteContent(contentId)
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          contents: prev.contents.filter(c => c.id !== contentId)
        }))
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
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

  // Load data when tabs change
  useEffect(() => {
    if (activeTab === 'users' && state.users.length === 0) {
      loadUsers()
    } else if (activeTab === 'articles' && state.contents.length === 0) {
      loadContents()
    }
  }, [activeTab])

  // Search effects
  useEffect(() => {
    if (activeTab === 'users') {
      const debounce = setTimeout(() => loadUsers(), 500)
      return () => clearTimeout(debounce)
    }
  }, [state.userSearch])

  useEffect(() => {
    if (activeTab === 'articles') {
      const debounce = setTimeout(() => loadContents(), 500)
      return () => clearTimeout(debounce)
    }
  }, [state.contentSearch, state.selectedStatus])

  if (isLoading || state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement du panel d'administration...</p>
        </div>
      </div>
    )
  }

  if (!user || !user.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Accès non autorisé</h3>
          <p className="text-gray-600 mb-4">Vous devez être administrateur pour accéder à cette page.</p>
          <Button onClick={() => router.push('/feed')}>
            Retour au feed
          </Button>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erreur</h3>
          <p className="text-gray-600 mb-4">{state.error}</p>
          <Button onClick={loadAdminData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  const stats = state.stats!

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Panel d'administration</h1>
              <p className="text-gray-600">Gérez votre plateforme TechFeed</p>
            </div>
            <Button variant="outline" onClick={loadAdminData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dashboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="articles">
                <FileText className="h-4 w-4 mr-2" />
                Articles
              </TabsTrigger>
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                Utilisateurs
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <TrendingUp className="h-4 w-4 mr-2" />
                Analytiques
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              {/* Statistiques générales */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.contents.total}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.contents.published} publiés • {stats.contents.featured} en vedette
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.users.total}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.users.active} actifs • {stats.users.admins} admins
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Vues totales</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.interactions.views.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.interactions.total} interactions total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Likes totaux</CardTitle>
                    <Heart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.interactions.likes.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Engagement élevé
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Top contenus */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Articles les plus populaires</CardTitle>
                    <CardDescription>Classés par nombre de vues</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.top_contents.slice(0, 5).map((content, index) => (
                        <div key={content.id} className="flex items-center space-x-4">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm line-clamp-1">{content.title}</p>
                            <p className="text-xs text-gray-500">
                              {content.view_count} vues • {content.like_count} likes
                            </p>
                          </div>
                          <Badge variant="secondary">{content.category}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Statistiques par catégorie</CardTitle>
                    <CardDescription>Répartition des articles par domaine</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.categories.map((category) => {
                        const totalContents = stats.contents.total
                        const percentage = totalContents > 0 
                          ? Math.round((category.content_count / totalContents) * 100) 
                          : 0
                        
                        return (
                          <div key={category.name} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{category.name}</span>
                              <span>
                                {category.content_count} articles ({percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="articles">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Gestion des articles</CardTitle>
                      <CardDescription>Gérez tous les articles de la plateforme</CardDescription>
                    </div>
                    <Button>
                      Ajouter un article
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input
                          placeholder="Rechercher des articles..."
                          value={state.contentSearch}
                          onChange={(e) => setState(prev => ({ ...prev, contentSearch: e.target.value }))}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={state.selectedStatus} onValueChange={(value) => setState(prev => ({ ...prev, selectedStatus: value }))}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les articles</SelectItem>
                        <SelectItem value="published">Publiés</SelectItem>
                        <SelectItem value="draft">Brouillons</SelectItem>
                        <SelectItem value="featured">En vedette</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {state.contents.map((content) => (
                      <div key={content.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{content.title}</h3>
                            <Badge variant="secondary">{content.category}</Badge>
                            {content.is_featured && (
                              <Badge className="bg-yellow-500 text-white">Featured</Badge>
                            )}
                            {!content.is_published && (
                              <Badge variant="outline">Brouillon</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            Par {content.author} • {formatDate(content.created_at)} • 
                            {content.view_count} vues • {content.like_count} likes
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleContentStatus(content.id, 'is_published', content.is_published)}
                          >
                            {content.is_published ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleContentStatus(content.id, 'is_featured', content.is_featured)}
                          >
                            ⭐
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => deleteContent(content.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des utilisateurs</CardTitle>
                  <CardDescription>Gérez tous les utilisateurs de la plateforme</CardDescription>
                  
                  <div className="mt-4">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Rechercher des utilisateurs..."
                        value={state.userSearch}
                        onChange={(e) => setState(prev => ({ ...prev, userSearch: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {state.users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          {user.avatar ? (
                            <img 
                              src={user.avatar} 
                              alt={user.name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                              <Users className="h-5 w-5 text-gray-600" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium">{user.name}</h3>
                              {user.is_admin && (
                                <Badge className="bg-purple-500 text-white">Admin</Badge>
                              )}
                              {!user.is_active && (
                                <Badge variant="outline">Inactif</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {user.email} • Membre depuis {formatDate(user.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                          >
                            {user.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <div className="text-center py-12">
                <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-500 mb-2">
                  Analytiques avancées
                </h3>
                <p className="text-gray-400 mb-4">
                  Fonctionnalité en cours de développement
                </p>
                <p className="text-sm text-gray-500">
                  Bientôt disponible : graphiques, tendances, métriques d'engagement...
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
