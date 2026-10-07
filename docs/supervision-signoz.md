# Supervision de l’école As Sakina

SigNoz est installé séparément de l’application dans `/opt/assakina-observability`.
Il collecte les journaux des six services scolaires, les mesures du serveur
(CPU, mémoire, disque, réseau) et les traces des requêtes de l’API.

## Ouvrir l’interface

Accès web : https://monitoring.57.131.160.254.sslip.io

L’accès SSH ci-dessous reste disponible :

Depuis ton ordinateur, laisser ce terminal ouvert :

```bash
ssh -N -L 3301:127.0.0.1:3301 ubuntu@57.131.160.254
```

Ouvrir ensuite http://localhost:3301. Le compte administrateur est `contact@assakina-school.com`. Afficher son mot de
passe initial dans ton terminal SSH :

```bash
sudo cat /opt/assakina-observability/signoz-access.json
```

Changer ensuite ce mot de passe dans SigNoz.
Le compte de l’application scolaire ne sert pas à ouvrir cette interface.
L’interface est aussi accessible en HTTPS sur
https://monitoring.57.131.160.254.sslip.io avec le compte SigNoz.
https://monitoring.assakina-school.com est configuré et devient utilisable après
l’ajout d’un enregistrement DNS A `monitoring` vers `57.131.160.254` chez OVH.
La création initiale de comptes est bloquée sur ces accès publics.
Les ports de collecte restent privés.

## Tableau de bord du serveur

Le tableau **As Sakina — Serveur VPS** est déjà installé dans **Dashboards**.
Pour le réimporter sur une autre installation, choisir **New dashboard → Import JSON**
et importer le fichier
`deploy/observability/dashboard-vps.json` depuis le dépôt. Il fournit les graphiques
CPU, mémoire, disque et réseau ; sélectionner l’hôte `as-sakina-vps`.
Ce modèle vient du dépôt officiel SigNoz/dashboards (hostmetrics, schéma v6).

## Assurer le support

- **Services / APM** : sélectionner `as-sakina-api` pour voir débit, erreurs et délais.
- **Traces** : ouvrir une requête pour examiner ses étapes et leur durée.
- **Logs** : filtrer `service.name` sur `as-sakina-backend`, `as-sakina-keycloak`, etc.
- **Metrics / Dashboards** : utiliser les séries `system.cpu.*`, `system.memory.*`,
  `system.filesystem.*`, `system.network.*` et l’hôte `as-sakina-vps`.

Chaque requête API génère un journal JSON `event = http.request`, y compris
les succès, refus d’accès, erreurs de validation et connexions interrompues.
Les champs `status_code`, `outcome`, `duration_ms`, `method`, `route`,
`correlation_id`, `account_id`, `account_username`, `account_roles`, `device_type`
et `location_country` peuvent être filtrés dans SigNoz.
L’en-tête de réponse **X-Correlation-ID** fournit la référence à communiquer au support.
Les champs natifs `trace_id` et `span_id` permettent de rejoindre une trace conservée.
Tous les journaux sont collectés, mais seules 25 % des traces sont conservées ;
`trace_sampled` indique si la trace correspondante est disponible.

Les erreurs comprennent `error_message`, leur type et les champs métier autorisés
sous `input`. Les mots de passe, jetons, codes QR/OTP, e-mails, téléphones,
informations médicales, fichiers et autres champs non autorisés sont masqués.
Les corps des requêtes d’authentification ne sont jamais enregistrés.
Les réponses complètes et les en-têtes d’authentification ne sont pas collectés.
Le contenu de diagnostic d’une saisie est limité à 4 Ko.
Les erreurs internes renvoient un message générique ; leur type et les lignes de
pile utiles sont journalisés sans le message interne susceptible de contenir du SQL.

L’appareil, le navigateur et le système sont déduits du User-Agent et restent des
informations déclaratives. Le pays est estimé localement à partir de l’IP avec
les données IPtoASN/PDDL ; aucune IP utilisateur n’est envoyée à un service tiers.
Un VPN ou un réseau mobile peut fausser cette estimation. Aucune position GPS
ni ville précise n’est collectée. Une IP privée ou inconnue peut rester sans pays.
La base de pays est téléchargée lors de la construction de l’image Docker et
renouvelée aux prochaines constructions. Le fournisseur est documenté sur
https://github.com/sapics/ip-location-db et la bibliothèque sur
https://github.com/sapics/ip-location-api.
Les URL complètes et paramètres sont masqués dans les traces HTTP.
Un quart des traces est conservé pour réduire la charge du serveur.
Les journaux peuvent contenir les messages produits par les services : leur accès
est réservé aux personnes qui assurent le support.

## Ressources et conservation

Le VPS dispose de 8 Go de mémoire et de 4 processeurs. La pile est plafonnée par
conteneur : ClickHouse 2 500 Mo, interface 600 Mo, collecte 400 Mo, agent 200 Mo,
PostgreSQL et Keeper 256 Mo chacun. Les migrations ont un plafond de 400 Mo.
Les fichiers journaux Docker de la supervision tournent sur trois fichiers de 10 Mo.
La conservation est réglée sur **7 jours** pour les trois types de données.
Elle peut être modifiée dans **Settings → General**.
Surveiller le disque avant d’augmenter ces durées.

