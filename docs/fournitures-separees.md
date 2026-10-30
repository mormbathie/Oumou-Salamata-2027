# Fournitures scolaires : ventes indépendantes

## Utilisation

La page **Activités & équipements → Fournitures scolaires** est accessible à
l’admin, au directeur et au comptable.

1. L’admin ou le directeur renseigne le **catalogue**, avec le nom et le prix
   réel de chaque article. Aucun prix de livre ou cahier n’est inventé ou prérempli.
2. Choisir l’élève et ajouter uniquement les articles achetés, avec leurs
   quantités. Maximum dix articles différents par facture ; plusieurs ventes
   sont possibles pour un même élève.
3. Créer la facture. Cette étape n’enregistre aucun encaissement.
4. Cliquer sur **Enregistrer le paiement** : indiquer le montant réellement
   reçu, même partiel, la date et le moyen de paiement.
5. Imprimer la facture ou le reçu : le détail des articles, quantités et prix
   apparaît sur les deux exemplaires détachables.

La case Fournitures dans le dossier est une indication de besoin. Elle n’ajoute
aucun montant à une nouvelle inscription. La facture d’inscription et la facture
de fournitures possèdent chacune leur statut et leur solde. Le dossier élève
présente également le solde global, qui peut comprendre d’autres factures.

Le prix et le nom sont enregistrés dans chaque vente. Modifier ou désactiver
un article du catalogue ne modifie aucune ancienne facture. Seuls l’admin et le
directeur peuvent modifier le catalogue. Les opérations sont attribuées à leur
auteur. La répétition de la même demande de vente ne crée pas de doublon.

## Encaissements

Les montants nets sont présentés séparément pour les inscriptions, les nouvelles
fournitures et les autres encaissements, avec un total général et les montants
remboursés. Les anciens forfaits regroupés restent dans la catégorie inscription :
aucune estimation n’est présentée comme un encaissement de fournitures certain.
Les remboursements et corrections continuent d’utiliser leurs fonctionnalités
existantes avec les mêmes autorisations.

## Dossiers antérieurs : contrôle obligatoire

La liste **Anciens dossiers à vérifier** signale les factures avec une option
fournitures historique, une information incohérente ou un détail tarifaire absent.
Ce signalement ne prouve ni l’achat d’articles ni la part déjà payée.

Avant de créer une nouvelle vente pour ces élèves, vérifier les reçus et les
achats avec la direction. La confirmation de non-double-facturation et les
références des anciennes factures sont conservées dans le journal de la vente.

Aucune migration ne diminue les factures d’inscription, ne déplace de paiement,
ne crée de remboursement et ne crée automatiquement une facture de fournitures.
Cocher ou décocher l’option sur un ancien dossier ne modifie pas sa facture.

Pour une régularisation financière d’un ancien forfait :

- relever les factures, reçus, éventuels remboursements et achats réels ;
- faire valider les montants et leur répartition par l’admin ou le directeur ;
- préparer un état avant/après avec les références d’origine ;
- appliquer une procédure comptable distincte et validée, sans enregistrer de
  nouveau paiement pour une somme déjà encaissée.

Cette livraison fournit la liste de contrôle et la facturation future. Elle ne
répartit pas les anciens paiements et ne propose pas de bouton de ventilation
automatique. Les dossiers ambigus restent à vérifier.

## Déploiement et retour arrière

Le schéma ajoute uniquement le catalogue `SupplyArticle` et le champ nullable
`Invoice.supplyLines`. Le script de démarrage applique la modification de façon
idempotente, sans mise à jour de données historiques.

Effectuer une sauvegarde vérifiée avant le déploiement. Les tests couvrent
l’inscription indépendante, les règlements partiels et complets, les reprises de
vente, les remboursements, les reçus historiques et la répétition de la migration.
Comparer les empreintes des lignes existantes avant/après la mise à jour.

Le script `deploy/rollback-vps.sh` redémarre les anciennes images en contournant
l’application de leur ancien schéma Prisma. Les nouvelles colonnes et tables
restent présentes ; aucune ancienne sauvegarde n’est restaurée sur la production.
Les ventes éventuellement saisies avec la nouvelle version restent en base.
Si des utilisateurs ont travaillé entre les contrôles, vérifier les différences
avec leurs opérations légitimes avant de conclure à une anomalie.
