# Audit SEO — LearnWithUs

## 1. Optimisations déjà en place

| Optimisation | Présent | Fichier |
|---|---|---|
| Meta description (chaque page) | ✅ | Toutes les pages HTML |
| Meta author | ✅ | Toutes les pages HTML |
| Balise title unique par page | ✅ | Toutes les pages HTML |
| HTTPS obligatoire | ✅ | Vercel / Render (certificats auto) |
| Favicon SVG | ✅ | `frontend/favicon.svg` |
| `sitemap.xml` | ✅ | `frontend/sitemap.xml` |
| `robots.txt` (autorise l'indexation) | ✅ | `frontend/robots.txt` |
| Pages admin / paiement / reset : `noindex, nofollow` | ✅ | Meta robots sur ces pages |
| Balises sémantiques (header, main, footer, section) | ✅ | Toutes les pages HTML |
| Responsive (meta viewport, media queries) | ✅ | `frontend/css/style.css` |
| Lazy loading images | ⚠️ | Pas d'images lourdes pour l'instant |
| Attributs alt sur images | ⚠️ | À vérifier page par page |
| Lien canonique | ❌ | À ajouter (une ligne par page) |

## 2. Procédure d'audit Lighthouse

1. Ouvrir **https://learn-with-us-lac.vercel.app** dans **Chrome**
2. Clic droit → **Inspecter** → onglet **Lighthouse**
3. Sélectionner :
   - **Mode** : Navigation (par défaut)
   - **Device** : Mobile *puis* Desktop (2 runs séparés)
   - **Categories** : Performance, Accessibility, Best Practices, SEO
4. Cliquer sur **Analyze page load**
5. Attendre 30 s, capturer les scores dans le tableau ci-dessous

## 3. Résultats (à remplir après l'audit)

### Page d'accueil (`/index.html`)

| Catégorie | Mobile | Desktop | Objectif |
|---|---|---|---|
| Performance | — | — | ≥ 80 |
| Accessibility | — | — | ≥ 90 |
| Best Practices | — | — | ≥ 90 |
| SEO | — | — | ≥ 95 |

### Page formations (`/formations.html`)

| Catégorie | Mobile | Desktop | Objectif |
|---|---|---|---|
| Performance | — | — | ≥ 80 |
| Accessibility | — | — | ≥ 90 |
| Best Practices | — | — | ≥ 90 |
| SEO | — | — | ≥ 95 |

### Page formation-ia (`/formation-ia.html`)

| Catégorie | Mobile | Desktop | Objectif |
|---|---|---|---|
| Performance | — | — | ≥ 80 |
| Accessibility | — | — | ≥ 90 |
| Best Practices | — | — | ≥ 90 |
| SEO | — | — | ≥ 95 |

## 4. Pistes d'amélioration si les scores sont bas

### Performance
- Minifier le CSS et le JS avec un outil (terser, csso)
- Compresser les images (si ajoutées) en WebP
- Ajouter `defer` sur les scripts non critiques (`<script defer>`)
- Mettre en cache les ressources statiques (Vercel le fait automatiquement)

### Accessibility
- Vérifier le contraste texte/fond (notamment bordeaux sur fond rose)
- Ajouter `aria-label` sur tous les boutons icône
- Ajouter `alt=""` descriptif sur chaque image
- Navigation clavier : tester que chaque élément interactif est atteignable avec Tab

### SEO
- Ajouter `<link rel="canonical" href="…">` sur chaque page
- Vérifier que chaque page a un `<h1>` unique
- Activer Google Search Console + soumettre le `sitemap.xml`
- Ajouter des balises Open Graph (partage réseaux sociaux)

## 5. Mots-clés ciblés

- formation intelligence artificielle en ligne
- apprendre scrum gratuitement
- cours sap débutant
- formation numérique premium
- e-learning IA / SCRUM / SAP

---

*Audit à refaire après chaque itération majeure du site.*
