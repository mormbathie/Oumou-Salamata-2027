# Âge et journée continue

La date de naissance doit être valide et ne pas être dans le futur. L'âge
minimum recommandé ne bloque plus la création, la modification ou la
réinscription d'un élève. Lorsqu'un minimum est défini sur la formule,
l'interface et la fiche imprimée indiquent la dérogation.

En maternelle (TPS, PS, MS, GS), la journée continue est une option individuelle.
Elle donne une inscription de 65 000 FCFA et une mensualité de 35 000 FCFA.
La classe et les élèves sans cette option conservent leurs propres tarifs.
L'option est enregistrée sur la fiche élève et prise en compte lors de la
création de sa facture initiale et de futures factures mensuelles collectives.
À l’enregistrement de l’option, la facture d’inscription standard de l’année
courante est ajustée si elle est entièrement impayée et sans aucun paiement.
L’activation remplace 50 000 F par 65 000 F pour une classe à ce tarif initial ;
la désactivation rétablit le tarif de la classe. Les factures partiellement ou
entièrement payées, les montants personnalisés et les mensualités déjà créées
sont conservés. L’option et cet ajustement sont enregistrés dans une transaction.
Le contrôle des paiements protège aussi contre un encaissement simultané.

Le déploiement ajoute uniquement `Student.fullDay`, booléen désactivé par défaut.
Il ne rejoue aucun seed, ne supprime aucun volume et ne met à jour aucun ancien
montant, paiement, parent ou dossier. « Father » est traduit à l'affichage en
« Père » ; les valeurs historiques enregistrées restent conservées.
La sauvegarde complète vérifiée et le retour arrière des images restent exigés.
