from models.user import User
from models.content import Content
from models.interaction import Interaction
from datetime import datetime, timedelta
import random
from collections import defaultdict

class RecommendationEngine:
    """Moteur de recommandations pour TechFeed"""
    
    def __init__(self):
        self.interaction_weights = {
            'like': 3.0,
            'favorite': 3.0,
            'bookmark': 2.5,
            'view': 1.0,
            'share': 4.0,
            'dislike': -2.0
        }
    
    def get_personalized_recommendations(self, user_id, limit=10):
        """
        Génère des recommandations personnalisées pour un utilisateur
        Combine content-based filtering et engagement metrics
        """
        user = User.query.get(user_id)
        if not user:
            return []
        
        # Récupérer les préférences utilisateur
        user_preferences = user.get_preferences()
        
        # Récupérer les contenus déjà vus/aimés par l'utilisateur
        viewed_content_ids = set()
        user_interactions = Interaction.query.filter_by(user_id=user_id).all()
        for interaction in user_interactions:
            viewed_content_ids.add(interaction.content_id)
        
        # Analyser les préférences implicites basées sur les interactions récentes
        implicit_preferences = self._get_implicit_preferences(user_id)
        
        # Combiner préférences explicites et implicites
        all_preferences = list(set(user_preferences + implicit_preferences))
        
        # Récupérer tous les contenus disponibles (non vus)
        available_contents = Content.query.filter(
            Content.is_published == True,
            ~Content.id.in_(viewed_content_ids)
        ).all()
        
        if not available_contents:
            # Si pas de nouveaux contenus, récupérer les populaires
            return Content.get_popular(limit=limit)
        
        # Calculer le score pour chaque contenu
        content_scores = []
        for content in available_contents:
            score = self._calculate_content_score(content, all_preferences, user_id)
            content_scores.append((content, score))
        
        # Trier par score décroissant
        content_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Diversifier les résultats (éviter trop de contenus de la même catégorie)
        diversified_contents = self._diversify_recommendations(content_scores, limit)
        
        return [content for content, score in diversified_contents[:limit]]
    
    def get_similar_content_recommendations(self, content_id, limit=5):
        """
        Recommande des contenus similaires à un contenu donné
        """
        base_content = Content.query.get(content_id)
        if not base_content:
            return []
        
        # Récupérer les contenus de la même catégorie
        similar_contents = Content.query.filter(
            Content.id != content_id,
            Content.is_published == True,
            Content.category == base_content.category
        ).all()
        
        # Si pas assez de contenus dans la même catégorie, élargir la recherche
        if len(similar_contents) < limit:
            base_tags = base_content.get_tags()
            if base_tags:
                # Recherche par tags (simulation simple)
                additional_contents = Content.query.filter(
                    Content.id != content_id,
                    Content.is_published == True,
                    Content.category != base_content.category
                ).all()
                
                # Calculer la similarité par tags
                tag_based = []
                for content in additional_contents:
                    content_tags = content.get_tags()
                    common_tags = set(base_tags) & set(content_tags)
                    if common_tags:
                        similarity = len(common_tags) / len(set(base_tags + content_tags))
                        tag_based.append((content, similarity))
                
                tag_based.sort(key=lambda x: x[1], reverse=True)
                similar_contents.extend([content for content, sim in tag_based[:limit-len(similar_contents)]])
        
        # Trier par engagement pour les contenus similaires
        similar_contents.sort(key=lambda x: x.get_engagement_score(), reverse=True)
        
        return similar_contents[:limit]
    
    def get_trending_recommendations(self, days=7, limit=10):
        """
        Récupère les contenus trending basés sur l'engagement récent
        """
        return Interaction.get_trending_content(limit=limit, days=days)
    
    def get_popular_recommendations(self, limit=10, category=None):
        """
        Récupère les contenus populaires
        """
        query = Content.query.filter_by(is_published=True)
        
        if category:
            query = query.filter_by(category=category)
        
        # Tri par score d'engagement plutôt que juste les vues
        contents = query.all()
        contents.sort(key=lambda x: x.get_engagement_score(), reverse=True)
        
        return contents[:limit]
    
    def get_category_recommendations(self, category, limit=10, sort_by='recent'):
        """
        Récupère les recommandations pour une catégorie
        """
        query = Content.query.filter_by(category=category, is_published=True)
        
        if sort_by == 'popular':
            contents = query.all()
            contents.sort(key=lambda x: x.view_count, reverse=True)
        elif sort_by == 'engagement':
            contents = query.all()
            contents.sort(key=lambda x: x.get_engagement_score(), reverse=True)
        else:  # recent
            contents = query.order_by(Content.created_at.desc()).limit(limit).all()
        
        return contents[:limit]
    
    def _get_implicit_preferences(self, user_id, days=30):
        """
        Analyse les interactions récentes pour déduire les préférences
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Récupérer les interactions récentes positives
        recent_interactions = Interaction.query.filter(
            Interaction.user_id == user_id,
            Interaction.created_at >= cutoff_date,
            Interaction.interaction_type.in_(['like', 'favorite', 'bookmark', 'view'])
        ).all()
        
        # Compter les catégories par poids d'interaction
        category_scores = defaultdict(float)
        
        for interaction in recent_interactions:
            content = Content.query.get(interaction.content_id)
            if content:
                weight = self.interaction_weights.get(interaction.interaction_type, 1.0)
                category_scores[content.category] += weight
        
        # Retourner les top catégories
        sorted_categories = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
        return [category for category, score in sorted_categories[:3]]
    
    def _calculate_content_score(self, content, user_preferences, user_id):
        """
        Calcule un score de pertinence pour un contenu donné un utilisateur
        """
        score = 0.0
        
        # 1. Score basé sur les préférences (content-based)
        content_tags = [content.category] + content.get_tags()
        preference_matches = len(set(content_tags) & set(user_preferences))
        preference_score = preference_matches * 2.0
        
        # 2. Score d'engagement global du contenu
        engagement_score = content.get_engagement_score() * 0.1
        
        # 3. Bonus pour les contenus récents
        days_old = (datetime.utcnow() - content.created_at).days
        recency_bonus = max(0, 1 - (days_old / 30)) * 0.5  # Bonus dégressif sur 30 jours
        
        # 4. Bonus pour la difficulté appropriée (basé sur l'historique)
        difficulty_bonus = self._calculate_difficulty_bonus(content, user_id)
        
        # 5. Bonus pour les contenus featured
        featured_bonus = 0.5 if content.is_featured else 0
        
        # Score final
        score = preference_score + engagement_score + recency_bonus + difficulty_bonus + featured_bonus
        
        # Ajouter un peu de randomness pour éviter la stagnation
        score += random.uniform(-0.1, 0.1)
        
        return score
    
    def _calculate_difficulty_bonus(self, content, user_id):
        """
        Calcule un bonus basé sur l'adéquation du niveau de difficulté
        """
        if not content.difficulty_level:
            return 0
        
        # Analyser l'historique de l'utilisateur pour déterminer son niveau préféré
        user_interactions = Interaction.query.filter_by(
            user_id=user_id,
            interaction_type='like'
        ).limit(20).all()
        
        difficulty_counts = defaultdict(int)
        for interaction in user_interactions:
            interacted_content = Content.query.get(interaction.content_id)
            if interacted_content and interacted_content.difficulty_level:
                difficulty_counts[interacted_content.difficulty_level] += 1
        
        # Si l'utilisateur a une préférence claire, donner un bonus
        if difficulty_counts:
            preferred_difficulty = max(difficulty_counts.items(), key=lambda x: x[1])[0]
            if content.difficulty_level == preferred_difficulty:
                return 0.3
        
        return 0
    
    def _diversify_recommendations(self, content_scores, limit):
        """
        Diversifie les recommandations pour éviter trop de contenus similaires
        """
        if len(content_scores) <= limit:
            return content_scores
        
        diversified = []
        category_counts = defaultdict(int)
        max_per_category = max(1, limit // 3)  # Maximum 1/3 des résultats par catégorie
        
        # Première passe : sélectionner en respectant la diversité
        for content, score in content_scores:
            if len(diversified) >= limit:
                break
            
            if category_counts[content.category] < max_per_category:
                diversified.append((content, score))
                category_counts[content.category] += 1
        
        # Deuxième passe : remplir les places restantes avec les meilleurs scores
        if len(diversified) < limit:
            remaining = [cs for cs in content_scores if cs not in diversified]
            diversified.extend(remaining[:limit - len(diversified)])
        
        return diversified
    
    def get_user_similarity(self, user_id1, user_id2):
        """
        Calcule la similarité entre deux utilisateurs (pour le filtrage collaboratif)
        """
        user1_interactions = set()
        user2_interactions = set()
        
        # Récupérer les contenus aimés par chaque utilisateur
        for interaction in Interaction.query.filter_by(user_id=user_id1, interaction_type='like').all():
            user1_interactions.add(interaction.content_id)
        
        for interaction in Interaction.query.filter_by(user_id=user_id2, interaction_type='like').all():
            user2_interactions.add(interaction.content_id)
        
        # Calculer la similarité Jaccard
        if not user1_interactions or not user2_interactions:
            return 0.0
        
        intersection = len(user1_interactions & user2_interactions)
        union = len(user1_interactions | user2_interactions)
        
        return intersection / union if union > 0 else 0.0
    
    def get_collaborative_recommendations(self, user_id, limit=10):
        """
        Recommandations basées sur le filtrage collaboratif (utilisateurs similaires)
        """
        # Trouver les utilisateurs similaires
        all_users = User.query.filter(User.id != user_id).all()
        similar_users = []
        
        for user in all_users:
            similarity = self.get_user_similarity(user_id, user.id)
            if similarity > 0.1:  # Seuil minimum de similarité
                similar_users.append((user, similarity))
        
        # Trier par similarité
        similar_users.sort(key=lambda x: x[1], reverse=True)
        
        # Récupérer les contenus aimés par les utilisateurs similaires
        viewed_content_ids = set()
        user_interactions = Interaction.query.filter_by(user_id=user_id).all()
        for interaction in user_interactions:
            viewed_content_ids.add(interaction.content_id)
        
        recommended_content_ids = defaultdict(float)
        
        for similar_user, similarity in similar_users[:10]:  # Top 10 utilisateurs similaires
            liked_interactions = Interaction.query.filter_by(
                user_id=similar_user.id,
                interaction_type='like'
            ).all()
            
            for interaction in liked_interactions:
                if interaction.content_id not in viewed_content_ids:
                    recommended_content_ids[interaction.content_id] += similarity
        
        # Trier et récupérer les contenus
        sorted_recommendations = sorted(
            recommended_content_ids.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        recommended_contents = []
        for content_id, score in sorted_recommendations[:limit]:
            content = Content.query.get(content_id)
            if content and content.is_published:
                recommended_contents.append(content)
        
        return recommended_contents 