# Fiches et documents — Groupe scolaire islamique Abou Oubayda As Sakina

Version à vérifier localement : http://127.0.0.1:5176/.

L'écran **Renseignements et tarifs** présente les six formules de l'école et
permet d'imprimer la fiche ou de l'enregistrer en PDF. Les classes peuvent être
associées à une formule ; sa sélection renseigne les tarifs, que la direction
peut ajuster avant d'enregistrer. Les classes existantes conservent leurs montants.

| Formule | Montant initial | Mensualité |
| --- | ---: | ---: |
| Maternelle | 50 000 F | 15 000 F |
| Élémentaire | 40 500 F | 15 000 F |
| Journée continue | 65 000 F | 35 000 F |
| Daara externat | 60 000 F | 35 000 F |
| Daara internat | 75 000 F | 50 000 F |
| Internat franco-arabe | 100 000 F | 75 000 F |

Les forfaits maternelle et élémentaire comprennent une mensualité. La direction
doit en tenir compte avant de générer les factures mensuelles ; l'application
ne déduit pas automatiquement cette mensualité, car le mois concerné n'est pas
précisé sur la fiche. Les inscriptions à 60 000, 65 000, 75 000 et 100 000 F
n'incluent aucune mensualité, conformément à la confirmation de l'école.
Les fournitures élémentaires de 37 500 F sont en supplément des 40 500 F.

Le dossier élève comprend maintenant la zone de transport, le karaté, les cours
du soir, le contact d'urgence, les informations de santé et les pièces fournies.
Le Daara et les internats accueillent les enfants à partir de six ans.
Les options affichent leur coût mensuel estimé. Leur facturation est séparée :
créer les factures correspondantes depuis **Factures et paiements**.
Les règles de juin et juillet sont rappelées comme consignes, sans automatisme.

Les reçus, factures, bulletins et fiches élève imprimés portent le nom officiel,
le logo, l'adresse et les trois numéros de téléphone fournis par l'école.
Les nouveaux champs sont inclus dans les exports et imports des tables concernées.

Pour la vérification : créer une classe avec chaque formule, inscrire un élève,
modifier ses options et imprimer sa fiche, une facture, un reçu et un bulletin.
Tester aussi le français, l'anglais et l'arabe ainsi que l'affichage sur téléphone.
Le schéma a été appliqué seulement à la base locale isolée `as_sakina_test2`.

## Logo pour l'impression

Asset : `frontend/public/school-logo-print.png`. Le logo fourni a été adapté sur
fond blanc avec l'outil intégré **imagegen**, pour rester lisible à l'impression.
Le résultat doit être validé visuellement par l'école avant diffusion définitive.

Prompt utilisé :

> Use case: precise-object-edit. Edit target: the last attached image, the official school logo on grey. Prepare this SAME logo for printed document letterheads. Keep the white circular arc, stylized white tree/person and green open book shapes, proportions, and exact wording unchanged: GROUPE SCOLAIRE ISLAMIQUE / ABOU OUBAYDA AS SAKINA. Only replace the grey background with pure white and change white emblem and lettering to dark charcoal so they are legible on white paper. Keep green book green. Square canvas, tightly fit complete logo with modest whitespace. No new elements, no reinterpretation, no additional text. This is a faithful document logo adaptation.
