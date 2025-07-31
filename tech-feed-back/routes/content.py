from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, jwt_required
from models.content import Content
from models.user import User
from models.interaction import Interaction
from database import db
from kafka_producer import track_user_interaction, track_search, track_new_content

content_bp = Blueprint('content', __name__)

@content_bp.route('/', methods=['GET'])
def get_contents():
    """Récupère la liste des contenus avec pagination et filtres"""
    try:
        # Paramètres de requête
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        category = request.args.get('category')
        search = request.args.get('search')
        sort_by = request.args.get('sort_by', 'recent')  # recent, popular, engagement
        difficulty = request.args.get('difficulty')
        
        # Limiter per_page pour éviter les abus
        per_page = min(per_page, 100)
        
        # Construction de la requête
        query = Content.query.filter_by(is_published=True)
        
        # Filtres
        if category:
            query = query.filter_by(category=category)
        
        if search:
            search_filter = Content.title.contains(search) | Content.excerpt.contains(search)
            query = query.filter(search_filter)
        
        if difficulty:
            query = query.filter_by(difficulty_level=difficulty)
        
        # Tri
        if sort_by == 'popular':
            query = query.order_by(Content.view_count.desc())
        elif sort_by == 'engagement':
            query = query.order_by(Content.like_count.desc())
        elif sort_by == 'featured':
            query = query.order_by(Content.is_featured.desc(), Content.created_at.desc())
        else:  # recent par défaut
            query = query.order_by(Content.created_at.desc())
        
        # Pagination
        contents = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        return {
            'success': True,
            'contents': [content.to_dict() for content in contents.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': contents.total,
                'pages': contents.pages,
                'has_next': contents.has_next,
                'has_prev': contents.has_prev
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/<int:content_id>', methods=['GET'])
def get_content(content_id):
    """Récupère un contenu spécifique"""
    try:
        content = Content.query.get(content_id)
        
        if not content or not content.is_published:
            return {'error': 'Contenu non trouvé'}, 404
        
        # Incrémenter le compteur de vues
        content.increment_view_count()
        
        # Si l'utilisateur est connecté, enregistrer l'interaction de vue
        try:
            from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
            
            if current_user_id:
                Interaction.create_or_update(
                    user_id=current_user_id,
                    content_id=content_id,
                    interaction_type='view'
                )
                
                # Tracker dans Kafka
                try:
                    track_user_interaction(
                        user_id=current_user_id,
                        content_id=content_id,
                        interaction_type='view'
                    )
                except Exception as e:
                    print(f"Erreur tracking Kafka view: {e}")
        except:
            # Pas d'utilisateur connecté, pas de problème
            pass
        
        return {
            'success': True,
            'content': content.to_dict(include_content=True)
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/featured', methods=['GET'])
def get_featured_contents():
    """Récupère les contenus mis en avant"""
    try:
        limit = request.args.get('limit', 10, type=int)
        limit = min(limit, 50)  # Limiter à 50 max
        
        contents = Content.get_featured(limit=limit)
        
        return {
            'success': True,
            'contents': [content.to_dict() for content in contents]
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/popular', methods=['GET'])
def get_popular_contents():
    """Récupère les contenus populaires"""
    try:
        limit = request.args.get('limit', 10, type=int)
        limit = min(limit, 50)
        
        contents = Content.get_popular(limit=limit)
        
        return {
            'success': True,
            'contents': [content.to_dict() for content in contents]
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/recent', methods=['GET'])
def get_recent_contents():
    """Récupère les contenus récents"""
    try:
        limit = request.args.get('limit', 10, type=int)
        limit = min(limit, 50)
        
        contents = Content.get_recent(limit=limit)
        
        return {
            'success': True,
            'contents': [content.to_dict() for content in contents]
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/categories', methods=['GET'])
def get_categories():
    """Récupère la liste des catégories avec le nombre de contenus"""
    try:
        # Récupérer toutes les catégories avec compte
        categories_data = db.session.query(
            Content.category,
            db.func.count(Content.id).label('count')
        ).filter_by(is_published=True).group_by(Content.category).all()
        
        categories = [
            {
                'name': category,
                'count': count
            }
            for category, count in categories_data
        ]
        
        return {
            'success': True,
            'categories': categories
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/category/<category_name>', methods=['GET'])
def get_contents_by_category(category_name):
    """Récupère les contenus d'une catégorie spécifique"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        per_page = min(per_page, 100)
        
        query = Content.query.filter_by(category=category_name, is_published=True)
        query = query.order_by(Content.created_at.desc())
        
        contents = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return {
            'success': True,
            'category': category_name,
            'contents': [content.to_dict() for content in contents.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': contents.total,
                'pages': contents.pages,
                'has_next': contents.has_next,
                'has_prev': contents.has_prev
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/search', methods=['GET'])
def search_contents():
    """Recherche dans les contenus"""
    try:
        query_text = request.args.get('q', '').strip()
        category = request.args.get('category')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        per_page = min(per_page, 100)
        
        if not query_text:
            return {'error': 'Terme de recherche requis'}, 400
        
        # Construction de la requête de recherche
        search_query = Content.query.filter_by(is_published=True)
        
        # Recherche dans le titre et l'extrait
        search_filter = (
            Content.title.contains(query_text) |
            Content.excerpt.contains(query_text) |
            Content.author.contains(query_text)
        )
        search_query = search_query.filter(search_filter)
        
        # Filtre par catégorie si spécifié
        if category:
            search_query = search_query.filter_by(category=category)
        
        # Tri par pertinence (approximative)
        search_query = search_query.order_by(Content.created_at.desc())
        
        # Pagination
        results = search_query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Tracker la recherche dans Kafka
        try:
            from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
            
            track_search(
                query=query_text,
                user_id=current_user_id,
                category=category,
                results_count=results.total
            )
        except Exception as e:
            print(f"Erreur tracking Kafka search: {e}")
        
        return {
            'success': True,
            'query': query_text,
            'category': category,
            'contents': [content.to_dict() for content in results.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': results.total,
                'pages': results.pages,
                'has_next': results.has_next,
                'has_prev': results.has_prev
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/trending', methods=['GET'])
def get_trending_contents():
    """Récupère le contenu trending basé sur les interactions récentes"""
    try:
        days = request.args.get('days', 7, type=int)
        limit = request.args.get('limit', 10, type=int)
        
        # Limiter les paramètres
        days = min(max(days, 1), 30)  # Entre 1 et 30 jours
        limit = min(limit, 50)
        
        trending_contents = Interaction.get_trending_content(limit=limit, days=days)
        
        return {
            'success': True,
            'period_days': days,
            'contents': [content.to_dict() for content in trending_contents]
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/<int:content_id>/related', methods=['GET'])
def get_related_contents(content_id):
    """Récupère les contenus similaires/liés"""
    try:
        content = Content.query.get(content_id)
        
        if not content or not content.is_published:
            return {'error': 'Contenu non trouvé'}, 404
        
        limit = request.args.get('limit', 5, type=int)
        limit = min(limit, 20)
        
        # Recherche de contenus similaires par catégorie et tags
        content_tags = content.get_tags()
        
        query = Content.query.filter(
            Content.id != content_id,
            Content.is_published == True
        )
        
        # Prioriser la même catégorie
        same_category = query.filter_by(category=content.category).limit(limit).all()
        
        # Si pas assez de résultats, rechercher par tags
        if len(same_category) < limit and content_tags:
            remaining = limit - len(same_category)
            # Cette requête est simplifiée - dans une vraie app, on utiliserait une recherche full-text
            tag_based = query.filter(
                Content.category != content.category
            ).order_by(Content.created_at.desc()).limit(remaining).all()
            
            related_contents = same_category + tag_based
        else:
            related_contents = same_category
        
        return {
            'success': True,
            'content_id': content_id,
            'related_contents': [c.to_dict() for c in related_contents[:limit]]
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@content_bp.route('/<int:content_id>/stats', methods=['GET'])
@jwt_required()
def get_content_stats(content_id):
    """Récupère les statistiques d'un contenu (pour les admins)"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_admin:
            return {'error': 'Accès non autorisé'}, 403
        
        content = Content.query.get(content_id)
        
        if not content:
            return {'error': 'Contenu non trouvé'}, 404
        
        # Statistiques d'interactions
        stats = {
            'content_id': content_id,
            'title': content.title,
            'total_views': content.view_count,
            'total_likes': content.like_count,
            'engagement_score': content.get_engagement_score(),
            'interactions_by_type': {}
        }
        
        # Compter les interactions par type
        for interaction_type in Interaction.VALID_TYPES:
            count = Interaction.query.filter_by(
                content_id=content_id,
                interaction_type=interaction_type
            ).count()
            stats['interactions_by_type'][interaction_type] = count
        
        return {
            'success': True,
            'stats': stats
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500 