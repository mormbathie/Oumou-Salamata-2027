# Départs d’élèves et remboursements

Version validée en local avant publication.

Dans **Comptabilité → Départs et remboursements**, l’administrateur peut
conserver le dossier d’un élève ayant quitté l’établissement et enregistrer
les sommes réellement rendues à sa famille. Le directeur et le comptable
peuvent consulter les opérations et imprimer les justificatifs.

## Enregistrer un départ

1. Rechercher et sélectionner l’élève.
2. Renseigner la date du départ et son motif.
3. Confirmer le départ.

Le dossier porte la mention **A quitté l’établissement**. Les factures,
paiements et documents restent conservés. Le départ arrête les nouveaux
pointages et la génération automatique de nouvelles mensualités. Les
inscriptions des années passées restent conservées ; celles de l’année en
cours et des années futures sont marquées comme interrompues.

Les dettes existantes ne sont pas annulées et le départ ne crée pas de
remboursement automatique. Les dossiers ne peuvent plus être supprimés depuis
l’application. Un dossier parti ne peut pas être réactivé par la simple
modification de ses informations ou une réinscription : un éventuel retour
nécessitera un parcours de réadmission dédié.

## Enregistrer un remboursement

1. Sélectionner l’élève et le paiement d’origine.
2. Vérifier le montant déjà remboursé et le montant encore disponible.
3. Renseigner le montant, la date réelle, le moyen de remboursement,
   le bénéficiaire et un motif précis.
4. Pour une somme déjà rendue avant sa saisie dans l’application, choisir
   **Déjà effectué — régularisation**.
5. Confirmer que la somme a bien été remise, puis valider l’enregistrement.

**L’application enregistre une opération déjà réalisée : elle n’effectue
aucun virement et ne remet pas d’argent automatiquement.**

Un paiement peut faire l’objet de plusieurs remboursements partiels, dans la
limite de son montant initial. Une demande répétée après une réponse réseau
perdue retrouve la même opération ; une nouvelle demande utilisant un ancien
solde est refusée. L’administrateur doit alors actualiser la situation.

Le paiement et la facture d’origine restent inchangés. Un remboursement ne
rouvre pas la dette de la facture. Les écritures remboursées ne peuvent plus
être annulées ou corrigées par l’ancien parcours de correction des paiements.
Les remboursements validés sont conservés sans fonction de modification ou
suppression dans cette version. En cas d’erreur de remboursement, ne pas
créer une autre opération au hasard : une écriture compensatrice devra être
préparée et validée, sans effacer l’historique.

Une date future, antérieure au paiement, ou appartenant à une journée de caisse
déjà clôturée est refusée. La régularisation ne contourne pas une clôture ;
un cas historique sur caisse clôturée doit faire l’objet d’un traitement
validé séparément.

## Comprendre les montants

- **Encaissements bruts** : les sommes reçues des familles.
- **Remboursements** : les sommes rendues et enregistrées.
- **Encaissements nets** : les encaissements bruts moins les remboursements.

Le tableau de bord utilise la date effective de chaque paiement et de chaque
remboursement, selon l’heure de Dakar. Une période peut présenter un net négatif
si l’école rembourse aujourd’hui un paiement reçu auparavant. Les statistiques
par année scolaire rattachent le remboursement à l’année de sa facture.

La synthèse des inscriptions distingue aussi le brut, les remboursements et
le net. La situation « payée » reste celle de la facture d’origine : elle ne
signifie pas qu’aucune somme n’a ensuite été remboursée. La caisse distingue
les entrées et remboursements par moyen de paiement, et déduit les sorties en
espèces du montant net attendu. Ce calcul ne remplace pas un suivi de fonds de
caisse initial, qui n’est pas ajouté dans cette version.

## Justificatif

L’historique indique la référence, le bénéficiaire, le motif, la date et le nom
de l’administrateur. **Imprimer le justificatif** produit une page A4 avec deux
exemplaires à découper : parent et comptabilité. Un motif très long est abrégé
sur le justificatif ; sa version complète reste dans l’historique.

## Les deux dossiers supprimés en production

Ils ne sont pas recréés automatiquement par l’installation de cette version.
Leur récupération reste une intervention distincte, soumise à validation :

- copie récente et sauvegarde complète vérifiée ;
- récupération ciblée depuis la sauvegarde antérieure à la suppression ;
- conservation des parents existants et vérification des références uniques ;
- enregistrement des départs et remboursements déjà effectués dans les nouveaux registres ;
- contrôle des montants nets et du retour arrière, sans restauration globale d’une ancienne base.

## Vérifications techniques

Le schéma ajoute uniquement les tables `Refund` et `StudentDeparture`.
Les clés étrangères interdisent de supprimer les paiements remboursés ou les
élèves partis par une suppression en cascade. Aucun seed ni transfert de
données de production n’est exécuté au démarrage.

Les tests couvrent les droits, les remboursements partiels et complets, les
répétitions et demandes concurrentes, la conservation des transactions,
la caisse, les totaux nets, les départs, les dettes conservées et l’audit.
Les nouvelles écritures sont incluses dans les sauvegardes complètes PostgreSQL.
Le transfert Excel/CSV existant ne permet pas d’importer ces registres : leurs
contrôles métier doivent être respectés.
