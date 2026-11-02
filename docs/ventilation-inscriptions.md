# Synthèse des inscriptions : répartition par rubrique

La page **Comptabilité → Synthèse des inscriptions** affiche une répartition
par inscription, mensualité incluse, tenue, badge, infirmerie, APE, etc.
L’accès reste réservé aux comptes ADMIN, DIRECTEUR et COMPTABLE.
Le formulaire d’inscription ne change pas et aucun dossier n’est à ressaisir.

## Une estimation explicitement identifiée

Les paiements existants sont globaux par facture : aucune affectation comptable
par rubrique n’est enregistrée. La mention **Ventilation estimée au prorata**
est donc toujours affichée et imprimée. Les sommes attendues ne sont jamais
présentées comme des encaissements réels.

Les barèmes de la synthèse sont définis dans
`backend/src/school/registration-allocation.ts`. Le frontend affiche uniquement
les résultats calculés par le serveur. Maternelle : 50 000 F (TPS, PS, MS, GS).
Élémentaire : 40 000 F (CI, CP, CE1), avec la rame de papier à 2 000 F.
La présentation informative de ce dernier barème est également corrigée :
il n’y a plus une rame à 2 500 F accompagnée d’un ajustement négatif de 500 F.
Aucune facture historique ni aucun tarif de classe n’est modifié.

Pour un dossier dont le forfait peut être reconstitué, l’encaissé net admissible
est réparti proportionnellement aux rubriques. Les calculs intermédiaires
utilisent des entiers exacts (`BigInt`), puis la méthode des plus forts restes.
Les égalités sont départagées selon l’ordre fixe des rubriques. La somme finale
correspond donc exactement au montant ventilé, en FCFA entiers.

Les nombres d’élèves sont dédupliqués par rubrique. Un élève non facturé ne
crée pas une créance théorique par rubrique : son estimation non facturée reste
présentée séparément comme auparavant.

## Filtres et périmètre

L’année, le cycle, la classe, les options actuelles et le statut s’appliquent à
l’ensemble des élèves, totaux et rubriques. Aucun calcul n’est limité à la partie
visible de la liste. Le sélecteur **Rubrique affichée** limite seulement les
lignes du tableau ; son sous-total est clairement distingué des totaux de toutes
les inscriptions filtrées.

L’année est celle des factures. Tous leurs paiements actifs sont pris en compte,
quelle que soit leur date d’encaissement. Il n’y a pas de filtre de période.

Les options utilisées pour reconstituer un forfait proviennent de la référence
facturée sauvegardée sur la facture, et non des cases actuelles du dossier.
Les filtres Karaté/Journée continue conservent leur sens antérieur : options de
la fiche actuelle de l’élève, indiqué dans l’interface.

## Séparations de facturation et cas non ventilables

Les factures de fournitures séparées, kimono, karaté mensuel et scolarité mensuelle
sont exclues. Leurs encaissements sont rappelés séparément, hors des totaux de
l’inscription, pour les mêmes élèves et la même année.

L’ancien supplément de fournitures élémentaires à 37 500 F n’est reconnu que
si la référence facturée le documente et si le total reconstitué correspond
exactement à la facture. Une facture marquée `suppliesSeparate` ne reçoit
jamais ce supplément. Les achats parallèles ne sont pas réintégrés au forfait.

Les cas suivants restent dans **À vérifier — montant non ventilé**, avec leur
motif et leurs montants réellement enregistrés :

- tarif différent du forfait connu, remise, exonération ou exclusion sans détail ;
- programme ou niveau non couvert par les barèmes validés ;
- forfait journée continue dont la composition n’est pas documentée : on ne
  suppose pas que la mensualité ordinaire de 15 000 F y est incluse ;
- référence tarifaire absente ou illisible, sauf forfait ordinaire exact sans
  aucune option actuelle pouvant contredire cette reconnaissance ;
- plusieurs factures d’inscription pour le même élève et la même année ;
- écart entre les paiements actifs et le montant encaissé mémorisé sur la facture,
  ou solde incohérent.

Aucune répartition de remise par rubrique n’est inventée. Un montant facturé nul
reste nul, sans reconstruire de frais théoriques à payer. Les niveaux CE2/CM1/CM2
ne reçoivent pas automatiquement le barème CI/CP/CE1. En production lors de
l’analyse, aucun de ces trois niveaux n’était configuré.

## Remboursements, annulations et trop-perçus

Les paiements et factures annulés ne sont pas comptés. Les remboursements
réduisent l’encaissé net. Ils ne rouvrent pas une dette : le reste à payer reste
le solde de la facture. Le tableau distingue donc une colonne de remboursements.
La répartition du reste à payer utilise les capacités restantes après ventilation
du net ; les remboursements sont le résidu réconcilié, sans valeurs négatives.

Un trop-perçu net n’est jamais réparti au-delà du forfait, même pour un dossier
non ventilable. Il est présenté séparément. Les remboursements portant d’abord
sur un trop-perçu sont eux aussi distingués des remboursements du forfait.

Le contrôle permanent est :

**Net ventilé + net non ventilé + trop-perçu net = net des inscriptions filtrées.**

## Vérifications et livraison

La consultation s’exécute dans une transaction PostgreSQL `REPEATABLE READ` et
`READ ONLY`. Aucune migration de schéma et aucune écriture de données ne sont
nécessaires. Les tests couvrent les forfaits payés par cycle, paiements partiels,
arrondis, remises/exonérations non détaillées, achats séparés, annulations,
remboursements, trop-perçus et filtres combinés. Des empreintes de toutes les
tables de la base de test sont comparées avant/après consultation.

Le workflow existant vérifie ces tests avant de publier les images et de
mettre à jour le VPS. Une sauvegarde vérifiée précède le déploiement. Le retour
arrière utilise les images précédentes via `deploy/rollback-vps.sh`, sans
restauration d’une ancienne base sur les données actuelles.
