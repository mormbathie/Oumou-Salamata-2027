# Déploiement GitHub Actions et Vercel

Le [premier déploiement sur le VPS sans domaine acheté](deploiement-vps.md)
héberge aussi le frontend sur le VPS avec une adresse HTTPS temporaire.
Le présent guide décrit l'architecture Vercel à configurer ensuite.

Architecture retenue : frontend React sur Vercel ; API NestJS, PostgreSQL,
Keycloak et volume des documents sur un serveur persistant avec HTTPS.
Vercel ne lance pas le fichier Docker Compose. NestJS est supporté sur Vercel,
mais cette API écrit actuellement les pièces jointes sur disque : la déplacer
sur des Functions nécessite d'abord un stockage objet et l'adaptation des uploads.

## 1. Préparer les services persistants

### 1.1. Première connexion au VPS OVH

VPS reçu le 2 octobre 2026, d'après le tableau de bord OVH :

| Paramètre | Valeur |
| --- | --- |
| Serveur | `vps-841853c3.vps.ovh.net` |
| IPv4 | `57.131.160.254` |
| Système | Ubuntu 26.04 |
| Ressources | 4 vCores, 8 Go de RAM, 75 Go de stockage |
| Région | Francfort, Allemagne |

Depuis le terminal de ton ordinateur, utiliser l'identifiant indiqué dans
l'e-mail de livraison OVH. Pour Ubuntu, il s'agit habituellement de `ubuntu` :

```bash
ssh ubuntu@57.131.160.254
```

Saisir le mot de passe fourni par OVH dans le terminal ; il ne s'affiche pas
pendant la saisie. Le premier accès peut demander de changer le mot de passe
temporaire, puis de se reconnecter. Garder les mots de passe et clés privées
hors du dépôt et du chat.

Une fois connecté au VPS, vérifier le système et l'accès administrateur :

```bash
whoami
cat /etc/os-release
sudo -v
```

