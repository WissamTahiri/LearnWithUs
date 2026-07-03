# LearnWithUs — Présentation de soutenance (3D immersive + son)

Support de pitch pour la soutenance ESGI 2MCSI. Expérience **HTML dynamique** :
monde **3D Three.js** (warp d'ouverture, voyage de caméra entre 6 actes),
**son 100 % génératif** synchronisé aux animations (Web Audio — riser de warp,
balayage stéréo entre les actes, cascade de notes calée sur l'apparition des
éléments), polices auto-hébergées. **Fonctionne hors-ligne**, aucune installation.

## Lancer

Double-cliquez sur **`index.html`**, puis **« ▶ Lancer la présentation »**
(le clic déclenche le voyage d'ouverture et active le son).
Chrome, Edge ou Firefox récents. Astuce : **F** pour le plein écran.

## Contrôles

| Touche / geste | Action |
|---|---|
| `→` · `Espace` · clic ⟩ | Slide suivant |
| `←` | Slide précédent |
| `F` | Plein écran |
| `M` · bouton 🔊 | Couper / activer le son |
| `Début` / `Fin` | Première / dernière slide |
| Swipe (tactile) | Naviguer |

## Structure — 25 slides, 6 actes

1. **Notre projet** — équipe, constat, réponse.
2. **Le produit** — 3 formations, offre freemium, le site en production.
3. **La démo** — le fil rouge : une inscription suivie de bout en bout,
   **Site → Notion → n8n → Boîte mail** (démos live + coulisses réelles).
4. **La confiance** — sécurité, expérience, tests de bout en bout.
5. **La méthode** — 6 phases, rôles tournants, dossier de suivi.
6. **Conclusion** — feuille de route, pourquoi LearnWithUs, questions.

Les slides **DÉMO LIVE** invitent à basculer sur `learnwithus.fr` (site) puis
sur le dashboard admin en direct.

## Contenu du dossier

- `index.html` — la présentation.
- `css/`, `js/` — style, moteur audio, scène 3D, navigation.
- `assets/` — captures réelles : site, bases Notion, workflows n8n, boîte mail équipe.
- `lib/` — Three.js (UMD), post-processing (bloom), polices libres (OFL).

> Polices : Bebas Neue, Orbitron, Space Grotesk (SIL Open Font License).
> Three.js : MIT (mrdoob/three.js).
