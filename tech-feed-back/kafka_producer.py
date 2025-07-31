"""
Producteur Kafka pour TechFeed
Envoie les événements depuis l'application Flask vers Kafka
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from kafka import KafkaProducer
from kafka.errors import KafkaError
import uuid

logger = logging.getLogger(__name__)

class TechFeedKafkaProducer:
    """Producteur Kafka pour les événements TechFeed"""
    
    def __init__(self, bootstrap_servers='localhost:9092'):
        """
        Initialise le producteur Kafka
        
        Args:
            bootstrap_servers: Adresses des serveurs Kafka
        """
        self.bootstrap_servers = bootstrap_servers
        self.producer = None
        self._connect()
    
    def _connect(self):
        """Établit la connexion avec Kafka"""
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: str(k).encode('utf-8') if k else None,
                acks='all',  # Attendre la confirmation de tous les réplicas
                retries=3,
                retry_backoff_ms=100,
                max_in_flight_requests_per_connection=1,
                enable_idempotence=True
            )
            logger.info(f"✅ Connecté à Kafka: {self.bootstrap_servers}")
        except Exception as e:
            logger.error(f"❌ Erreur de connexion à Kafka: {e}")
            self.producer = None
    
    def _send_event(self, topic: str, data: Dict[str, Any], key: Optional[str] = None):
        """
        Envoie un événement vers Kafka
        
        Args:
            topic: Topic Kafka
            data: Données à envoyer
            key: Clé optionnelle pour le partitioning
        """
        if not self.producer:
            logger.warning("❌ Producteur Kafka non disponible")
            return False
        
        try:
            # Ajouter des métadonnées communes
            enriched_data = {
                **data,
                'event_id': str(uuid.uuid4()),
                'timestamp': datetime.utcnow().isoformat(),
                'source': 'techfeed-backend'
            }
            
            # Envoyer de manière asynchrone
            future = self.producer.send(topic, value=enriched_data, key=key)
            
            # Optionnel: attendre la confirmation (peut impacter les performances)
            # record_metadata = future.get(timeout=10)
            # logger.debug(f"✅ Message envoyé vers {topic}: partition {record_metadata.partition}, offset {record_metadata.offset}")
            
            return True
            
        except KafkaError as e:
            logger.error(f"❌ Erreur Kafka lors de l'envoi vers {topic}: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'envoi vers {topic}: {e}")
            return False
    
    def send_user_interaction(self, user_id: int, content_id: int, interaction_type: str, 
                            duration: int = None, rating: int = None, session_id: str = None):
        """
        Envoie une interaction utilisateur
        
        Args:
            user_id: ID de l'utilisateur
            content_id: ID du contenu
            interaction_type: Type d'interaction (view, like, dislike, favorite, share)
            duration: Durée en secondes (pour les vues)
            rating: Note (1-5)
            session_id: ID de session
        """
        data = {
            'user_id': user_id,
            'content_id': content_id,
            'interaction_type': interaction_type,
            'duration': duration,
            'rating': rating,
            'session_id': session_id or str(uuid.uuid4())
        }
        
        # Routage vers différents topics selon le type
        if interaction_type == 'view':
            topic = 'content-views'
        elif interaction_type in ['like', 'dislike']:
            topic = 'content-reactions'
        else:
            topic = 'user-interactions'
        
        return self._send_event(topic, data, key=str(user_id))
    
    def send_new_content(self, content_id: int, title: str, category: str, 
                        author: str, tags: list, difficulty_level: str = None):
        """
        Envoie un événement de nouveau contenu
        
        Args:
            content_id: ID du contenu
            title: Titre du contenu
            category: Catégorie
            author: Auteur
            tags: Liste des tags
            difficulty_level: Niveau de difficulté
        """
        data = {
            'content_id': content_id,
            'title': title,
            'category': category,
            'author': author,
            'tags': tags,
            'difficulty_level': difficulty_level,
            'created_at': datetime.utcnow().isoformat()
        }
        
        return self._send_event('new-content', data, key=str(content_id))
    
    def send_user_event(self, user_id: int, event_type: str, email: str = None, 
                       name: str = None, preferences: list = None):
        """
        Envoie un événement utilisateur (signup, login, profile_update)
        
        Args:
            user_id: ID de l'utilisateur
            event_type: Type d'événement (signup, login, profile_update, logout)
            email: Email de l'utilisateur
            name: Nom de l'utilisateur
            preferences: Préférences utilisateur
        """
        data = {
            'user_id': user_id,
            'event_type': event_type,
            'email': email,
            'name': name,
            'preferences': preferences or []
        }
        
        return self._send_event('user-events', data, key=str(user_id))
    
    def send_search_event(self, user_id: int = None, query: str = '', 
                         category: str = None, results_count: int = 0):
        """
        Envoie un événement de recherche
        
        Args:
            user_id: ID de l'utilisateur (peut être None pour les anonymes)
            query: Terme de recherche
            category: Catégorie filtrée
            results_count: Nombre de résultats trouvés
        """
        data = {
            'user_id': user_id,
            'query': query,
            'category': category,
            'results_count': results_count
        }
        
        key = str(user_id) if user_id else None
        return self._send_event('search-events', data, key=key)
    
    def send_analytics_metric(self, metric_name: str, metric_value: float, 
                            tags: Dict[str, str] = None, user_id: int = None):
        """
        Envoie une métrique d'analytics
        
        Args:
            metric_name: Nom de la métrique
            metric_value: Valeur de la métrique
            tags: Tags associés
            user_id: ID utilisateur (optionnel)
        """
        data = {
            'metric_name': metric_name,
            'metric_value': metric_value,
            'tags': tags or {},
            'user_id': user_id
        }
        
        return self._send_event('analytics-metrics', data)
    
    def send_recommendation_feedback(self, user_id: int, content_id: int, 
                                   recommended: bool, clicked: bool, position: int):
        """
        Envoie un feedback sur les recommandations
        
        Args:
            user_id: ID de l'utilisateur
            content_id: ID du contenu recommandé
            recommended: Si le contenu était recommandé
            clicked: Si l'utilisateur a cliqué
            position: Position dans la liste de recommandations
        """
        data = {
            'user_id': user_id,
            'content_id': content_id,
            'recommended': recommended,
            'clicked': clicked,
            'position': position,
            'feedback_type': 'recommendation'
        }
        
        return self._send_event('recommendations', data, key=str(user_id))
    
    def flush(self):
        """Force l'envoi de tous les messages en attente"""
        if self.producer:
            self.producer.flush()
    
    def close(self):
        """Ferme le producteur"""
        if self.producer:
            self.producer.close()
            logger.info("🔐 Producteur Kafka fermé")

