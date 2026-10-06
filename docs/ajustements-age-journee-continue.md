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
Les règles d’ajustement financier ont été étendues dans la
[version options financières](version-options-financieres.md) : une modification
d’option ajuste le montant dû tout en conservant les paiements encaissés.

Le déploiement ajoute uniquement `Student.fullDay`, booléen désactivé par défaut.
Il ne rejoue aucun seed, ne supprime aucun volume et ne recalcule aucun ancien montant au déploiement.
Les options modifiées ensuite par un utilisateur suivent les nouvelles règles. « Father » est traduit à l'affichage en
« Père » ; les valeurs historiques enregistrées restent conservées.
La sauvegarde complète vérifiée et le retour arrière des images restent exigés.
