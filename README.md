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

**Coach IA** (optionnel, via l'API Claude)
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
- API [Anthropic Messages](https://docs.anthropic.com) (appel HTTP direct) pour le coach

L'app cible **Android**. La partie iOS n'a pas été testée, et les notifications ne fonctionnent pas sur le web.

## Installation

### Prérequis

- [Node.js](https://nodejs.org) 20 ou plus récent
- [Android Studio](https://developer.android.com/studio), pour le SDK Android et un **JDK 17 ou plus récent** (Android Studio en fournit un dans `jbr/`)
- Un téléphone Android avec le **débogage USB** activé, ou un émulateur

### Lancer l'application

```bash
git clone https://github.com/<ton-compte>/vicrasti_project.git
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

> Il s'agit d'une version de développement : elle charge son code depuis Metro sur le PC. Pour une app autonome, compile une version release (`cd android && ./gradlew assembleRelease`) ou utilise [EAS Build](https://docs.expo.dev/build/introduction/).

## Configuration

Tout se règle depuis l'app, avec l'icône engrenage de l'écran Aujourd'hui :

| Réglage | Usage |
|---|---|
| **Coach IA** | Clé API Claude, à créer sur [console.anthropic.com](https://console.anthropic.com). Sans clé, le reste de l'app fonctionne normalement. |
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

## Données et confidentialité

- Tâches, sessions et réglages sont stockés **uniquement sur le téléphone** (AsyncStorage). Aucun serveur.
- La clé API Claude et les identifiants ICS sont aussi stockés sur le téléphone, **en clair**. Ne l'utilise pas sur un appareil partagé.
- Le coach IA envoie ton planning du jour et ta demande à l'API d'Anthropic, uniquement quand tu l'utilises.

## Licence

Aucune licence pour l'instant : tous droits réservés.
