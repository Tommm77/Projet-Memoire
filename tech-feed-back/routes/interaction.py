from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.interaction import Interaction
from models.content import Content
from models.user import User
from database import db
from kafka_producer import track_user_interaction

interaction_bp = Blueprint('interaction', __name__)

@interaction_bp.route('/', methods=['POST'])
@jwt_required()
def create_interaction():
    """Crée ou met à jour une interaction utilisateur-contenu"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        content_id = data.get('content_id')
        interaction_type = data.get('interaction_type')
        rating = data.get('rating')
        duration = data.get('duration')
        
        # Validation
        if not content_id or not interaction_type:
            return {'error': 'content_id et interaction_type requis'}, 400
        
        if interaction_type not in Interaction.VALID_TYPES:
            return {'error': f'Type d\'interaction invalide. Types valides: {", ".join(Interaction.VALID_TYPES)}'}, 400
        
        # Vérifier que le contenu existe
        content = Content.query.get(content_id)
        if not content or not content.is_published:
            return {'error': 'Contenu non trouvé'}, 404
        
        # Validation du rating si fourni
        if rating is not None and (rating < 1 or rating > 5):
            return {'error': 'Le rating doit être entre 1 et 5'}, 400
        
        # Créer ou mettre à jour l'interaction
        interaction = Interaction.create_or_update(
            user_id=current_user_id,
            content_id=content_id,
            interaction_type=interaction_type,
            rating=rating,
            duration=duration
        )
        
        # Mettre à jour les compteurs du contenu
        if interaction_type == 'like':
            content.increment_like_count()
        elif interaction_type == 'view':
            content.increment_view_count()
        
        return {
            'success': True,
            'message': 'Interaction enregistrée',
            'interaction': interaction.to_dict()
        }, 201
        
    except ValueError as e:
        return {'error': str(e)}, 400
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@interaction_bp.route('/<int:interaction_id>', methods=['DELETE'])
@jwt_required()
def delete_interaction(interaction_id):
    """Supprime une interaction"""
    try:
        current_user_id = get_jwt_identity()
        
        interaction = Interaction.query.get(interaction_id)
        if not interaction:
            return {'error': 'Interaction non trouvée'}, 404
        
        # Vérifier que l'utilisateur est propriétaire de l'interaction
        if interaction.user_id != current_user_id:
            return {'error': 'Accès non autorisé'}, 403
        
        content_id = interaction.content_id
        interaction_type = interaction.interaction_type
        
        # Supprimer l'interaction
        db.session.delete(interaction)
        
        # Mettre à jour les compteurs du contenu
        content = Content.query.get(content_id)
        if content:
            if interaction_type == 'like':
                content.decrement_like_count()
        
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Interaction supprimée'
        }, 200
        
    except Exception as e:
        db.session.rollback()
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@interaction_bp.route('/toggle', methods=['POST'])
@jwt_required()
def toggle_interaction():
    """Toggle une interaction (like/dislike/favorite)"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        content_id = data.get('content_id')
        interaction_type = data.get('interaction_type')
        
        if not content_id or not interaction_type:
            return {'error': 'content_id et interaction_type requis'}, 400
        
        # Vérifier que le contenu existe
        content = Content.query.get(content_id)
        if not content or not content.is_published:
            return {'error': 'Contenu non trouvé'}, 404
        
        # Vérifier si l'interaction existe déjà
        existing = Interaction.get_user_content_interaction(
            user_id=current_user_id,
            content_id=content_id,
            interaction_type=interaction_type
        )
        
        if existing:
            # Supprimer l'interaction existante
            db.session.delete(existing)
            if interaction_type == 'like':
                content.decrement_like_count()
            action = 'removed'
        else:
            # Créer une nouvelle interaction
            interaction = Interaction(
                user_id=current_user_id,
                content_id=content_id,
                interaction_type=interaction_type
            )
            db.session.add(interaction)
            if interaction_type == 'like':
                content.increment_like_count()
            action = 'added'
        
        db.session.commit()
        
        # Tracker l'interaction dans Kafka (seulement si ajoutée)
        if action == 'added':
            try:
                track_user_interaction(
                    user_id=current_user_id,
                    content_id=content_id,
                    interaction_type=interaction_type
                )
            except Exception as e:
                print(f"Erreur tracking Kafka interaction: {e}")
        
        return {
            'success': True,
            'action': action,
            'interaction_type': interaction_type,
            'content_id': content_id
        }, 200
        
    except Exception as e:
        db.session.rollback()
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@interaction_bp.route('/user/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_interactions(user_id):
    """Récupère les interactions d'un utilisateur"""
    try:
        current_user_id = get_jwt_identity()
        
        # Seul l'utilisateur lui-même ou un admin peut voir ses interactions
        current_user = User.query.get(current_user_id)
        if current_user_id != user_id and not (current_user and current_user.is_admin):
            return {'error': 'Accès non autorisé'}, 403
        
        interaction_type = request.args.get('type')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        per_page = min(per_page, 100)
        
        # Construction de la requête
        query = Interaction.query.filter_by(user_id=user_id)
        
        if interaction_type:
            query = query.filter_by(interaction_type=interaction_type)
        
        query = query.order_by(Interaction.created_at.desc())
        
        # Pagination
        interactions = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Enrichir avec les informations de contenu
        result_interactions = []
        for interaction in interactions.items:
            interaction_data = interaction.to_dict()
            content = Content.query.get(interaction.content_id)
            if content:
                interaction_data['content'] = content.to_dict()
            result_interactions.append(interaction_data)
        
        return {
            'success': True,
            'interactions': result_interactions,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': interactions.total,
                'pages': interactions.pages,
                'has_next': interactions.has_next,
                'has_prev': interactions.has_prev
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@interaction_bp.route('/content/<int:content_id>', methods=['GET'])
def get_content_interactions(content_id):
    """Récupère les interactions sur un contenu (publiques)"""
    try:
        content = Content.query.get(content_id)
        if not content or not content.is_published:
            return {'error': 'Contenu non trouvé'}, 404
        
        interaction_type = request.args.get('type')
        limit = request.args.get('limit', 10, type=int)
        limit = min(limit, 100)
        
        # Statistiques des interactions
        stats = {}
        for int_type in Interaction.VALID_TYPES:
            count = Interaction.query.filter_by(
                content_id=content_id,
                interaction_type=int_type
            ).count()
            stats[int_type] = count
        
        # Interactions récentes (sans données utilisateur sensibles)
        query = Interaction.query.filter_by(content_id=content_id)
        if interaction_type:
            query = query.filter_by(interaction_type=interaction_type)
        
        recent_interactions = query.order_by(
            Interaction.created_at.desc()
        ).limit(limit).all()
        
        interactions_data = []
        for interaction in recent_interactions:
            data = interaction.to_dict()
            # Enlever les données sensibles
            data.pop('user_id', None)
            interactions_data.append(data)
        
        return {
            'success': True,
            'content_id': content_id,
            'stats': stats,
            'recent_interactions': interactions_data
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@interaction_bp.route('/user/liked', methods=['GET'])
@jwt_required()
def get_user_liked_contents():
    """Récupère les contenus aimés par l'utilisateur"""
    try:
        current_user_id = get_jwt_identity()
        
        # Récupérer les interactions "like"
        liked_interactions = Interaction.query.filter_by(
            user_id=current_user_id,
            interaction_type='like'
        ).order_by(Interaction.created_at.desc()).all()
        
        # Récupérer les contenus correspondants
        content_ids = [interaction.content_id for interaction in liked_interactions]
        
        contents = Content.query.filter(
            Content.id.in_(content_ids),
            Content.is_published == True
        ).all() if content_ids else []
        
        return {
            'success': True,
            'liked_contents': [content.to_dict() for content in contents]
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@interaction_bp.route('/user/bookmarks', methods=['GET'])
@jwt_required()
def get_user_bookmarks():
    """Récupère les contenus mis en favoris par l'utilisateur"""
    try:
        current_user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        per_page = min(per_page, 100)
        
        # Récupérer les interactions "bookmark" ou "favorite"
        bookmarked_interactions = Interaction.query.filter_by(
            user_id=current_user_id
        ).filter(
            Interaction.interaction_type.in_(['bookmark', 'favorite'])
        ).order_by(Interaction.created_at.desc()).all()
        
        # Récupérer les contenus correspondants
        content_ids = [interaction.content_id for interaction in bookmarked_interactions]
        
        if not content_ids:
            return {
                'success': True,
                'bookmarked_contents': [],
                'pagination': {
                    'page': 1,
                    'per_page': per_page,
                    'total': 0,
                    'pages': 0,
                    'has_next': False,
                    'has_prev': False
                }
            }, 200
        
        query = Content.query.filter(
            Content.id.in_(content_ids),
            Content.is_published == True
        )
        
        # Pagination
        contents = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return {
            'success': True,
            'bookmarked_contents': [content.to_dict() for content in contents.items],
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

@interaction_bp.route('/user/history', methods=['GET'])
@jwt_required()
def get_user_reading_history():
    """Récupère l'historique de lecture de l'utilisateur"""
    try:
        current_user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        per_page = min(per_page, 100)
        
        # Récupérer les interactions "view"
        view_interactions = Interaction.query.filter_by(
            user_id=current_user_id,
            interaction_type='view'
        ).order_by(Interaction.created_at.desc())
        
        # Pagination
        paginated_interactions = view_interactions.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Enrichir avec les informations de contenu
        history_items = []
        for interaction in paginated_interactions.items:
            content = Content.query.get(interaction.content_id)
            if content and content.is_published:
                item = {
                    'interaction': interaction.to_dict(),
                    'content': content.to_dict()
                }
                history_items.append(item)
        
        return {
            'success': True,
            'reading_history': history_items,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': paginated_interactions.total,
                'pages': paginated_interactions.pages,
                'has_next': paginated_interactions.has_next,
                'has_prev': paginated_interactions.has_prev
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@interaction_bp.route('/content/<int:content_id>/user-status', methods=['GET'])
@jwt_required()
def get_user_content_status(content_id):
    """Récupère le statut d'interaction de l'utilisateur avec un contenu"""
    try:
        current_user_id = get_jwt_identity()
        
        content = Content.query.get(content_id)
        if not content or not content.is_published:
            return {'error': 'Contenu non trouvé'}, 404
        
        # Récupérer toutes les interactions de l'utilisateur pour ce contenu
        interactions = Interaction.query.filter_by(
            user_id=current_user_id,
            content_id=content_id
        ).all()
        
        status = {
            'liked': False,
            'bookmarked': False,
            'viewed': False,
            'rating': None,
            'view_duration': None
        }
        
        for interaction in interactions:
            if interaction.interaction_type == 'like':
                status['liked'] = True
            elif interaction.interaction_type in ['bookmark', 'favorite']:
                status['bookmarked'] = True
            elif interaction.interaction_type == 'view':
                status['viewed'] = True
                if interaction.duration:
                    status['view_duration'] = interaction.duration
            
            if interaction.rating:
                status['rating'] = interaction.rating
        
        return {
            'success': True,
            'content_id': content_id,
            'status': status
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500 