# Options et encaissements — version locale du 6 octobre 2026

## Architecture examinée

React utilise les pages Élèves, Classes, Factures et Dashboard. NestJS expose
leurs API ; Prisma stocke les élèves, inscriptions, factures et paiements dans
PostgreSQL. Les reçus existants et l’identité du comptable sont réutilisés.
L’installation utilise `prisma db push`, sans historique Prisma Migrate.

Auparavant, le calcul d’inscription utilisait le tarif de classe ou le forfait
Journée continue. Transport et Karaté étaient enregistrés sans ajout au total.
Le dashboard utilisait le cumul `paidAmount` des factures de l’année courante.

## Règles confirmées

- Tarif standard publié de l’élémentaire : **40 000 F**. L’ancien tarif standard
  CI à 40 500 F est corrigé pour les nouveaux calculs, sans modifier ses anciennes
  factures. Les tarifs personnalisés des classes restent respectés.
- Fournitures : option individuelle de l’élémentaire, **37 500 F** à l’inscription.
  Elle est distincte de la checklist « pièces déjà fournies ».
- Journée continue en maternelle : **65 000 F au total avant les autres options**,
  mensualité **35 000 F**. Ce montant remplace le forfait de base.
- Transport : ajout à l’inscription de **10 000 / 15 000 / 20 000 F** selon la zone.
- Karaté : ajout de **2 000 F à l’inscription**, confirmé par l’utilisateur.
  Les mensualités de Karaté sont des factures séparées de **2 000 F/mois**.
- Cours du soir : restent séparés de l’inscription, confirmé par l’utilisateur.
- Kimono : facture séparée de **6 000 F**, jamais ajouté à l’inscription.
- TPS et PS : Karaté et Kimono refusés par les API ; Karaté masqué dans le formulaire.

Le calcul facturé est défini dans `backend/src/school/school-options.ts`.
Les formulaires demandent une estimation à `POST /students/fee-quote`, plutôt
que de recalculer le total financier dans le navigateur. Pour une modification,
l’estimation affiche aussi le montant dû réel de la facture, le déjà encaissé
et le solde prévisionnel, y compris pour une ancienne facture personnalisée.

## Modification d’une inscription existante

Seule une modification effective d’option payante applique une différence de
prix à la facture d’inscription de l’année courante. Un simple changement de
nom ou une sauvegarde identique n’ajoute aucun frais. Aucun recalcul global
n’est lancé au démarrage ou lors de la migration.

Exemple : 100 000 F dus, 80 000 F déjà reçus, ajout Fournitures :
**137 500 F dus, 80 000 F reçus, 57 500 F de solde**. Les lignes de paiement,
numéros de reçu, références, dates et identité du comptable restent identiques.

Les nouvelles factures conservent les options réellement facturées. Sur une ancienne
facture, les anciens indicateurs Transport et Karaté ne sont pas considérés comme
des frais d’inscription déjà facturés : leur suppression ne réduit pas arbitrairement le
montant historique. Seuls les changements effectués sont pris en compte. Pour un ancien forfait
Journée continue, l’option est reconnue dans la référence initiale lorsque le
montant est exactement 65 000 F et l’option déjà active ; les montants
personnalisés ne sont pas convertis automatiquement.

Les modifications sont transactionnelles avec verrouillage de l’élève et de
ses factures. L’enregistrement d’un paiement simultané ne perd aucun versement.
Une réduction sous le montant déjà payé est refusée : aucune suppression ou
création automatique de remboursement. Plusieurs factures d’inscription pour
la même année provoquent un refus de modification tarifaire, pour éviter une
répartition financière arbitraire. Si aucune facture n’existe, l’option est
conservée sans inventer automatiquement une ancienne créance.

## Pages supplémentaires

**Ventes de Kimono** : recherche, contrôle d’éligibilité, facture séparée,
versement daté, mode de paiement, référence, historique et reçus imprimables.
Un élève éligible peut acheter sans pratiquer le Karaté.

**Mensualités Karaté** : seuls les élèves actifs, inscrits dans l’année courante,
éligibles et avec Karaté actif sont proposés. Choix du mois au format AAAA-MM,
création/retrouvaille de la facture, versement et reçus. La période de facturation
reste consultable grâce au filtre du mois. Les anciens paiements restent aussi
accessibles dans la page générale Factures et Paiements.

Hypothèse de prévention des doublons : **un Kimono par élève et année scolaire**,
et **une facture Karaté par élève, année scolaire et mois**. Les demandes
simultanées retrouvent la même facture. Un second versement dépassant son solde
est refusé par l’enregistrement de paiement existant.

Les catégories sont `KIMONO` et `KARATE`, avec le type existant `OTHER` afin de
ne pas modifier l’énumération historique. Les recettes restent identifiables
séparément. Une facture de 2 000 F à l’inscription Karaté ne vaut pas paiement
automatique d’une mensualité : ce sont les deux tarifs demandés distincts.

## Dashboard et filtres

