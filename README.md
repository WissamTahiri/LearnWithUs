# LearnWithUs — Site Web

Site web complet pour **LearnWithUs**, un organisme de formation numerique proposant 3 formations : Intelligence Artificielle, Agilite & SCRUM (en anglais), et SAP.

**Stack technique** : HTML + CSS + JavaScript vanilla (frontend) / PHP 8.x procedural (backend) / Notion (base de donnees) / n8n.cloud (automatisations email)

**Hebergement** : IONOS (mutualise, ~8 EUR/mois) - PHP 8.4, SSL Sectigo Wildcard

**URL de production** : https://learnwithus.fr


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
|   |   |-- admin/
|   |       |-- stats.php           <- Dashboard admin (KPI agreges)
|   |       |-- changer-statut.php  <- Standard / Premium par admin
|   |       |-- supprimer-compte.php <- Admin archive un compte
|   |-- data/                       <- Stockage rate-limit (gitignored)
|
|-- .htaccess                       <- Configuration Apache (HTTPS, securite)
|-- README.md                       <- Ce fichier
```


## Installation locale (etape par etape)

### Prerequis

- **PHP 8.x** installe localement ([php.net/downloads](https://www.php.net/downloads)) avec les extensions cURL, OpenSSL et mbstring activees
- **VS Code** ou tout editeur de code
- **Un navigateur** : Chrome, Firefox, Edge

### 1. Cloner le projet

```bash
git clone https://github.com/votre-utilisateur/learnwithus.git
cd learnwithus
```

### 2. Lancer le serveur PHP local

Le projet ne necessite aucun serveur dedie : le serveur web integre de PHP suffit.

1. Verifiez dans votre `php.ini` que les extensions sont activees :
   - `extension=curl` (decommente)
   - `extension=openssl` (decommente)
   - `extension=mbstring` (decommente)
2. Pour que cURL valide les certificats SSL, telechargez [cacert.pem](https://curl.se/ca/cacert.pem) et renseignez son chemin :
   ```ini
   [curl]
   curl.cainfo = "/chemin/vers/cacert.pem"
   ```
3. Depuis la racine du projet, demarrez le serveur :
   ```bash
   php -S localhost:8000
   ```

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

- `http://localhost:8000/frontend/index.html` - page d'accueil
- `http://localhost:8000/backend-php/api/health.php` - sonde de sante
  (doit renvoyer `{"statut":"ok",...}`)


## Deploiement IONOS (production - effectue le 28/04/2026)

Le site tourne en production sur `https://learnwithus.fr`. Les etapes suivies :

1. **Souscription** : pack IONOS Hebergement Web Premium (~8 EUR/mois) avec PHP 8.4
2. **Domaine** : `learnwithus.fr` connecte au pack via "Connecter a un espace Web", cible `/public`
3. **SSL** : certificat **SSL Starter Wildcard** (Sectigo) gratuit inclus, couvre `learnwithus.fr` et `*.learnwithus.fr`, renouvellement auto tous les 180 jours
4. **Upload** : tous les fichiers `frontend/*` + `.htaccess` + `backend-php/` deposes via SFTP (FileZilla) dans `/public/`
5. **Config prod** : `backend-php/config.php` cree directement sur le serveur (jamais commit sur Git), seule difference vs local : `URL_SITE = 'https://learnwithus.fr'`
6. **Permissions** : dossier `backend-php/data/` en 755 (writeable pour le rate-limit)

Le fichier `.htaccess` a la racine force HTTPS (redirection 301), bloque l'acces direct au `config.php` et aux dossiers `helpers/` et `data/`, ajoute les headers de securite (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy), active la compression gzip et le cache navigateur, et redirige les 404 vers `/404.html`.


## Email professionnel (IONOS)

Une boite mail `contact@learnwithus.fr` (Email Basic 2 Go, gratuit avec le pack) est configuree pour :
- Recevoir les messages depuis le formulaire de contact du site
- **Etre l'expediteur SMTP des 5 workflows n8n** (point critique pour la delivrabilite : sans cela les emails partent depuis Gmail et sont rejetes par les FAI .fr a cause du SPF)

Webmail accessible sur https://mail.ionos.fr.


## Configuration n8n (5 workflows)

Workflows hebergees sur n8n.cloud (instance `persia-esgi`). Tous utilisent le **credential SMTP IONOS** suivant :

```
Host:     smtp.ionos.fr
Port:     587
User:     contact@learnwithus.fr
Password: (mot de passe defini lors de la creation de la boite IONOS)
STARTTLS: ACTIVE (NE PAS desactiver - sinon erreur 530 User not authenticated)
```

| # | Workflow | Declenche par |
|---|---|---|
| 1 | Bienvenue | Creation de compte (`/api/creer-compte.php`) |
| 2 | Contact | Formulaire contact (`/api/contact.php`) |
| 3 | Relance leads 7j | Cron quotidien 9h |
| 4 | Paiement Premium | Activation Premium (`/api/activer-premium.php`) |
| 5 | Reset mot de passe | Demande reset (`/api/mdp-demande.php`) |

Apres import des workflows JSON, chaque URL `Production` (pas `Test`) est collee dans la constante correspondante de `config.php`. Les 5 workflows doivent etre **actives** (toggle vert en haut a droite de l'editeur n8n) pour que les webhooks Production repondent.


## Aide

- **Email** : contact@learnwithus.fr
- **FAQ** : consultez la page FAQ du site
