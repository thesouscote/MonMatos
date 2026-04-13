# 📦 MonMatos

Application web de checklist de matériel pour réalisateurs et équipes de tournage.  
Multi-utilisateurs, comptes sécurisés, fonctionne sur mobile comme une vraie appli.

**Live demo** → `https://[ton-username].github.io/monmatos`

---

## Ce que fait l'appli

MonMatos résout un problème simple : avant chaque tournage, il faut vérifier qu'on a tout son mato, et au retour, vérifier qu'on a tout ramené et rendu. Sans outil dédié c'est galère — on oublie, on perd du temps.

L'appli propose deux modes de checklist :

**🎬 Check Départ** — avant de partir en tournage  
Tu coches chaque équipement au fur et à mesure que tu le mets dans le sac. Une barre de progression montre l'avancement. Quand tout est coché, un message de confirmation s'affiche. Tu sauvegardes la session avec un nom (ex: "Spot Nike – Plateau Dokoui").

**📦 Check Retour / Rangement** — quand tu rentres  
La même liste réapparaît, mais cette fois tu vérifies que tout est bien remis en caisse ou rendu. En plus, si tu as pris du mato en route (emprunté à quelqu'un sur le tournage), tu peux l'ajouter directement dans cette phase avec la mention "à rendre à [nom]".

---

## Fonctionnalités

- 🔐 Comptes utilisateurs sécurisés (Firebase Auth — email + mot de passe)
- 👋 Écran d'accueil personnalisé : "Prêt à tourner, [Ton Prénom]" en grand
- 🎬 Checklist Départ avec barre de progression en temps réel
- 📦 Checklist Retour avec gestion du mato emprunté (nom + personne à qui rendre)
- 💾 Sauvegarde des sessions dans le cloud (Firestore), accessible depuis n'importe quel appareil
- 📋 Historique complet de toutes les sessions (départ + retour) avec détail de chaque item
- ✏️ Gestion complète du mato : ajouter/supprimer des équipements et des catégories
- 📊 Compteurs sur l'accueil : nombre d'items, sessions, catégories
- 🌙 Design dark mode permanent
- 🔤 Police Plus Jakarta Sans (Google Fonts)
- 📱 Mobile-first, installable sur l'écran d'accueil du téléphone

---

## Stack technique

| Élément | Technologie |
|---|---|
| Frontend | HTML + CSS + JavaScript vanilla (ES modules) |
| Auth | Firebase Authentication (email/password) |
| Base de données | Cloud Firestore |
| Hébergement | GitHub Pages (ou Netlify, Vercel) |
| Police | Plus Jakarta Sans via Google Fonts |
| Dépendances externes | Aucune (pas de framework, pas de npm) |

Tout tient dans **un seul fichier** `index.html`. Pas de build, pas de compilation, pas de `node_modules`.

---

## Structure du code (index.html)

Le fichier est organisé en 4 grandes parties :

### 1. `<head>` — Méta et styles
- Import de la police Plus Jakarta Sans depuis Google Fonts
- Toutes les variables CSS (couleurs, espacements, rayons) dans `:root`
- Les styles de chaque page et composant

### 2. HTML — Les pages
L'appli utilise un système de pages CSS (`display: none` / `display: flex`) :

| ID de page | Rôle |
|---|---|
| `#page-auth` | Connexion / Inscription |
| `#page-home` | Accueil avec salutation, stats, actions rapides |
| `#page-checklist` | Checklist Départ |
| `#page-depart` | Checklist Retour + mato emprunté |
| `#page-historique` | Historique des sessions |
| `#page-gestion` | Gérer les items et catégories |

### 3. JavaScript — La logique
Tout le JS est dans un `<script type="module">` en bas du fichier. Firebase est importé directement depuis CDN (pas besoin d'installer quoi que ce soit).

**Fonctions principales :**

| Fonction | Rôle |
|---|---|
| `onAuthStateChanged()` | Surveille l'état de connexion — redirige vers auth ou home |
| `loadUserData()` | Charge les données du user depuis Firestore au login |
| `saveUserData()` | Sauvegarde toutes les données du user dans Firestore |
| `doRegister()` | Crée un compte Firebase + profil avec prénom |
| `doLogin()` | Connecte l'utilisateur |
| `doLogout()` | Déconnecte et vide l'état local |
| `renderHome()` | Affiche l'accueil avec le prénom, les stats et les sessions récentes |
| `renderChecklist()` | Génère la checklist départ par catégorie |
| `renderDepartChecklist()` | Génère la checklist retour + section mato emprunté |
| `toggleItem(id, phase)` | Coche/décoche un item (départ ou retour) |
| `addBorrowedItem()` | Ajoute un item emprunté en route à la checklist retour |
| `openSaveModal(phase)` | Ouvre la modale pour nommer et sauver la session |
| `confirmSave()` | Sauvegarde la session dans Firestore |
| `renderHistorique()` | Affiche toutes les sessions sauvegardées |
| `deleteSession(id)` | Supprime une session de l'historique |
| `renderGestion()` | Affiche la page de gestion du mato |
| `addCategory()` | Ajoute une nouvelle catégorie |
| `addItemFromGestion()` | Ajoute un nouvel équipement |
| `deleteItem(id)` | Supprime un équipement |
| `showPage(id)` | Change la page visible |
| `showToast(msg)` | Affiche une notification temporaire en bas de l'écran |

### 4. Structure des données Firestore

Chaque utilisateur a un document dans la collection `users` :

```
users/
  {uid}/
    categories: ["Caméra", "Audio", "Lumière", ...]
    items: [
      { id: 1, name: "Caméra principale", cat: "Caméra", qty: 1 },
      { id: 2, name: "Micro perche", cat: "Audio", qty: 1 },
      ...
    ]
    sessions: [
      {
        id: 1712345678000,
        name: "Spot Nike – Plateau Dokoui",
        date: "2025-04-05T10:30:00.000Z",
        phase: "arrive",   // ou "depart"
        total: 19,
        checked: 19,
        snapshot: [
          { name: "Caméra principale", cat: "Caméra", qty: 1, checked: true, borrowedFrom: null },
          ...
        ]
      }
    ]
```

---

## Installation et déploiement

### Étape 1 — Créer un projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. Clique **"Ajouter un projet"**
3. Nomme-le `monmatos` (ou ce que tu veux)
4. Désactive Google Analytics si tu veux (pas nécessaire)
5. Clique **"Créer le projet"**

### Étape 2 — Activer l'authentification

1. Dans le menu gauche : **Authentication**
2. Clique **"Commencer"**
3. Onglet **"Sign-in method"**
4. Clique sur **"Email/Password"**
5. Active le premier toggle → **Enregistrer**

### Étape 3 — Créer la base de données Firestore

1. Dans le menu gauche : **Firestore Database**
2. Clique **"Créer une base de données"**
3. Choisis **"Démarrer en mode test"** (tu sécuriseras après)
4. Région : choisis **europe-west** (ou la plus proche de toi)
5. Clique **"Activer"**

### Étape 4 — Récupérer la configuration Firebase

1. Clique sur l'icône ⚙️ (Paramètres du projet) en haut à gauche
2. Section **"Vos applications"** → clique sur **"</ > Web"**
3. Donne un nom à l'appli (ex: `monmatos-web`)
4. **Ne coche pas** "Firebase Hosting" (on utilise GitHub Pages)
5. Clique **"Enregistrer l'application"**
6. Copie l'objet `firebaseConfig` qui s'affiche — il ressemble à ça :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "monmatos-xxxxx.firebaseapp.com",
  projectId: "monmatos-xxxxx",
  storageBucket: "monmatos-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### Étape 5 — Coller la config dans index.html

Ouvre `index.html` et cherche ce bloc (vers la fin du fichier, dans le `<script type="module">`) :

```javascript
// ⚠️ REMPLACE ICI avec ta config Firebase
const firebaseConfig = {
  apiKey: "REMPLACE_PAR_TA_API_KEY",
  authDomain: "REMPLACE.firebaseapp.com",
  projectId: "REMPLACE_PAR_TON_PROJECT_ID",
  storageBucket: "REMPLACE.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:000000000000000000"
};
```

Remplace tout ce bloc par ta vraie config copiée à l'étape 4.

### Étape 6 — Sécuriser Firestore (important)

Dans Firebase Console → **Firestore Database → Règles**, remplace les règles par défaut par ceci :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Cela garantit que chaque utilisateur ne peut lire/écrire **que ses propres données**.  
Clique **"Publier"**.

### Étape 7 — Déployer sur GitHub Pages

1. Crée un repo GitHub nommé `monmatos` (public)
2. Upload les fichiers : `index.html` et `README.md`
3. Va dans **Settings → Pages**
4. Source : **"Deploy from a branch"**
5. Branch : **main**, dossier : **/ (root)**
6. Clique **Save**
7. Attends 1 à 2 minutes → ton appli est en ligne à :  
   `https://[ton-username].github.io/monmatos`

---

## Utiliser MonMatos

### Créer un compte
À la première visite, clique sur **"Inscription"**, entre ton prénom, email et un mot de passe. Ton compte est créé et tu arrives directement sur l'accueil.

### Check Départ 🎬
1. Appuie sur la carte **"Départ"** sur l'accueil
2. Coche chaque item au fur et à mesure que tu le prends
3. Quand tout est coché, le message "Tout le mato est prêt" s'affiche
4. Appuie sur **"Sauver session"**, donne un nom au tournage → c'est sauvegardé

### Check Retour 📦
1. Appuie sur la carte **"Retour"** sur l'accueil
2. La même liste réapparaît — coche chaque item que tu ranges
3. Si tu as pris du mato en route, appuie sur **"+ Ajouter"** dans la section "Mato emprunté en route", entre le nom et à qui il appartient
4. Quand tout est rangé/rendu, sauvegarde la session

### Historique
Accès depuis l'onglet **"Historique"** en bas. Clique sur une session pour voir le détail de chaque item (coché / pas coché, rendu à qui).

### Gérer le mato
Onglet **"Gérer"** en bas. Tu peux :
- Créer de nouvelles catégories (ex: Drone, Grip, Stabilisateur)
- Ajouter des équipements dans une catégorie avec une quantité
- Supprimer des équipements ou des catégories (les catégories vides seulement)

---

## Installer sur mobile

### Android (Chrome)
Menu (3 points) → **"Ajouter à l'écran d'accueil"**

### iPhone (Safari)
Bouton Partager → **"Sur l'écran d'accueil"**

L'appli s'ouvre alors en plein écran comme une vraie appli native.

---

## Personnaliser le mato par défaut

Quand un nouvel utilisateur crée un compte, il reçoit une liste de mato par défaut. Pour la modifier selon ton setup habituel, cherche la constante `DEFAULT` dans le `<script>` de `index.html` :

```javascript
const DEFAULT = {
  categories: ["Caméra", "Audio", "Lumière", "Support", "Stockage", "Alimentation", "Divers"],
  items: [
    { id:1, name:"Caméra principale", cat:"Caméra", qty:1 },
    { id:2, name:"Objectifs", cat:"Caméra", qty:3 },
    // ... ajoute ou modifie ici
  ]
};
```

---

## Résolution de problèmes

**L'appli ne charge pas après le login**  
→ Vérifie que ta `firebaseConfig` est bien collée et que le `projectId` est correct.

**Erreur "permission-denied" dans la console**  
→ Vérifie les règles Firestore (Étape 6). Tu es peut-être encore en mode test expiré.

**Les données ne se sauvegardent pas**  
→ Ouvre la console du navigateur (F12) et regarde l'erreur. Souvent un problème de config Firebase.

**La police ne s'affiche pas correctement**  
→ Vérifie ta connexion internet. Les polices Google Fonts nécessitent une connexion.

---

Made for réalisateurs sur le terrain 🎬  
Abidjan, Côte d'Ivoire
