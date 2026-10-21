# Importer et exporter les données de l’école

La page **Import / export** est réservée aux administrateurs.

## Télécharger un fichier

1. Choisir **Toutes les tables métier** ou **Une seule table**.
2. Choisir le format.
3. Cliquer sur **Télécharger**.

**Excel mis en page (.xlsx)** contient le logo et les coordonnées de l’école,
un sommaire avec des liens, des titres français, des couleurs alternées, des
filtres et des en-têtes figés. Les dates et les montants en F CFA sont formatés.
Les noms des élèves, parents et classes accompagnent les identifiants liés.
Chaque table possède sa propre feuille. Les colonnes techniques restent
présentes à droite pour permettre une réimportation ; utiliser le défilement
horizontal pour les consulter. Un export complet est un classeur de données,
pas une facture ni un état financier destiné à être imprimé sur une page.

**CSV (.csv)** contient uniquement les données, sans logo, couleur ni mise en
page : ce format ne peut pas conserver ces éléments. Pour toutes les tables,
le téléchargement est une **archive ZIP** avec un CSV par table et un fichier
explicatif. Extraire les fichiers avant de les ouvrir ou de les importer.
Les CSV utilisent UTF-8 avec BOM, des virgules et les noms techniques des champs.
Les valeurs pouvant être interprétées comme des formules sont protégées ;
l’import de l’application retire cette protection de façon réversible.

## Réimporter un export

Conserver les feuilles, colonnes et lignes techniques masquées du classeur.
Les titres visibles peuvent être en français : l’application retrouve les
champs grâce aux informations techniques conservées dans le fichier.

Sélectionner le fichier, puis **Prévisualiser**. Pour un CSV, choisir aussi la
table correspondante. Vérifier le récapitulatif avant de confirmer l’import.
L’import ajoute les identifiants absents et conserve les enregistrements
existants. Il ne sert pas à modifier les données déjà enregistrées. Une relation
invalide provoque l’annulation de l’import entier.

Les remboursements, départs, clôtures de caisse, échéanciers, relances et journal
d’audit sont exportables **en consultation uniquement**. Leurs feuilles sont
signalées et ignorées à la réimportation d’un classeur complet ; leurs CSV ne
sont pas importables. Les comptes de connexion, secrets, photos de profil et
fichiers joints ne sont pas inclus.

## Volumes pris en charge

Un export est limité à 50 000 lignes par table, 100 000 lignes au total et un
million de cellules estimées. Un seul export peut être préparé à la fois par
instance du serveur. L’import conserve ses limites de 10 Mo et 5 000 lignes.
Pour des volumes supérieurs, exporter séparément les tables ou demander une
extraction adaptée. Les fichiers téléchargés contiennent des données privées :
les partager uniquement avec les personnes autorisées.