La carte Encaissements réels affiche aujourd’hui par défaut. Date précise,
plage inclusive et Tout/global sont disponibles. Le calcul additionne les
lignes `Payment.amount`, filtrées sur `Payment.paymentDate`, à l’heure de
**Dakar (Africa/Dakar)**, avec distinction des catégories. Les indicateurs
existants de l’année courante et leur taux de recouvrement sont conservés.
Les élèves peuvent être filtrés par Journée continue Oui/Non avec les filtres
existants de classe et de recherche.

## Schéma et sécurité des données

Ajouts uniquement :

- `Student.supplies`, booléen `false` par défaut ;
- `Invoice.registrationOptions`, référence des options réellement facturées, nullable ;
- `Invoice.category`, nullable ;
- `Invoice.billingKey`, nullable avec index unique. Les anciennes valeurs nulles
  ne se heurtent pas à cette contrainte.

`backend/prisma/patches/20261006-financial-options.sql` contient uniquement des
ajouts de colonnes et d’index. Le script `apply-financial-options.cjs` les applique
transactionnellement avant le `db push` de l’entrée Docker, car Prisma avertit
sinon sur l’ajout d’une contrainte unique à une table existante. Aucun
`--accept-data-loss`, seed, effacement de volume ou réécriture de tarif historique.
Le script est idempotent ; une base neuve est initialisée par Prisma.

La production n’est pas modifiée par ces essais locaux. Avant publication,
conserver la sauvegarde obligatoire et les contrôles de `deploy-vps.sh` ; le
rollback des anciennes images conserve les données et les nouvelles colonnes.
Ne pas pousser cette version sur `main` avant validation locale : le pipeline
actuel déploie automatiquement un push validé sur cette branche.

## Vérifications et commandes locales

Les tests d’intégration nécessitent une API locale reliée à une base isolée dont
le nom contient `_test`. Ils refusent les hôtes externes et suppriment uniquement
leurs propres fiches QA. Les secrets ne doivent jamais être committés.

```bash
npm test --prefix backend -- --runInBand
npm run build --prefix backend
npm run build --prefix frontend
python3 -m unittest discover -s deploy/tests -v
```

Depuis `backend/`, définir localement `TEST_API_URL`, `TEST_DATABASE_URL`,
`TEST_USERNAME` et `TEST_PASSWORD`, puis :

```bash
node test/financial-options.e2e.cjs
node test/additive-financial-patch.cjs
```

Les scénarios couvrent les tarifs simples/combinés, les restrictions TPS/PS,
les Fournitures après un paiement, le rejet d’une réduction sous l’encaissé,
les doubles requêtes simultanées, Kimono indépendant, les quatre périodes du
dashboard, les catégories et la préservation des anciens paiements.

## Résultats de validation

- 62 tests unitaires, 12 suites : réussis.
- Builds NestJS et React : réussis.
- Scénarios d’intégration couvrant les 17 cas demandés : réussis sur
  `as_sakina_test2`, dont deux paiements simultanés et deux modifications
  simultanées des Fournitures.
- Patch additif relancé deux fois : lignes existantes identiques, aucune
  dérive du schéma Prisma.
- Quatre scénarios de déploiement/rollback : réussis.
- Vérification Chrome : devis Fournitures, options masquées en PS, filtres,
  pages supplémentaires, largeur mobile et FR/EN/AR : réussie.

La version locale est accessible sur http://127.0.0.1:5176. La validation locale décrite ci-dessus précède la publication sur `main`.
La mise en production autorisée utilise le workflow GitHub, la sauvegarde
obligatoire et les contrôles de conservation des données.

## Fichiers modifiés et ajoutés

- `backend/entrypoint.sh`
- `backend/prisma/apply-financial-options.cjs`
- `backend/prisma/patches/20261006-financial-options.sql`
- `backend/prisma/schema.prisma`
- `backend/src/classes/classes.service.ts`
- `backend/src/dashboard/collection-period.spec.ts`
- `backend/src/dashboard/collection-period.ts`
- `backend/src/dashboard/dashboard.controller.ts`
- `backend/src/dashboard/dashboard.service.ts`
- `backend/src/finances/finances.controller.ts`
- `backend/src/finances/finances.service.ts`
- `backend/src/school/eligibility.spec.ts`
- `backend/src/school/school-options.spec.ts`
- `backend/src/school/school-options.ts`
- `backend/src/students/students.controller.ts`
- `backend/src/students/students.service.spec.ts`
- `backend/src/students/students.service.ts`
- `backend/test/additive-financial-patch.cjs`
- `backend/test/financial-options.e2e.cjs`
- `docs/ajustements-age-journee-continue.md`
- `docs/version-options-financieres.md`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout.tsx`
- `frontend/src/components/RegistrationFees.tsx`
- `frontend/src/components/SchoolOptions.tsx`
- `frontend/src/config/school.ts`
- `frontend/src/i18n/catalog.json`
- `frontend/src/pages/ActivityPaymentsPage.tsx`
- `frontend/src/pages/ClassesPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/StudentsPage.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/utils/schoolDocuments.ts`
