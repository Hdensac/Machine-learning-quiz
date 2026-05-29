# ML Quiz Lab - Application de Quiz Machine Learning

Une Single Page Application (SPA) interactive, moderne et responsive contenant des quiz d'entraînement académique sur 6 thèmes majeurs du Machine Learning.

## Fonctionnalités principales

1. **6 Thèmes Spécifiques** : DBSCAN, Arbres de décision, SVM, Algorithme Apriori, ACP/PCA, Régression linéaire et logistique (chacun chargé dynamiquement depuis son fichier JSON contenant 50 questions).
2. **Mode Entraînement Double** :
   - **Une par une** : Affichage épuré question par question avec navigateur complet pour passer d'une question à l'autre et fonction de marquage ("Drapeau") pour révision.
   - **Liste fluide** : Affichage en une seule liste défilable avec navigation flottante latérale rapide.
3. **Chronomètre Global de 20 Minutes** : Validation et envoi automatique du quiz à la fin du temps imparti.
4. **Gestion Dynamique des Inputs** : Détection automatique des questions à choix multiple (checkboxes, ex: SVM) et des questions à choix unique (boutons radios).
5. **Revue de Résultats ultra-détaillée** : Calcul automatique des scores et affichage coloré vert (correct) / rouge (erreur avec correction).
6. **Module de Remédiation** : Bouton permettant de refaire instantanément le quiz en ciblant *exclusivement* les questions manquées ou non répondues, avec un chronomètre recalculé proportionnellement.

## Lancement en local

L'application récupère les données dynamiquement en AJAX. Pour éviter les restrictions de sécurité du protocole `file://` dans votre navigateur (CORS), il convient de lancer un serveur web local simple.

### Option 1 : Via Node.js (Recommandé)
Assurez-vous d'avoir Node.js installé, puis exécutez dans votre terminal à la racine du projet :
```bash
npm install
npm run dev
```

### Option 2 : Via Python
Si vous préférez Python, vous pouvez lancer ce serveur rapide à la racine du projet :
- Pour Python 3 :
  ```bash
  python -m http.server 3000
  ```
- Pour Python 2 :
  ```bash
  python -m SimpleHTTPServer 3000
  ```
Ensuite, ouvrez votre navigateur sur [http://localhost:3000](http://localhost:3000).

## Déploiement Vercel

Cette application étant 100% Frontend (SPA sans base de données), elle est optimisée pour un déploiement instantané et gratuit sur **Vercel** :

1. Installez le CLI Vercel (`npm install -g vercel`) ou connectez votre dépôt Git à votre compte Vercel.
2. Lancez simplement la commande à la racine du projet :
   ```bash
   vercel
   ```
3. Suivez les instructions rapides à l'écran. Votre application sera en ligne en quelques secondes !