Ces vérifications confirment l'accès au système ; l'installation de
l'application se fait dans les étapes suivantes.
Voir les [premiers pas OVH](https://support.us.ovhcloud.com/hc/en-us/articles/360009253639-Getting-started-with-a-VPS).

### 1.2. Préparer Docker et les noms de domaine

Exécuter les blocs suivants **dans le terminal connecté au VPS**, dans l'ordre.
Ils sont prévus pour le VPS Ubuntu neuf. Les commandes Docker utilisent `sudo`.

Mettre à jour Ubuntu et installer les outils nécessaires :

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git
```

Ajouter la clé et le dépôt officiel Docker :

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

task_docker_codename=$(. /etc/os-release && printf '%s' "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
task_docker_arch=$(dpkg --print-architecture)
printf '%s\n' 'Types: deb' 'URIs: https://download.docker.com/linux/ubuntu' "Suites: $task_docker_codename" 'Components: stable' "Architectures: $task_docker_arch" 'Signed-By: /etc/apt/keyrings/docker.asc' | sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null
```

Conserver la commande `printf` sur une seule ligne lors du collage. Dans
`docker.sources`, les six champs du dépôt doivent se suivre sans ligne vide.
Des lignes vides entre les champs provoquent l'erreur
`Malformed entry ... (URI)` ; réexécuter ce bloc permet de régénérer le fichier.

Installer Docker Engine, Buildx et Compose, puis vérifier le fonctionnement :

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

Le test doit afficher `Hello from Docker!`, puis la commande Compose doit
afficher sa version. Si un bloc échoue, corriger cette erreur avant de continuer.
L'installation suit le [guide officiel Docker pour Ubuntu](https://docs.docker.com/engine/install/ubuntu/),
qui inclut Ubuntu 26.04 parmi les versions prises en charge.

Vérifié sur ce VPS le 2 octobre 2026 : Ubuntu 26.04.1, Docker Engine 29.8.2
actif et activé au démarrage, test `hello-world` réussi et Compose 5.5.1 disponible.
Le fichier APT précédent a été sauvegardé dans `/var/backups/oumou-salamat/`
avant correction. Le déploiement de l'application reste à effectuer.

Pour l'architecture Vercel + VPS, créer les enregistrements DNS `A`
`api.<ton-domaine>` et `auth.<ton-domaine>` vers `57.131.160.254`.
Le domaine du frontend doit être configuré sur Vercel. Les domaines exacts
permettront ensuite de définir HTTPS, CORS et les URLs Keycloak.

### 1.3. Déployer les services après configuration HTTPS

Déployer les services `postgres`, `keycloak-postgres`, `keycloak` et `backend`
sur un serveur Docker avec des sauvegardes des deux bases et du volume
`school_documents`. Placer un reverse proxy HTTPS devant l'API et Keycloak.
Le présent pipeline ne déploie pas ces services ; ils doivent être provisionnés
séparément. Ne pas exposer PostgreSQL sur Internet.

Sur un VPS neuf, créer le volume PostgreSQL externe avant le premier lancement.
Avec la valeur par défaut de `POSTGRES_VOLUME_NAME` :

```bash
sudo docker volume create oumousalamat2027_postgres_data
```

Si ce nom est changé dans le `.env` du serveur, créer le volume correspondant.

Dans le `.env` du serveur, renseigner des secrets uniques, les paramètres
Keycloak de production et `CORS_ORIGINS=https://ecole.example.com` (plusieurs
origines exactes séparées par des virgules). Recréer le backend après changement.
Pour une preview, ajouter son URL exacte ; utiliser des services et données
de test distincts pour `develop`.

Configurer le realm Keycloak avec les URLs HTTPS de production (issuer identique
à `KEYCLOAK_AUTH_SERVER_URL`), et les origines/redirect URIs exactes du frontend
si le client navigateur est utilisé. Le realm fourni contient des comptes de
démonstration : les supprimer ou remplacer leurs mots de passe avant publication.
L'API utilise aujourd'hui `prisma db push` au démarrage Docker ; avant une mise
à jour du schéma en production, prévoir sauvegarde et migrations Prisma revues.
Le pipeline CI n'exécute ni seed ni modification de la base de production.

## 2. Créer le projet Vercel

Importer le dépôt GitHub `mormbathie/Oumou-Salamata-2027` dans Vercel :

- Root Directory : `frontend`.
- Framework : Vite ; Node.js : 22.x.
- Build Command : `npm run build` ; Output Directory : `dist`.
- Variables pour Production et Preview :

| Variable | Exemple de production |
| --- | --- |
| `VITE_API_URL` | `https://api.ecole.example.com/api` |
| `VITE_KEYCLOAK_URL` | `https://auth.ecole.example.com` |
| `VITE_KEYCLOAK_REALM` | `oumou-salamat` |
| `VITE_KEYCLOAK_CLIENT_ID` | `oumou-salamat-app` |

Les variables `VITE_*` sont publiques et intégrées au build. Aucun mot de passe,
token Vercel ou URL privée de base de données ne doit y être placé.
Le routage SPA dans `frontend/vercel.json` permet de recharger les pages internes.
Les déploiements Git natifs sont désactivés dans ce fichier afin que les contrôles
GitHub Actions précèdent la publication. L'import initial peut créer un premier
déploiement ; la mise à jour automatique suivante passe par Actions.

## 3. Activer le pipeline

Dans GitHub → Settings → Secrets and variables → Actions, ajouter ces secrets
au niveau du dépôt :

- `VERCEL_TOKEN` : token créé dans les paramètres du compte Vercel.
- `VERCEL_ORG_ID` : identifiant de l'équipe/compte du projet.
- `VERCEL_PROJECT_ID` : identifiant du projet frontend.

Les IDs sont disponibles dans Vercel ou dans `.vercel/project.json` après
`vercel link` lancé à la racine du dépôt, en sélectionnant le projet existant.
Garder Root Directory = `frontend` dans les paramètres du projet : les commandes
CLI du workflow sont exécutées à la racine du dépôt. Ne pas committer `.vercel/`.

Ajouter ensuite la variable de dépôt `VERCEL_DEPLOY_ENABLED=true`.
Sans elle, seuls les contrôles CI tournent et le déploiement est marqué skipped.
Créer les environnements GitHub `production` et `preview` si nécessaire.
Dans Vercel, renseigner les variables de chaque environnement avant l'activation.

## 4. Travailler au quotidien

- Pull request : compilation du frontend et backend, validation Prisma et tests
  unitaires backend ; aucune publication et aucun secret Vercel utilisé.
- Push sur `develop` : mêmes contrôles puis déploiement Preview.
- Push sur `main` : mêmes contrôles puis déploiement Production.
- Actions → CI and Vercel deployment → Run workflow : relance manuelle sur
  `main` ou `develop`.

L'URL publiée apparaît dans le résumé du job de déploiement. Si un contrôle
échoue, le déploiement n'est pas exécuté. Protéger `main` avec les checks
`Frontend build` et `Backend build and tests` obligatoires avant fusion.
Les previews sont créées pour `develop`, pas pour chaque pull request.

On continue à développer dans son IDE, puis on commit/push vers GitHub.
Vercel héberge le résultat compilé. Ce flux est du CI/CD piloté par Git ; il ne
comprend pas de contrôleur GitOps de réconciliation d'infrastructure.
Un changement du backend est vérifié par la CI, mais sa publication sur le
serveur reste à automatiser selon l'hébergeur choisi.

## Références

- [Vercel et GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
- [Vite sur Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [NestJS sur Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
