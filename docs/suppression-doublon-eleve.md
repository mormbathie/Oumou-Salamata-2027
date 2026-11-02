# Suppression d’un dossier élève en doublon

## Utilisation

Cette action est réservée à l’**administrateur**, dans **Inscriptions & Élèves → Dossier → Supprimer**. Le directeur et le comptable ne peuvent pas l’effectuer, y compris par un appel direct à l’API.

Avant de confirmer, comparez les deux dossiers et conservez celui qui contient les informations et paiements réels. La suppression ne fusionne pas les dossiers et ne transfère aucun paiement vers le dossier conservé.

La confirmation affiche le nom, le matricule, le nombre d’informations liées et les montants facturés, encaissés et remboursés. Renseignez un motif explicite et recopiez exactement le matricule. Une modification du dossier après cette prévisualisation invalide la confirmation : il faut rouvrir celle-ci.

## Effet

Le dossier, ses inscriptions, notes, bulletins, présences, documents, factures, paiements, remboursements, départ et échéanciers/rappels liés sont supprimés. Les fichiers des documents élève sont nettoyés après validation de la transaction. Les montants supprimés ne figurent plus dans les statistiques calculées depuis les transactions ; les anciennes clôtures de caisse restent des états historiques et ne sont pas réécrites.

Le parent et ses documents sont conservés, même s’il n’a plus d’enfant rattaché. Les autres enfants et les comptes utilisateurs ne sont pas supprimés. Aucun remboursement bancaire ou en espèces n’est déclenché.

Pour un élève qui quitte réellement l’école, utiliser **Départ / remboursement** afin de garder son historique, plutôt que de supprimer son dossier.

## Traçabilité et récupération

Une entrée `BusinessAudit` de type `STUDENT_DELETED` conserve l’auteur, la date, le motif et une copie des données supprimées, incluant les transactions et métadonnées des documents. Cette copie est réservée au contrôle et à une récupération assistée ; elle n’est pas une suppression de toutes les données personnelles. Les fichiers binaires supprimés ne sont pas inclus dans cette copie.

Il n’existe pas de bouton d’annulation. Avant la mise en production, utiliser la sauvegarde complète vérifiée prévue par le déploiement. Pour une récupération exceptionnelle, examiner la copie d’audit et la sauvegarde dans un environnement isolé, puis réinsérer uniquement le dossier nécessaire et ses relations après validation. Ne jamais remplacer la base de production par une ancienne sauvegarde. Les documents binaires nécessitent la sauvegarde des fichiers.

Aucune migration de schéma ou modification des élèves existants n’est nécessaire à l’installation de cette fonctionnalité.

## Vérifications

- Tests unitaires : rôles HTTP/service, motif, matricule, prévisualisation périmée, audit avant suppression et nettoyage des fichiers après transaction.
- `backend/test/student-deletion.cjs` : base dédiée uniquement ; suppression effective des relations, remboursement et départ compris, transaction entièrement annulée en cas d’échec, parent et autre enfant inchangés. Intégré à la CI.
- Parcours navigateur local avec données simulées : bouton réservé à l’admin, confirmation, annulation, requête finale et affichage ordinateur/téléphone.
