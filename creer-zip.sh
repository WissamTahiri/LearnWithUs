#!/bin/bash
# =============================================================
# creer-zip.sh — Génère le ZIP livrable Phase 4
# =============================================================
# Usage : bash creer-zip.sh
# Sortie : Documents\LearnWithUs Doc\LearnWithUs - Livrable Phase 4.zip
#
# Le ZIP contient le projet PROPRE (sans CLAUDE.md, sans .claude/,
# sans secrets, sans rate-limit). Il remplace config.php par
# config.example.php pour ne pas exposer les secrets.
# =============================================================

set -e

PROJ="/c/dev/Projet Annuel 2MCSI/LearnWithUs"
DEST_DIR="/c/Users/elhou/Downloads"
DEST_NAME="LearnWithUs - Livrable Phase 4"
TMP="/tmp/$DEST_NAME"

echo "=== Préparation du dossier temporaire ==="
rm -rf "$TMP"
mkdir -p "$TMP"

echo "=== Copie des fichiers (sans CLAUDE.md, .claude, .git, data, config.php) ==="
# Copie tout puis on retire ce qu'on ne veut pas
cp -r "$PROJ/frontend"     "$TMP/"
cp -r "$PROJ/backend-php"  "$TMP/"
cp    "$PROJ/README.md"    "$TMP/"
cp    "$PROJ/.htaccess"    "$TMP/"

echo "=== Nettoyage : retire config.php (secrets) et data/ (rate-limit) ==="
rm -f  "$TMP/backend-php/config.php"
rm -rf "$TMP/backend-php/data"
mkdir -p "$TMP/backend-php/data"
echo "" > "$TMP/backend-php/data/.gitkeep"

echo "=== Création du ZIP ==="
cd "/tmp" && zip -rq "$DEST_DIR/$DEST_NAME.zip" "$DEST_NAME"

echo ""
echo "=== ZIP généré ==="
ls -la "$DEST_DIR/$DEST_NAME.zip"
echo ""
echo "Contenu du ZIP :"
unzip -l "$DEST_DIR/$DEST_NAME.zip" | head -30
echo "..."
unzip -l "$DEST_DIR/$DEST_NAME.zip" | tail -5

echo ""
echo "=== Nettoyage temporaire ==="
rm -rf "$TMP"
echo "OK — ZIP prêt à uploader sur Drive Phase 4 :"
echo "    $DEST_DIR/$DEST_NAME.zip"
