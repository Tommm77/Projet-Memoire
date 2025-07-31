"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { ArticleCard } from "@/components/article-card"
import { interactionAPI, type Content } from "@/lib/api"
import { User, Heart, Bookmark, Settings, Loader2, History, ExternalLink } from "lucide-react"

// Catégories disponibles
const categories = ['IA', 'DevOps', 'Cyber', 'Mobile', 'Frontend', 'Backend']

export default function ProfilePage() {
  const { user, isLoading, logout, updateProfile } = useAuth()
  const router = useRouter()
  const [preferences, setPreferences] = useState<string[]>([])
  const [name, setName] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState("")
  const [likedArticles, setLikedArticles] = useState<Content[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    } else if (user) {
      setPreferences(user.preferences)
      setName(user.name || "")
      loadUserData()
    }
  }, [user, isLoading, router])

  const loadUserData = async () => {
    try {
      const likedResponse = await interactionAPI.getLikedContents()
      if (likedResponse.success && likedResponse.data) {
        setLikedArticles(likedResponse.data.contents.slice(0, 4)) // Limiter à 4 pour l'aperçu
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateur:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const handlePreferenceChange = (category: string, checked: boolean) => {
    if (checked) {
      setPreferences([...preferences, category])
    } else {
      setPreferences(preferences.filter((p) => p !== category))
    }
  }

  const handleSavePreferences = async () => {
    setIsUpdating(true)
    setUpdateMessage("")
    
    try {
      const result = await updateProfile({ preferences })
      if (result.success) {
        setUpdateMessage("Préférences sauvegardées avec succès !")
        setTimeout(() => setUpdateMessage(""), 3000)
      } else {
        setUpdateMessage(result.error || "Erreur lors de la sauvegarde")
      }
    } catch (error) {
      setUpdateMessage("Une erreur inattendue s'est produite")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveProfile = async () => {
    setIsUpdating(true)
    setUpdateMessage("")
    
    try {
      const result = await updateProfile({ name: name.trim() })
      if (result.success) {
        setUpdateMessage("Profil mis à jour avec succès !")
        setTimeout(() => setUpdateMessage(""), 3000)
      } else {
        setUpdateMessage(result.error || "Erreur lors de la mise à jour")
      }
    } catch (error) {
      setUpdateMessage("Une erreur inattendue s'est produite")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.name || user.email}
                  className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              )}
              <div>
                <h1 className="text-3xl font-bold">{user.name || "Mon Profil"}</h1>
                <p className="text-gray-600">{user.email}</p>
                {user.created_at && (
                  <p className="text-sm text-gray-500">
                    Membre depuis {new Date(user.created_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Se déconnecter
            </Button>
          </div>

          {updateMessage && (
            <div className={`mb-6 p-4 rounded-lg ${updateMessage.includes('succès') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {updateMessage}
            </div>
          )}

          <Tabs defaultValue="settings" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </TabsTrigger>
              <TabsTrigger value="liked">
                <Heart className="h-4 w-4 mr-2" />
                Articles aimés
              </TabsTrigger>
              <TabsTrigger value="saved">
                <Bookmark className="h-4 w-4 mr-2" />
                Sauvegardés
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                Historique
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Informations du compte</CardTitle>
                    <CardDescription>Gérez vos informations personnelles</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom complet</Label>
                      <Input 
                        id="name" 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Votre nom complet"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={user.email} disabled />
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        onClick={handleSaveProfile}
                        disabled={isUpdating || name.trim() === (user.name || "")}
                        className="flex-1"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Sauvegarder le profil
                      </Button>
                      <Button variant="outline" className="flex-1">
                      Changer le mot de passe
                    </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Centres d'intérêt</CardTitle>
                    <CardDescription>Personnalisez vos recommandations d'articles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {categories.map((category) => (
                        <div key={category} className="flex items-center space-x-2">
                          <Checkbox
                            id={category}
                            checked={preferences.includes(category)}
                            onCheckedChange={(checked) => handlePreferenceChange(category, checked as boolean)}
                          />
                          <Label htmlFor={category} className="text-sm">
                            {category}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={handleSavePreferences} 
                      disabled={isUpdating}
                      className="w-full"
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Sauvegarder les préférences
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="liked">
              <Card>
                <CardHeader>
                  <CardTitle>Articles aimés</CardTitle>
                  <CardDescription>Les articles que vous avez aimés</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingData ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : likedArticles.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {likedArticles.map((article) => (
                          <ArticleCard 
                            key={article.id} 
                            article={article} 
                            showActions={false} 
                            isLiked={true}
                          />
                        ))}
                      </div>
                      <div className="text-center pt-4">
                        <Button variant="outline" asChild>
                          <Link href="/profile/history?filter=likes">
                            Voir tous les articles aimés
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Vous n'avez encore aimé aucun article</p>
                      <Button className="mt-4" asChild>
                        <Link href="/feed">Découvrir des articles</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="saved">
              <Card>
                <CardHeader>
                  <CardTitle>Articles sauvegardés</CardTitle>
                  <CardDescription>Vos articles favoris à lire plus tard</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Bookmark className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">Fonctionnalité en cours de développement</p>
                    <Button variant="outline" asChild>
                      <Link href="/profile/history?filter=favorites">
                        Voir l'historique complet
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Historique d'activité</CardTitle>
                  <CardDescription>Aperçu de votre activité récente</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Statistiques rapides */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-500">{likedArticles.length}</div>
                        <div className="text-sm text-gray-600">Articles aimés</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-500">0</div>
                        <div className="text-sm text-gray-600">Favoris</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-500">-</div>
                        <div className="text-sm text-gray-600">Vues</div>
                      </div>
                    </div>
                    
                    {/* Bouton vers l'historique complet */}
                    <div className="text-center">
                      <Button asChild size="lg">
                        <Link href="/profile/history">
                          <History className="h-4 w-4 mr-2" />
                          Voir l'historique complet
                        </Link>
                      </Button>
                      <p className="text-sm text-gray-500 mt-2">
                        Consultez tous vos articles lus, aimés et sauvegardés
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