## Installer ou remettre en route

Depuis les sources présentes sur le VPS :

```bash
cd /opt/oumou-salamat
sudo bash deploy/observability/install.sh
```

Ce script conserve les volumes de supervision et les données scolaires.
Sur une installation neuve, le premier compte administrateur se crée dans
l’interface privée, puis importer le tableau de bord JSON et régler la conservation.
Le serveur actuel possède déjà son compte, son tableau de bord et ses réglages.

## Exploitation

Sur le VPS :

```bash
sudo docker compose -f /opt/assakina-observability/pours/deployment/compose.yaml ps
sudo docker logs --tail=50 assakina-telemetry-agent
free -h
df -h /
```

La supervision continue après chaque déploiement de l’application. Le script de
déploiement actualise les chemins des journaux lorsque les conteneurs changent.
Pour arrêter uniquement la supervision, sans effacer son historique :

```bash
sudo docker compose -f /opt/assakina-observability/agent.compose.yaml stop
sudo docker compose -f /opt/assakina-observability/pours/deployment/compose.yaml stop
```

Les fichiers générés sont suivis avec le manifeste `deploy/observability/casting.yaml`.
Pour les régénérer, utiliser Foundry v0.3.0 depuis ce dossier :
`foundryctl forge -f casting.yaml`. Les personnalisations figurent dans les patches.
Les images SigNoz et du collecteur sont fixées à des versions précises.
Cette pile possède ses propres volumes ; les sauvegardes scolaires ne sauvegardent
pas l’historique de supervision.

Référence : https://signoz.io/docs/install/docker/

## Tableau de suivi des requêtes

Le tableau **As Sakina — Requêtes et erreurs API** présente six graphiques :
statuts HTTP, catégories 2xx/3xx/4xx/5xx, latence P95 par route, erreurs serveur,
refus/validations et requêtes de plus d’une seconde. Les healthchecks sont exclus
pour ne pas masquer l’activité réelle. Les données proviennent des logs de toutes
les requêtes, et non des traces échantillonnées. Une fenêtre d’une heure et une
actualisation d’une minute limitent le coût des requêtes graphiques. Les groupes
sont limités à 20 séries ; aucun regroupement par utilisateur ou IP.

Pour installer ou actualiser ce tableau sans doublon, sur le VPS :

```bash
cd /opt/oumou-salamat
sudo python3 deploy/observability/install-api-dashboard.py deploy/observability/dashboard-api.json
```

Le script utilise le compte privé existant sans afficher ses secrets et vérifie
chaque requête graphique avant publication. Il préserve le tableau du serveur.

Les logs ajoutent `status_class`, `aborted`, `request_content_type`, et les tailles
`request_bytes` / `response_bytes` quand les en-têtes Content-Length sont disponibles
(ce ne sont pas des compteurs des octets réellement transmis). `request_context`
contient les paramètres et filtres autorisés, même en cas de succès, limité à 2 Ko.
Les corps restent absents sur les succès et masqués/limités sur les erreurs.

Pour les erreurs Prisma : `error_code` fournit par exemple **P2002** (doublon),
`error_fields` indique les champs de contrainte et `error_hint` explique la catégorie.
Aucun SQL ni valeur à l’origine de la contrainte n’est enregistré. Chercher ensuite
le `correlation_id` pour retrouver la requête et, si conservée, sa trace.

Ces ajouts conservent un seul log par requête et le taux de traces de 25 %, sans
nouvel agent, sans appel réseau de géolocalisation et sans duplication des corps.
La mémoire disponible et la charge CPU restent à surveiller : la mesure avant
modification montrait environ 3,8 Go disponibles, 43 % du disque utilisé et une
activité CPU notable de ClickHouse. Cela ne constitue pas une garantie sous charge.

## Réduction de la charge du VPS

Les diagnostics internes de ClickHouse ont été allégés : profilage CPU, temps réel,
mémoire et pipelines détaillés désactivé ; la table interne `system.trace_log`
n'est plus alimentée. Ces traces internes ne sont pas les traces API stockées
par SigNoz, qui restent collectées à 25 %. Les métriques internes sont collectées
toutes les 30 secondes et vidées toutes les 60 secondes ; les messages internes
conservent les avertissements et erreurs. L’historique SigNoz n’est pas effacé.

La page des finances actualise les factures et statistiques toutes les 30 secondes,
et les listes de classes et d’élèves toutes les cinq minutes pendant l’actualisation
automatique. Les chargements manuels restent complets.

Le nettoyage Docker peut être prévisualisé puis exécuté :

```bash
sudo python3 /opt/oumou-salamat/deploy/cleanup-docker.py
sudo python3 /opt/oumou-salamat/deploy/cleanup-docker.py --apply
```

Il protège toutes les images référencées par les conteneurs et les images exactes
du rollback enregistré dans `deploy/last-release.json`. Il retire seulement les
anciennes images applicatives non protégées et le cache de build inutilisé.
Il ne supprime aucun conteneur ni volume. Le nettoyage du 7 octobre 2026 a libéré
environ 20 Go, passant le disque de 46 % à 18 % d’occupation. Le profilage réduit
ne garantit pas une baisse immédiate du CPU : les fusions de tables internes
ont encore été observées après le premier redémarrage.
