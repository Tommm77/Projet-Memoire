import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArticleCard } from "@/components/article-card"
import { mockArticles } from "@/lib/mock-data"
import { TrendingUp, Sparkles, Users } from "lucide-react"

export default function HomePage() {
  const popularArticles = mockArticles.slice(0, 3)
  const aiArticles = mockArticles.filter((article) => article.category === "IA")
  const recentArticles = mockArticles.slice(0, 4)

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">Explorez l'actualité tech, personnalisée pour vous</h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Découvrez les dernières innovations, tendances et analyses du monde technologique, adaptées à vos centres
            d'intérêt.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="bg-white text-blue-600 hover:bg-gray-100">
              <Link href="/signup">Commencer gratuitement</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-white text-white hover:bg-white hover:text-blue-600 bg-transparent"
            >
              <Link href="/explore">Explorer sans compte</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <TrendingUp className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-2xl font-bold mb-2">500+</h3>
              <p className="text-gray-600">Articles tech quotidiens</p>
            </div>
            <div className="flex flex-col items-center">
              <Sparkles className="h-12 w-12 text-purple-600 mb-4" />
              <h3 className="text-2xl font-bold mb-2">IA</h3>
              <p className="text-gray-600">Recommandations personnalisées</p>
            </div>
            <div className="flex flex-col items-center">
              <Users className="h-12 w-12 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold mb-2">10k+</h3>
              <p className="text-gray-600">Développeurs actifs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">🎯 Articles populaires</h2>
            <Button variant="outline" asChild>
              <Link href="/explore">Voir tout</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularArticles.map((article) => (
              <ArticleCard key={article.id} article={article} showActions={false} />
            ))}
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">🧠 Nouveautés IA</h2>
            <Button variant="outline" asChild>
              <Link href="/explore?category=IA">Voir plus</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {aiArticles.map((article) => (
              <ArticleCard key={article.id} article={article} showActions={false} />
            ))}
          </div>
        </div>
      </section>

      {/* Recent Articles */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">📰 Derniers articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentArticles.map((article) => (
              <ArticleCard key={article.id} article={article} showActions={false} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Prêt à personnaliser votre veille tech ?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Rejoignez des milliers de développeurs qui font confiance à TechFeed pour rester à jour avec les dernières
            innovations.
          </p>
          <Button size="lg" asChild className="bg-white text-purple-600 hover:bg-gray-100">
            <Link href="/signup">Créer mon compte</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
