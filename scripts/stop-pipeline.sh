#!/bin/bash

# Script d'arrêt de la pipeline TechFeed Kafka
# Arrête tous les services Docker proprement

set -e

echo "🛑 Arrêt de la pipeline TechFeed Kafka..."

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Fonction pour arrêter les services gracieusement
stop_services() {
    log "Arrêt des services de la pipeline..."
    
    # Arrêter Spark Streaming en premier
    info "Arrêt du job Spark Streaming..."
    docker-compose stop spark-streaming 2>/dev/null || true
    
    # Arrêter les workers Spark
    info "Arrêt des workers Spark..."
    docker-compose stop spark-worker-1 spark-worker-2 2>/dev/null || true
    
    # Arrêter le master Spark
    info "Arrêt du master Spark..."
    docker-compose stop spark-master 2>/dev/null || true
    
    # Arrêter YARN
    info "Arrêt de YARN..."
    docker-compose stop nodemanager resourcemanager 2>/dev/null || true
    
    # Arrêter Hadoop
    info "Arrêt de Hadoop..."
    docker-compose stop datanode namenode 2>/dev/null || true
    
    # Arrêter Kafka
    info "Arrêt de Kafka..."
    docker-compose stop kafka 2>/dev/null || true
    
    # Arrêter Zookeeper
    info "Arrêt de Zookeeper..."
    docker-compose stop zookeeper 2>/dev/null || true
    
    # Arrêter les services UI
    info "Arrêt des services UI..."
    docker-compose stop kafka-ui postgres 2>/dev/null || true
    
    log "✅ Services arrêtés"
}

# Fonction pour nettoyer les conteneurs
cleanup_containers() {
    log "Nettoyage des conteneurs..."
    
    docker-compose down --remove-orphans 2>/dev/null || true
    
    log "✅ Conteneurs nettoyés"
}

# Fonction pour nettoyer les volumes (optionnel)
cleanup_volumes() {
    read -p "Voulez-vous supprimer les volumes de données ? (y/N): " -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        warn "Suppression des volumes de données..."
        docker-compose down -v 2>/dev/null || true
        warn "⚠️  Toutes les données stockées ont été supprimées"
    else
        info "Les volumes de données sont conservés"
    fi
}

# Fonction pour afficher l'état final
show_final_status() {
    info "État final des conteneurs TechFeed:"
    docker ps -a --filter "name=techfeed" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || warn "Aucun conteneur TechFeed trouvé"
    
    echo ""
    log "✅ Pipeline TechFeed Kafka arrêtée avec succès!"
    info "Pour redémarrer la pipeline: ./scripts/start-pipeline.sh"
}

# Fonction principale
main() {
    stop_services
    cleanup_containers
    cleanup_volumes
    show_final_status
}

# Gestion des signaux
trap 'error "Script interrompu"; exit 1' INT TERM

# Exécuter la fonction principale
main "$@" 