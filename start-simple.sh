#!/bin/bash

echo "🚀 Démarrage de la pipeline TechFeed Kafka..."

# Créer les répertoires nécessaires
mkdir -p hadoop/config spark/apps spark/data logs

# Corriger les fichiers XML Hadoop si nécessaire
if [ -f "hadoop/config/core-site.xml" ]; then
    sed -i.bak 's/<n>/<name>/g' hadoop/config/core-site.xml
    sed -i.bak 's/<\/n>/<\/name>/g' hadoop/config/core-site.xml
fi

if [ -f "hadoop/config/hdfs-site.xml" ]; then
    sed -i.bak 's/<n>/<name>/g' hadoop/config/hdfs-site.xml  
    sed -i.bak 's/<\/n>/<\/name>/g' hadoop/config/hdfs-site.xml
fi

echo "📦 Démarrage des services..."

# Arrêter les services existants
docker-compose down --remove-orphans 2>/dev/null || true

# Démarrer tous les services
docker-compose up -d

echo "⏳ Attente du démarrage des services..."
sleep 60

echo "✅ Pipeline démarrée!"
echo ""
echo "🌐 Interfaces disponibles:"
echo "  • Kafka UI:           http://localhost:8080"
echo "  • Spark Master UI:    http://localhost:8081"
echo "  • Hadoop NameNode UI: http://localhost:9870"
echo ""
echo "📊 Vérifier le statut: docker-compose ps"
echo "🛑 Arrêter la pipeline: docker-compose down" 