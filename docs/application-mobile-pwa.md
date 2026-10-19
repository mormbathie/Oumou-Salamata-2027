# Installer l’application mobile As Sakina

La PWA permet d’ouvrir l’application depuis l’écran d’accueil du téléphone, dans sa propre fenêtre. Elle utilise les mêmes comptes et les mêmes données que le site sur lequel elle est installée. L’installation ne passe pas par le Play Store ou l’App Store.

## Une interface dédiée au téléphone

Sur un écran de moins de 768 pixels, l’application présente une barre de navigation permanente en bas, avec des raccourcis adaptés au profil et un **Menu** regroupant les modules sous forme de grandes tuiles. L’en-tête reste visible pendant le défilement du contenu.

Les élèves et les factures sont présentés en fiches verticales : identité, classe, situation financière et actions principales. Le bouton **Régler** est directement accessible sur les factures impayées ; les impressions et les corrections autorisées restent accessibles dans **Autres actions**. La sélection et le règlement groupé restent disponibles. Dans les fiches élèves, le numéro du parent permet de lancer un appel depuis le téléphone.

Les boutons et champs sont plus faciles à toucher, les formulaires conservent un défilement vertical et les marges tiennent compte de l’écran d’accueil et des encoches. Sur ordinateur, la navigation latérale et les tableaux sont conservés. Le téléphone et l’ordinateur utilisent les mêmes droits et les mêmes données.

## Android

1. Ouvrir l’adresse de l’école dans Chrome : **https://assakina-school.com** après déploiement de cette version.
2. Toucher **Installer l’application** lorsqu’il est proposé, puis confirmer.
3. Si le bouton n’apparaît pas, ouvrir le menu du navigateur et chercher **Installer l’application** ou **Ajouter à l’écran d’accueil**.
4. Ouvrir **As Sakina** depuis l’écran d’accueil et se connecter normalement.

## iPhone ou iPad

1. Ouvrir le site dans **Safari**.
2. Toucher **Partager**, puis **Sur l’écran d’accueil** / **Ajouter à l’écran d’accueil**.
3. Confirmer et ouvrir l’icône **As Sakina**.

Les libellés dépendent du navigateur et de sa version. Le bouton intégré affiche ces indications sur iPhone/iPad. Une installation déjà présente peut être ouverte directement depuis son icône.

## Utilisation et mises à jour

La connexion Internet reste nécessaire pour consulter les données, inscrire un élève, enregistrer un paiement ou effectuer un pointage. Une coupure affiche un avertissement ; aucune opération n’est enregistrée en attente d’envoi. Si la page ne peut pas être ouverte, une page de reconnexion apparaît avec **Réessayer**. Après une coupure pendant un envoi, vérifier l’historique avant de ressaisir un paiement.

Lorsqu’une version est disponible, un message propose **Mettre à jour**. Terminer et enregistrer les opérations en cours, puis accepter le rechargement. La PWA ne recharge pas d’elle-même un formulaire ouvert. Un ancien onglet peut être fermé et rouvert pour charger la version récente. Une PWA ne modifie pas les rôles ni les règles d’accès existantes.

## Tester en local

Le service worker s’active sur la version compilée, pas sur le serveur de développement Vite. Démarrer d’abord le backend et l’authentification locaux habituels, puis :

```bash
cd frontend
npm run test:pwa
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Ouvrir **http://localhost:4173**. Pour utiliser l’API locale, la configuration de prévisualisation reprend le proxy `/api` vers `http://localhost:3001`. Un navigateur sur le téléphone ne peut pas ouvrir le `localhost` d’un ordinateur : utiliser la version HTTPS de test ou celle de l’école après publication. L’installation et la caméra nécessitent un contexte sécurisé (HTTPS, ou localhost sur l’ordinateur).

Les tests navigateur couvrent le manifeste et les icônes, l’installation Chrome, l’aide iPhone, la page hors connexion, le refus d’envoyer un paiement hors ligne, l’absence de données métier dans Cache Storage et l’activation explicite d’une mise à jour. Le test iPhone utilise une simulation ; l’ajout réel à l’écran d’accueil reste à vérifier sur un appareil physique.

## Fonctionnement technique

Aucune nouvelle bibliothèque d’exécution n’est ajoutée. Le manifeste fournit les icônes normales, une icône adaptée aux masques Android et une icône Apple. La mise en page mobile existante est conservée.

Le service worker ne met en cache qu’une page publique d’indisponibilité. Il ne stocke ni pages authentifiées, ni réponses API, ni documents, ni identifiants, et n’intercepte aucune écriture. Les caches historiques de l’application sont nettoyés à l’activation ; les autres caches sont conservés. Chaque build génère une nouvelle version du service worker. Nginx empêche sa conservation prolongée et sert le bon type de manifeste.

Les données déjà conservées par l’authentification existante (session locale) ne sont pas modifiées par cette fonctionnalité. Le fonctionnement hors ligne des tâches métier et les notifications push ne font pas partie de cette version.

Références : [installation des PWA](https://web.dev/learn/pwa/installation), [manifeste](https://web.dev/learn/pwa/web-app-manifest), [mise à jour du service worker](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache).