# Instance globale du producteur
kafka_producer = None

def get_kafka_producer() -> TechFeedKafkaProducer:
    """Retourne l'instance globale du producteur Kafka"""
    global kafka_producer
    if kafka_producer is None:
        # Configuration depuis les variables d'environnement ou valeurs par défaut
        import os
        bootstrap_servers = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
        kafka_producer = TechFeedKafkaProducer(bootstrap_servers)
    return kafka_producer

def init_kafka_producer(app):
    """Initialise le producteur Kafka avec l'application Flask"""
    global kafka_producer
    bootstrap_servers = app.config.get('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
    kafka_producer = TechFeedKafkaProducer(bootstrap_servers)
    
    # Ajouter un handler pour fermer proprement le producteur
    @app.teardown_appcontext
    def close_kafka_producer(error):
        if kafka_producer:
            kafka_producer.flush()

# Fonctions utilitaires pour l'intégration facile dans l'app
def track_user_interaction(user_id: int, content_id: int, interaction_type: str, **kwargs):
    """Fonction utilitaire pour tracker une interaction"""
    producer = get_kafka_producer()
    return producer.send_user_interaction(user_id, content_id, interaction_type, **kwargs)

def track_user_event(user_id: int, event_type: str, **kwargs):
    """Fonction utilitaire pour tracker un événement utilisateur"""
    producer = get_kafka_producer()
    return producer.send_user_event(user_id, event_type, **kwargs)

def track_search(query: str, user_id: int = None, **kwargs):
    """Fonction utilitaire pour tracker une recherche"""
    producer = get_kafka_producer()
    return producer.send_search_event(user_id, query, **kwargs)

def track_new_content(content_id: int, **kwargs):
    """Fonction utilitaire pour tracker un nouveau contenu"""
    producer = get_kafka_producer()
    return producer.send_new_content(content_id, **kwargs)

def track_metric(metric_name: str, metric_value: float, **kwargs):
    """Fonction utilitaire pour tracker une métrique"""
    producer = get_kafka_producer()
    return producer.send_analytics_metric(metric_name, metric_value, **kwargs) 