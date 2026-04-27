# LearnWithUs — Site Web

Site web complet pour **LearnWithUs**, un organisme de formation numerique proposant 3 formations : Intelligence Artificielle, Agilite & SCRUM (en anglais), et SAP.

**Stack technique** : HTML + CSS + JavaScript vanilla (frontend) / PHP 8.x procedural (backend) / Notion (base de donnees) / n8n.cloud (automatisations email)

**Hebergement cible** : IONOS (mutualise, ~8 EUR/mois) - domaine `learnwithus.fr`


## Structure du projet

```
LearnWithUs/
|
|-- frontend/                       <- Partie visible du site
|   |-- index.html                  <- Page Accueil
|   |-- formations.html             <- Catalogue des 3 formations
|   |-- formation-ia.html           <- Cours Intelligence Artificielle
|   |-- formation-scrum.html        <- Cours SCRUM (en anglais)
|   |-- formation-sap.html          <- Cours SAP
|   |-- espace-client.html          <- Onglets Standard / Premium
|   |-- parametres.html             <- Mes informations + suppression compte
|   |-- contact.html                <- Formulaire de contact
|   |-- faq.html                    <- Foire aux questions
|   |-- connexion.html              <- Connexion utilisateur
|   |-- inscription-compte.html     <- Creation de compte
|   |-- paiement.html               <- Paiement Premium fictif
|   |-- admin.html                  <- Dashboard administrateur
|   |-- reset-mot-de-passe.html     <- Reinitialisation mot de passe
|   |-- verification-email.html     <- Atterrissage du lien email bienvenue
|   |-- 404.html                    <- Page d'erreur personnalisee
|   |-- sitemap.xml / robots.txt    <- SEO
|   |-- favicon.svg                 <- Icone du site
|   |-- docs/supports/              <- PDF des supports de cours (Premium)
|   |-- css/style.css               <- Styles communs
|   |-- js/main.js                  <- JavaScript commun
|
|-- backend-php/                    <- API PHP procedurale (zero dependance)
|   |-- config.php                  <- Secrets (Notion token, IDs DB, etc.)
|   |-- config.example.php          <- Modele a recopier en config.php
|   |-- helpers/
|   |   |-- notion.php              <- Wrapper API Notion via cURL
|   |   |-- webhook.php             <- Appel webhooks n8n
|   |   |-- crm.php                 <- Synchronisation CRM Notion
|   |   |-- comptes.php             <- Recherche / lecture comptes
|   |   |-- auth.php                <- Sessions PHP, exigerConnexion / Admin
|   |   |-- rate-limit.php          <- Anti-bruteforce (5 / 15 min)
|   |   |-- token.php               <- Tokens HMAC (reset, verif email)
|   |   |-- transactions.php        <- Enregistrement paiements Notion
|   |-- api/
|   |   |-- _init.php               <- Bootstrap commun
|   |   |-- health.php              <- Sonde de sante
|   |   |-- contact.php             <- Formulaire contact
|   |   |-- creer-compte.php        <- Creation compte + session
|   |   |-- connexion.php           <- Login session
|   |   |-- deconnexion.php         <- Detruit session
|   |   |-- session.php             <- Renvoie utilisateur connecte
|   |   |-- activer-premium.php     <- Bascule Standard -> Premium
|   |   |-- supprimer-compte.php    <- RGPD - droit a l'effacement
|   |   |-- mdp-demande.php         <- Demande lien reset mot de passe
|   |   |-- mdp-confirmer.php       <- Applique nouveau mot de passe
|   |   |-- verifier-email.php      <- Verification email bienvenue
|   |   |-- admin/
|   |       |-- stats.php           <- Dashboard admin (KPI agreges)
|   |       |-- changer-statut.php  <- Standard / Premium par admin
|   |       |-- supprimer-compte.php <- Admin archive un compte
|   |-- data/                       <- Stockage rate-limit (gitignored)
|
|-- .htaccess                       <- Configuration Apache (HTTPS, securite)
|-- creer-zip.sh                    <- Script de generation du ZIP livrable
|-- README.md                       <- Ce fichier
```


