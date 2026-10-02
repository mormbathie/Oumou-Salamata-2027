# Premier déploiement sur le VPS OVH

Ce déploiement héberge le frontend React, l'API NestJS, PostgreSQL et Keycloak
sur le VPS `57.131.160.254`. Caddy fournit HTTPS et conserve ses certificats
dans un volume persistant. Vercel pourra être configuré ultérieurement.

| Élément | Valeur |
| --- | --- |
| Application | `https://oumou-salamat.57.131.160.254.sslip.io` |
| API | `https://oumou-salamat.57.131.160.254.sslip.io/api` |
| Santé de l'API | `https://oumou-salamat.57.131.160.254.sslip.io/api/health` |
| Authentification | `https://auth.57.131.160.254.sslip.io` |
| Dossier sur le VPS | `/opt/oumou-salamat` |

Les adresses [sslip.io](https://sslip.io/) renvoient l'IP contenue dans leur nom.
Elles permettent ce premier déploiement sans achat de domaine. Caddy obtient
et renouvelle les certificats [HTTPS automatiquement](https://caddyserver.com/docs/automatic-https).
Ces adresses temporaires dépendent du service DNS sslip.io ; elles pourront être
remplacées par les domaines de l'école.

Déploiement vérifié le 2 octobre 2026 : six conteneurs sains, certificat HTTPS
valide, page de connexion affichée dans le navigateur, connexion administrateur,
tableau de bord et gestion des utilisateurs fonctionnels. Un upload PNG de plus
de 1 Mo a été envoyé, téléchargé à l'identique puis supprimé avec sa fiche
temporaire. La première sauvegarde des deux bases et des documents est valide.

## Configuration de production

`docker-compose.vps.yml` complète le Compose local. Seul Caddy publie les ports
web 80 et 443. Les autres ports restent sur `127.0.0.1`, et la base Keycloak
reste sur le réseau Docker. L'API reçoit les requêtes directement depuis Caddy,
avec le protocole HTTPS correct ; les uploads sont autorisés jusqu'à 12 Mo
au niveau des proxies, pour les fichiers de 10 Mo acceptés par l'API.

Le script `deploy/bootstrap.py` génère sur le VPS :

- `.env` avec des secrets distincts pour les deux bases et l'administration Keycloak ;
- `deploy/realm.production.json` avec un seul utilisateur applicatif `admin`,
  le rôle `ADMIN`, un mot de passe unique et les origines HTTPS exactes ;
- `deployment-access.txt` avec l'accès initial à l'application.

Ces fichiers sont privés et exclus du dépôt. Le script préserve les secrets
existants lors d'une relance ; il refuse les configurations partielles ou un
changement de noms de domaine. Il ne charge aucune donnée de démonstration.
La création de la première classe initialise automatiquement l'année scolaire.

Keycloak 24 utilise une URL HTTPS publique fixe pour l'issuer JWT et une URL
Docker interne pour les appels du backend. Le Compose VPS supprime les anciennes
options hostname qui entreraient en conflit avec cette URL.
Voir la [configuration hostname de Keycloak 24](https://raw.githubusercontent.com/keycloak/keycloak/24.0.5/docs/guides/server/hostname.adoc).
La console d'administration Keycloak n'est pas exposée par Caddy ; la gestion
des utilisateurs se fait dans l'application avec le compte administrateur.

La session renouvelable est configurée avec 26 heures d'inactivité et une durée
maximale de 7 jours dans le realm Keycloak. Les nouveaux realms reçoivent ces
valeurs depuis `keycloak/realm-export.json` et `deploy/bootstrap.py`. Un realm
déjà importé conserve ses anciens réglages : après validation locale et lors
d'une future mise à jour du VPS, appliquer aussi les quatre paramètres au realm
existant via l'outil d'administration Keycloak. Exemple dans le conteneur
Keycloak, avec les identifiants d'administration déjà fournis par Compose :

```bash
docker compose exec -T keycloak sh -ec '/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null && /opt/keycloak/bin/kcadm.sh update realms/oumou-salamat -s ssoSessionIdleTimeout=93600 -s ssoSessionMaxLifespan=604800 -s clientSessionIdleTimeout=93600 -s clientSessionMaxLifespan=604800'
```

Sur le VPS, ajouter `-f docker-compose.yml -f docker-compose.vps.yml` à la
commande Compose et l'exécuter uniquement pendant la mise à jour approuvée.

## Accès initial

Dans ta session SSH sur le VPS, afficher les identifiants :

```bash
sudo cat /opt/oumou-salamat/deployment-access.txt
```

Le compte applicatif est `admin`. Son mot de passe est distinct de celui de
l'administration Keycloak, et les comptes de test du README local ne sont pas
importés. Les données scolaires de l'environnement local ne sont pas transférées.

## Images de production et mises à jour

Les tests sur `main` précèdent la publication des seules images applicatives
`mormbathie/oumou-salamat-backend` et `mormbathie/oumou-salamat-frontend` sur
Docker Hub. Chaque image porte le SHA complet du commit source ; le frontend est
construit avec `/api` et l'URL HTTPS publique de Keycloak. Le workflow requiert
les secrets GitHub `DOCKERHUB_USERNAME` et `DOCKERHUB_TOKEN`. Les PR et `develop`
ne publient aucune image. Le VPS ne construit plus les images applicatives.

`deploy/production.env` contient la version désirée, sous la forme
`APP_VERSION=<SHA complet>`. Ce fichier suivi par Git est mis à jour uniquement
après vérification des deux images sur Docker Hub. Il ne contient aucun secret.
Le script `deploy/deploy-vps.sh` est lancé sur le VPS après avoir récupéré le
commit du manifeste. Il vérifie Compose et les fichiers privés existants, exige
une nouvelle sauvegarde complète, tire les deux images, puis recrée uniquement
le backend et le frontend. Il attend les six healthchecks, vérifie les IDs des
images réellement exécutées, `/api/health` et la page HTML servie publiquement.
Une erreur arrête la procédure ; elle ne supprime aucun volume.

Le dossier actuel du VPS est un instantané sans répertoire `.git`. Depuis une
copie locale propre du dépôt, transférer le commit choisi sans supprimer les
fichiers privés du serveur :

```bash
git archive --format=tar HEAD | ssh ubuntu@57.131.160.254 'sudo tar -xf - -C /opt/oumou-salamat'
```

Le transfert ne supprime pas les fichiers du VPS absents de Git. Vérifier avant
chaque transfert que `deploy/production.env` pointe vers deux images déjà
publiées sur Docker Hub. Ensuite, dans une session SSH :

```bash
cd /opt/oumou-salamat
sudo bash deploy/deploy-vps.sh
```

Pour revenir à une image précédente, changer `APP_VERSION` dans
`deploy/production.env` vers le SHA précédent dont les deux images existent
encore sur Docker Hub, committer ce changement sur `main`, transférer le nouveau
commit avec la commande `git archive` ci-dessus puis relancer
`sudo bash deploy/deploy-vps.sh`. Cette opération
effectue une nouvelle sauvegarde. Si le schéma de base a changé, examiner sa
compatibilité avec l'ancien backend avant le retour arrière : le démarrage du
backend applique `prisma db push`.

## Commandes d'exploitation

Toutes les commandes suivantes s'exécutent dans le terminal SSH du VPS :

```bash
cd /opt/oumou-salamat
set -a; . deploy/production.env; set +a
sudo --preserve-env=APP_VERSION docker compose -f docker-compose.yml -f docker-compose.vps.yml ps
sudo --preserve-env=APP_VERSION docker compose -f docker-compose.yml -f docker-compose.vps.yml logs --tail=50 backend keycloak caddy
```

Les données des deux bases et les documents utilisent des volumes persistants.
Ne pas lancer `docker compose down -v` et ne pas rejouer le seed de démonstration.
Le démarrage du backend applique actuellement `prisma db push` : sauvegarder
et revoir toute modification de schéma avant une mise à jour.

## Sauvegardes

`deploy/backup.sh` sauvegarde les deux bases et les documents dans
`/var/backups/oumou-salamat/daily/`, avec des fichiers privés et sept jours
de conservation. Seules les sauvegardes complètes sont publiées. Le timer
`oumou-salamat-backup.timer` les lance chaque jour à 02 h, heure de Tunis,
avec un décalage aléatoire maximal de dix minutes.

```bash
sudo systemctl list-timers oumou-salamat-backup.timer
sudo systemctl start oumou-salamat-backup.service
sudo journalctl -u oumou-salamat-backup.service --no-pager -n 20
```

Ces sauvegardes restent sur le disque du VPS. Une copie sur une autre machine
est nécessaire pour conserver les données en cas de perte du VPS.

## Reproduire un premier déploiement

Une fois les sources et le manifeste de version transférés dans un dossier neuf
sur le serveur, et après disponibilité des deux images Docker Hub :

```bash
cd /opt/oumou-salamat
sudo python3 deploy/bootstrap.py --app-host oumou-salamat.57.131.160.254.sslip.io --auth-host auth.57.131.160.254.sslip.io
sudo docker volume create oumou_salamat_vps_postgres_data
set -a; . deploy/production.env; set +a
sudo --preserve-env=APP_VERSION docker compose -f docker-compose.yml -f docker-compose.vps.yml config --quiet
sudo --preserve-env=APP_VERSION docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d --no-build --wait --wait-timeout 300
```

Pour installer aussi les sauvegardes sur un nouveau serveur :

```bash
cd /opt/oumou-salamat
sudo chmod 700 deploy/backup.sh
sudo install -m 644 deploy/oumou-salamat-backup.service deploy/oumou-salamat-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oumou-salamat-backup.timer
sudo systemctl start oumou-salamat-backup.service
```

La publication des images est automatique après les tests sur `main` ; la mise
à jour sur le VPS reste une étape explicite et contrôlée.

## Ajouter un domaine ensuite

Créer les enregistrements DNS de l'application et de l'authentification vers
le VPS, puis mettre à jour `.env`, CORS, les origines/redirections du client
Keycloak et l'attribut `frontendUrl` du realm existant. Recréer les services et
vérifier une nouvelle connexion. Conserver les bases, documents et mots de passe.
Le script de bootstrap sert uniquement à initialiser une installation neuve.
