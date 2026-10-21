# Vicrasti

Une application Android pour arrêter de procrastiner. Elle ne se contente pas de lister ce qu'il faut faire : elle répond à la question **« qu'est-ce que je fais maintenant ? »** et aide à démarrer.

Construite avec Expo / React Native. Toutes les données restent sur le téléphone.

## Fonctionnalités

**Aujourd'hui**
- Carte **Maintenant** : la tâche en cours ou la suivante, avec « Commencer » (session de focus) ou « 5 min » pour démarrer sans pression.
- Trois types de tâches : **Rapide** (30 min placées automatiquement dans le prochain créneau libre), **Créneau** (horaire fixe, récurrent ou non) et **Projet** (un volume d'heures avec une deadline).
- **Planification automatique des projets** : le travail restant est réparti en sessions de 30 min jusqu'à la deadline, avec un quota quotidien (heures restantes ÷ jours restants), en évitant les créneaux déjà occupés. Le travail non fait est replacé automatiquement.
- Projets découpés en **étapes** : la prochaine étape est toujours affichée.
- Tâches **en retard**, à replanifier en un geste.

**Focus**
- Écran plein écran pendant une session, avec pauses courtes et longues.
- Notification persistante avec chronomètre et boutons pause / arrêt, et une alerte de fin de session même app fermée.
- En fin de session, l'app propose de valider la tâche liée.

**Rappels**
- Avant chaque tâche fixe et au début de chaque session de projet.
- Brief du matin et bilan du soir, à heure réglable.

**Progrès**
- Objectif quotidien de sessions de focus, et une **série** de jours consécutifs où il est atteint.
- Niveaux et XP, graphique des 7 derniers jours, badges.

**Coach IA** (optionnel, avec la clé API de ton choix)
- **Débloquer** : un conseil court et concret à partir de ton planning du jour et de ce qui te bloque.
- **Planifier** : décris ce que tu as à faire, l'IA crée les tâches et projets sans chevaucher ton agenda.
- **Découper** : transforme un projet en micro-étapes, la première faisable en moins de 2 minutes.

**Divers**
- Import d'emploi du temps **ICS**, par fichier ou par URL synchronisée toutes les heures. Les cours annulés disparaissent.
- Agenda mensuel, thème clair ou sombre, export et restauration des données.

## Stack technique

- [Expo](https://expo.dev) SDK 54, React Native 0.81, React 19
- [Notifee](https://notifee.app) pour la notification de focus et les rappels planifiés
- AsyncStorage pour le stockage local
- [ical.js](https://github.com/kewisch/ical.js) pour les emplois du temps
- Appels HTTP directs aux API d'IA pour le coach (aucun SDK)

L'app cible **Android**. La partie iOS n'a pas été testée, et les notifications ne fonctionnent pas sur le web.

## Installer l'application

1. Sur ton téléphone Android, ouvre la page [Releases](https://github.com/simonet4/vicrasti_project/releases/latest) et télécharge le fichier `Vicrasti-<version>.apk`.
2. Ouvre le fichier téléchargé. Android demande d'autoriser l'installation depuis cette source (ton navigateur ou ton gestionnaire de fichiers) : accepte.
3. Lance Vicrasti et autorise les notifications, pour recevoir les rappels et l'alerte de fin de session.

L'APK fonctionne sur les téléphones Android à processeur ARM, c'est-à-dire la quasi-totalité des téléphones récents. Les mises à jour s'installent par-dessus la version précédente, sans perdre tes données.

## Développement

### Prérequis

- [Node.js](https://nodejs.org) 20 ou plus récent
- [Android Studio](https://developer.android.com/studio), pour le SDK Android et un **JDK 17 ou plus récent** (Android Studio en fournit un dans `jbr/`)
- Un téléphone Android avec le **débogage USB** activé, ou un émulateur

### Lancer l'application

```bash
git clone https://github.com/simonet4/vicrasti_project.git
cd vicrasti_project
npm install
npx expo run:android
```

Si la compilation échoue avec une erreur de version Java, pointe `JAVA_HOME` vers le JDK d'Android Studio avant de relancer. Sous Windows (PowerShell) :

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npx expo run:android
```

La première compilation prend plusieurs minutes. Ensuite, tant que tu ne modifies que du JavaScript, `npx expo start` suffit : le téléphone recharge le code depuis Metro.

> Il s'agit d'une version de développement : elle charge son code depuis Metro sur le PC.

### Compiler une version release

```bash
cd android
./gradlew app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

L'APK est produit dans `android/app/build/outputs/apk/release/`. Il est signé avec la clé définie dans `android/keystore.properties`. Ce fichier et la clé ne sont pas dans le dépôt ; sans eux, la release est signée avec la clé de debug.

Sous Windows, si la compilation échoue avec `Filename longer than 260 characters`, le chemin du projet est trop long. Compile depuis un chemin plus court (par exemple avec `subst`).

## Configuration

Tout se règle depuis l'app, avec l'icône engrenage de l'écran Aujourd'hui :

| Réglage | Usage |
|---|---|
| **Coach IA** | Clé API de n'importe quel fournisseur pris en charge (voir ci-dessous). Sans clé, le reste de l'app fonctionne normalement. |
| **Journée** | Plage horaire où les sessions de projet peuvent être placées, et maximum d'heures de projet par jour. |
| **Focus** | Durées des sessions et des pauses, objectif quotidien. |
| **Rappels** | Délai avant une tâche, brief du matin, bilan du soir. |
| **Emploi du temps** | URL ICS (et identifiants si nécessaire), synchronisation manuelle, import d'un fichier `.ics`. |
| **Sauvegarde** | Export de toutes les données sous forme de texte, et restauration. |

## Structure du projet

```
App.js                     État global, navigation, actions sur les tâches
src/
  logic/                   Logique pure, sans React (testable dans Node)
    planner.js             Planification des projets en sessions de 30 min
    tasks.js               Modèle de données, récurrences, retards, migration
    stats.js               Série, XP, niveaux, activité quotidienne
    dates.js               Dates en heure locale
    icsImporter.js         Lecture et fusion des calendriers ICS
  hooks/usePomodoro.js     Moteur du minuteur (persistant, fiable en arrière-plan)
  services/                Stockage, notifications, rappels, IA, synchro ICS
  screens/                 Aujourd'hui, Agenda, Coach, Progrès
  components/              Composants d'interface (ui.js), formulaires, écran Focus
  styles/globalStyles.js   Thème clair/sombre, espacements, typographie
android/                   Projet Android natif
```

### Fournisseurs d'IA

Colle n'importe laquelle de ces clés dans **Réglages → Coach IA**. Le fournisseur est reconnu au format de la clé (si le format ne suffit pas, l'app essaie Mistral puis Gemini ; tu peux aussi choisir le fournisseur à la main), puis l'app interroge sa liste de modèles et choisit un modèle rapide adapté. Tu peux imposer un modèle précis dans le même écran, et vérifier la clé avec « Tester la clé ».

| Fournisseur | Format de la clé | Où la créer |
|---|---|---|
| Mistral | 32 caractères, sans préfixe | [console.mistral.ai](https://console.mistral.ai) |
| Google Gemini | `AIza…` ou `AQ.…` | [aistudio.google.com](https://aistudio.google.com) |
| Claude (Anthropic) | `sk-ant-…` | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | `sk-…` | [platform.openai.com](https://platform.openai.com) |
| Groq | `gsk_…` | [console.groq.com](https://console.groq.com) |
| OpenRouter | `sk-or-…` | [openrouter.ai](https://openrouter.ai) |
| Grok (xAI) | `xai-…` | [console.x.ai](https://console.x.ai) |

Certains proposent une offre gratuite (Gemini et Groq notamment, au moment de l'écriture). Les conditions changent souvent : vérifie sur leur site.

## Données et confidentialité

- Tâches, sessions et réglages sont stockés **uniquement sur le téléphone** (AsyncStorage). Aucun serveur.
- La clé API et les identifiants ICS sont aussi stockés sur le téléphone, **en clair**. Ne l'utilise pas sur un appareil partagé.
- Le coach IA envoie ton planning du jour et ta demande au fournisseur d'IA de ta clé, uniquement quand tu l'utilises.

## Licence

Aucune licence pour l'instant : tous droits réservés.