## Installation locale (etape par etape)

### Prerequis

- **MAMP** (Windows ou Mac) : [mamp.info](https://www.mamp.info/) - fournit Apache + PHP 8.x
- **VS Code** ou tout editeur de code
- **Un navigateur** : Chrome, Firefox, Edge

### 1. Cloner le projet

```bash
git clone https://github.com/votre-utilisateur/learnwithus.git
cd learnwithus
```

### 2. Configurer MAMP

1. Ouvrez **MAMP > Preferences > Web Server**
2. **Apache Document Root** : selectionnez le dossier racine de ce projet
3. **PHP version** : choisissez 8.3.x ou superieur
4. Verifiez dans le `php.ini` que les extensions sont activees :
   - `extension=php_curl.dll` (decommente)
   - `extension=php_openssl.dll` (decommente)
   - `extension=php_mbstring.dll` (decommente)
5. Configurez les certificats SSL pour cURL :
   ```ini
   [curl]
   curl.cainfo = "C:\MAMP\bin\apache\bin\cacert.pem"
   ```
6. **Start Servers**

### 3. Configurer le backend PHP

```bash
cd backend-php
cp config.example.php config.php
```

Editez `config.php` et remplissez les valeurs :

- `NOTION_TOKEN` - token d'integration Notion ([notion.so/my-integrations](https://www.notion.so/my-integrations))
- `NOTION_DATABASE_COMPTES_ID` - ID de la base "Comptes LearnWithUs"
- `NOTION_DS_*_ID` - IDs des 4 data sources (Comptes, CRM, Transactions, Inscriptions)
- `WEBHOOK_N8N_*` - URLs des 5 webhooks n8n (cf. n8n.cloud)
- `ADMIN_EMAILS` - liste des emails admin separes par virgules
- `APP_SECRET` - chaine aleatoire 32+ caracteres : `php -r "echo bin2hex(random_bytes(32));"`

### 4. Tester en local

Ouvrez dans votre navigateur :

- `http://localhost:8888/frontend/index.html` - page d'accueil
- `http://localhost:8888/backend-php/api/health.php` - sonde de sante
  (doit renvoyer `{"statut":"ok",...}`)


## Deploiement IONOS (production)

1. Souscrire un hebergement mutualise IONOS (~8 EUR/mois) avec PHP 8+
2. Connecter le domaine `learnwithus.fr`
3. Activer le certificat SSL Let's Encrypt (gratuit, auto)
4. Uploader tous les fichiers via FTP / SFTP
5. Creer `backend-php/config.php` directement sur le serveur (NE JAMAIS le committer sur Git)
6. Mettre a jour `URL_SITE` dans `config.php` avec `https://learnwithus.fr`
7. Tester l'URL publique

Le fichier `.htaccess` a la racine force HTTPS, bloque l'acces direct aux helpers PHP, ajoute les headers de securite et active la compression gzip.


## Configuration n8n (5 workflows)

Importer dans n8n.cloud les 5 workflows JSON (livres separement sur Google Drive) :

| # | Workflow | Declenche par |
|---|---|---|
| 1 | Bienvenue | Creation de compte (`/api/creer-compte.php`) |
| 2 | Contact | Formulaire contact (`/api/contact.php`) |
| 3 | Relance leads 7j | Cron quotidien 9h |
| 4 | Paiement Premium | Activation Premium (`/api/activer-premium.php`) |
| 5 | Reset mot de passe | Demande reset (`/api/mdp-demande.php`) |

Apres import, recuperer chaque URL de webhook et la coller dans la constante correspondante de `config.php`.


## Aide

- **Email** : contact@learnwithus.fr
- **FAQ** : consultez la page FAQ du site
