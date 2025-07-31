from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.user import User
from models.content import Content
from models.interaction import Interaction
from recommendations.engine import RecommendationEngine

recommendation_bp = Blueprint('recommendation', __name__)

@recommendation_bp.route('/for-you', methods=['GET'])
@jwt_required()
def get_personalized_recommendations():
    """Récupère les recommandations personnalisées pour l'utilisateur"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return {'error': 'Utilisateur non trouvé'}, 404
        
        limit = request.args.get('limit', 10, type=int)
        limit = min(limit, 50)
        
        # Utiliser le moteur de recommandations
        engine = RecommendationEngine()
        recommendations = engine.get_personalized_recommendations(
            user_id=current_user_id,
            limit=limit
        )
        
        return {
            'success': True,
            'user_id': current_user_id,
            'recommendations': [rec.to_dict() for rec in recommendations],
            'algorithm': 'content-based + collaborative'
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@recommendation_bp.route('/similar/<int:content_id>', methods=['GET'])
def get_similar_content_recommendations(content_id):
    """Récupère les recommandations basées sur un contenu spécifique"""
    try:
        content = Content.query.get(content_id)
        if not content or not content.is_published:
            return {'error': 'Contenu non trouvé'}, 404
        
        limit = request.args.get('limit', 5, type=int)
        limit = min(limit, 20)
        
        engine = RecommendationEngine()
        similar_contents = engine.get_similar_content_recommendations(
            content_id=content_id,
            limit=limit
        )
        
        return {
            'success': True,
            'base_content_id': content_id,
            'similar_contents': [content.to_dict() for content in similar_contents],
            'algorithm': 'content-similarity'
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@recommendation_bp.route('/trending', methods=['GET'])
def get_trending_recommendations():
    """Récupère les recommandations trending"""
    try:
        days = request.args.get('days', 7, type=int)
        limit = request.args.get('limit', 10, type=int)
        
        days = min(max(days, 1), 30)
        limit = min(limit, 50)
        
        engine = RecommendationEngine()
        trending_contents = engine.get_trending_recommendations(
            days=days,
            limit=limit
        )
        
        return {
            'success': True,
            'period_days': days,
            'trending_contents': [content.to_dict() for content in trending_contents],
            'algorithm': 'engagement-based'
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@recommendation_bp.route('/popular', methods=['GET'])
def get_popular_recommendations():
    """Récupère les recommandations populaires"""
    try:
        limit = request.args.get('limit', 10, type=int)
        category = request.args.get('category')
        
        limit = min(limit, 50)
        
        engine = RecommendationEngine()
        popular_contents = engine.get_popular_recommendations(
            limit=limit,
            category=category
        )
        
        return {
            'success': True,
            'category': category,
            'popular_contents': [content.to_dict() for content in popular_contents],
            'algorithm': 'popularity-based'
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@recommendation_bp.route('/category/<category_name>', methods=['GET'])
def get_category_recommendations(category_name):
    """Récupère les recommandations pour une catégorie spécifique"""
    try:
        limit = request.args.get('limit', 10, type=int)
        sort_by = request.args.get('sort_by', 'recent')  # recent, popular, engagement
        
        limit = min(limit, 50)
        
        engine = RecommendationEngine()
        category_contents = engine.get_category_recommendations(
            category=category_name,
            limit=limit,
            sort_by=sort_by
        )
        
        return {
            'success': True,
            'category': category_name,
            'sort_by': sort_by,
            'contents': [content.to_dict() for content in category_contents]
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@recommendation_bp.route('/for-user/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_recommendations(user_id):
    """Récupère les recommandations pour un utilisateur spécifique (admin seulement)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        # Seuls les admins peuvent voir les recommandations d'autres utilisateurs
        if not current_user or not current_user.is_admin:
            if current_user_id != user_id:
                return {'error': 'Accès non autorisé'}, 403
        
        target_user = User.query.get(user_id)
        if not target_user:
            return {'error': 'Utilisateur non trouvé'}, 404
        
        limit = request.args.get('limit', 10, type=int)
        limit = min(limit, 50)
        
        engine = RecommendationEngine()
        recommendations = engine.get_personalized_recommendations(
            user_id=user_id,
            limit=limit
        )
        
        return {
            'success': True,
            'target_user_id': user_id,
            'recommendations': [rec.to_dict() for rec in recommendations]
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@recommendation_bp.route('/refresh', methods=['POST'])
@jwt_required()
def refresh_user_recommendations():
    """Force le rafraîchissement des recommandations utilisateur"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return {'error': 'Utilisateur non trouvé'}, 404
        
        engine = RecommendationEngine()
        
        # Analyser les préférences récentes basées sur les interactions
        recent_preferences = Interaction.get_user_preferences_from_interactions(
            user_id=current_user_id,
            limit_days=30
        )
        
        # Mettre à jour les préférences si nécessaire
        if recent_preferences['categories']:
            # Combiner les préférences explicites et implicites
            explicit_prefs = user.get_preferences()
            implicit_prefs = recent_preferences['categories']
            
            # Merge intelligemment (garder les préférences explicites et ajouter les nouvelles implicites)
            updated_prefs = list(set(explicit_prefs + implicit_prefs[:3]))  # Top 3 nouvelles
            
            if updated_prefs != explicit_prefs:
                user.set_preferences(updated_prefs)
                from database import db
                db.session.commit()
        
        # Générer de nouvelles recommandations
        recommendations = engine.get_personalized_recommendations(
            user_id=current_user_id,
            limit=20
        )
        
        return {
            'success': True,
            'message': 'Recommandations rafraîchies',
            'updated_preferences': user.get_preferences(),
            'recommendations': [rec.to_dict() for rec in recommendations],
            'analysis': {
                'recent_categories': recent_preferences['categories'],
                'recent_tags': recent_preferences['tags']
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@recommendation_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_recommendation_stats():
    """Récupère les statistiques du système de recommandations (admin seulement)"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_admin:
            return {'error': 'Accès non autorisé'}, 403
        
        # Statistiques générales
        total_users = User.query.count()
        total_contents = Content.query.filter_by(is_published=True).count()
        total_interactions = Interaction.query.count()
        
        # Interactions par type
        interaction_stats = {}
        for int_type in Interaction.VALID_TYPES:
            count = Interaction.query.filter_by(interaction_type=int_type).count()
            interaction_stats[int_type] = count
        
        # Catégories les plus populaires
        from database import db
        popular_categories = db.session.query(
            Content.category,
            db.func.count(Content.id).label('content_count'),
            db.func.sum(Content.view_count).label('total_views')
        ).filter_by(is_published=True).group_by(Content.category).order_by(
            db.func.sum(Content.view_count).desc()
        ).limit(10).all()
        
        return {
            'success': True,
            'stats': {
                'total_users': total_users,
                'total_contents': total_contents,
                'total_interactions': total_interactions,
                'interactions_by_type': interaction_stats,
                'popular_categories': [
                    {
                        'category': cat,
                        'content_count': count,
                        'total_views': views or 0
                    }
                    for cat, count, views in popular_categories
                ]
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500 