# Supervision de l’école As Sakina

SigNoz est installé séparément de l’application dans `/opt/assakina-observability`.
Il collecte les journaux des six services scolaires, les mesures du serveur
(CPU, mémoire, disque, réseau) et les traces des requêtes de l’API.

## Ouvrir l’interface

Depuis ton ordinateur, laisser ce terminal ouvert :

```bash
ssh -N -L 3301:127.0.0.1:3301 ubuntu@57.131.160.254
```

Ouvrir ensuite http://localhost:3301. Lors du premier accès, créer le compte
administrateur SigNoz avec une adresse e-mail et un mot de passe propres à cet outil.
Le compte de l’application scolaire ne sert pas à ouvrir cette interface.
L’interface et les ports de collecte ne sont pas publiés sur Internet.

## Assurer le support

- **Services / APM** : sélectionner `as-sakina-api` pour voir débit, erreurs et délais.
- **Traces** : ouvrir une requête pour examiner ses étapes et leur durée.
- **Logs** : filtrer `service.name` sur `as-sakina-backend`, `as-sakina-keycloak`, etc.
- **Metrics / Dashboards** : utiliser les séries `system.cpu.*`, `system.memory.*`,
  `system.filesystem.*`, `system.network.*` et l’hôte `as-sakina-vps`.

Les corps des requêtes et les en-têtes d’authentification ne sont pas collectés.
Les URL complètes et paramètres sont masqués dans les traces HTTP.
Un quart des traces est conservé pour réduire la charge du serveur.
Les journaux peuvent contenir les messages produits par les services : leur accès
est réservé aux personnes qui assurent le support.

## Ressources et conservation

Le VPS dispose de 8 Go de mémoire et de 4 processeurs. La pile est plafonnée par
conteneur : ClickHouse 2 500 Mo, interface 600 Mo, collecte 400 Mo, agent 200 Mo,
PostgreSQL et Keeper 256 Mo chacun. Les migrations ont un plafond de 400 Mo.
Les fichiers journaux Docker de la supervision tournent sur trois fichiers de 10 Mo.
Dans **Settings → General**, régler la conservation selon les besoins ; les
valeurs initiales de SigNoz sont 7 jours pour les traces/journaux et 30 jours pour
les métriques. Sur ce VPS partagé, privilégier 7 jours pour les trois types.
Surveiller le disque avant d’augmenter ces durées.

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
