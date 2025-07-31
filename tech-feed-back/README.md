# TechFeed Backend API

Backend Flask pour la plateforme de recommandation TechFeed.

## 🚀 Installation et Configuration

### 1. Installation des dépendances

```bash
cd tech-feed-back
pip install -r requirements.txt
```

### 2. Configuration

Le backend utilise SQLite par défaut pour la simplicité. La configuration se trouve dans `config.py`.

### 3. Lancement du serveur

```bash
python app.py
```

Le serveur démarre sur `http://localhost:5000`

## 📚 API Endpoints

### Authentification (`/api/auth`)

- `POST /api/auth/login` - Connexion utilisateur
- `POST /api/auth/signup` - Inscription utilisateur  
- `GET /api/auth/profile` - Profil utilisateur
- `PUT /api/auth/profile` - Mise à jour profil
- `POST /api/auth/refresh` - Renouvellement token
- `POST /api/auth/logout` - Déconnexion

### Contenus (`/api/content`)

- `GET /api/content/` - Liste des contenus (avec filtres)
- `GET /api/content/{id}` - Contenu spécifique
- `GET /api/content/featured` - Contenus mis en avant
- `GET /api/content/popular` - Contenus populaires
- `GET /api/content/trending` - Contenus trending
- `GET /api/content/categories` - Liste des catégories
- `GET /api/content/search` - Recherche de contenus

### Interactions (`/api/interaction`)

- `POST /api/interaction/toggle` - Toggle like/favori
- `GET /api/interaction/user/liked` - Contenus aimés
- `GET /api/interaction/user/bookmarks` - Contenus favoris
- `GET /api/interaction/user/history` - Historique de lecture

### Recommandations (`/api/recommendation`)

- `GET /api/recommendation/for-you` - Recommandations personnalisées
- `GET /api/recommendation/similar/{id}` - Contenus similaires
- `GET /api/recommendation/trending` - Recommandations trending
- `GET /api/recommendation/popular` - Recommandations populaires
- `POST /api/recommendation/refresh` - Rafraîchir recommandations

### Administration (`/api/admin`)

- `GET /api/admin/stats` - Statistiques globales
- `GET /api/admin/users` - Gestion utilisateurs
- `GET /api/admin/contents` - Gestion contenus
- `POST /api/admin/contents` - Créer contenu
- `PUT /api/admin/contents/{id}` - Modifier contenu

## 🔐 Authentification

L'API utilise JWT (JSON Web Tokens) pour l'authentification. Inclure le token dans l'en-tête:

```
Authorization: Bearer <your-jwt-token>
```

## 👥 Comptes de test

Le backend crée automatiquement des comptes de test :

**Administrateur:**
- Email: `admin@example.com`
- Mot de passe: `admin`

**Utilisateur demo:**
- Email: `user@example.com`  
- Mot de passe: `password`

## 🤖 Système de Recommandations

Le backend implémente un système de recommandations hybride:

### 1. Content-Based Filtering
- Analyse des préférences utilisateur (catégories, tags)
- Correspondance avec les caractéristiques des contenus
- Score basé sur la similarité des tags/catégories

### 2. Engagement Metrics
- Score d'engagement basé sur les interactions (vues, likes)
- Pondération temporelle (contenu récent privilégié)
- Facteur de popularité globale

### 3. Collaborative Filtering (optionnel)
- Analyse des utilisateurs similaires
- Recommandations basées sur les goûts d'utilisateurs ayant des préférences similaires

### 4. Diversification
- Évite la sur-représentation d'une seule catégorie
- Équilibre entre pertinence et découverte

## 📊 Types d'Interactions

- `view` - Vue d'un contenu (poids: 1.0)
- `like` - J'aime (poids: 3.0)
- `favorite`/`bookmark` - Favori (poids: 2.5-3.0)
- `share` - Partage (poids: 4.0)
- `dislike` - N'aime pas (poids: -2.0)

## 🗄️ Base de Données

### Modèles principaux:

**User** - Utilisateurs
- Profil, préférences, authentification
- Relations avec interactions

**Content** - Contenus/Articles  
- Métadonnées, tags, catégories
- Compteurs d'engagement

**Interaction** - Interactions Utilisateur-Contenu
- Types d'interaction, timestamps
- Données pour le système de recommandations

## 🔧 Développement

### Structure du projet:
```
tech-feed-back/
├── app.py                 # Application principale
├── config.py              # Configuration
├── requirements.txt       # Dépendances
├── models/               # Modèles de données
│   ├── user.py
│   ├── content.py
│   └── interaction.py
├── routes/               # Routes API
│   ├── auth.py
│   ├── content.py
│   ├── interaction.py
│   ├── recommendation.py
│   └── admin.py
└── recommendations/      # Moteur de recommandations
    └── engine.py
```

### Ajout de nouvelles fonctionnalités:

1. **Nouveau endpoint** : Créer dans le blueprint approprié
2. **Nouveau modèle** : Ajouter dans `models/`
3. **Nouvelle logique métier** : Étendre `recommendations/engine.py`

## 🚀 Production

Pour le déploiement en production:

1. Changer la configuration dans `config.py`
2. Utiliser PostgreSQL au lieu de SQLite
3. Configurer les variables d'environnement
4. Utiliser un serveur WSGI (Gunicorn)
5. Mettre en place la surveillance et les logs 