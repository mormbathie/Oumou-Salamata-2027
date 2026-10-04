# Version École As Sakina — validation locale

Cette version est à vérifier en local avant toute mise à jour du VPS. Le VPS
continue d'utiliser la version indiquée dans `deploy/production.env` ; ne
changez pas ce manifeste pour un simple test local. Les identifiants techniques
Keycloak, les noms des images Docker et les URL `sslip.io` restent inchangés.

## Fonctions à vérifier

- Dans **Mon profil**, changer prénom, nom, téléphone et adresse e-mail. Un
  changement d'adresse remet le statut de vérification à « non vérifié ».
  Changer son mot de passe depuis le lien du profil et se reconnecter avec le
  nouveau mot de passe.
- Pour un enseignant, ouvrir **Mon profil** et présenter le QR code personnel au
  contrôleur. Le premier scan du jour enregistre l'arrivée et le second le
  départ. L'historique affiche l'heure, le retard et le contrôleur qui a pointé.
- Dans **Pointage des professeurs**, régler les jours de repos, l'heure de début
  et les jours fériés avant de clôturer les absences. La clôture est refusée pour
  un jour férié ou de repos. Vérifier la caméra sur un téléphone en HTTPS ou sur
  `localhost` : l'accès caméra dépend du contexte sécurisé du navigateur.
- Dans **Import/export**, exporter le classeur Excel complet ou un CSV d'une
  table, puis prévisualiser un import. L'import ajoute les identifiants absents
  dans une transaction et préserve les lignes existantes. Il couvre les 16
  tables scolaires listées dans l'écran, sans les comptes Keycloak, les secrets
  des QR codes ou le contenu binaire des documents. Limites : 10 Mo par fichier,
  5 000 lignes par feuille à l'import et 50 000 à l'export. Une sauvegarde de
  base reste nécessaire avant tout import réel.
- Créer un élève et son inscription, créer une facture et enregistrer un
  paiement. Les fiches et le reçu indiquent le nom de l'agent authentifié qui
  a réalisé ces actions. Les anciennes fiches n'ont pas d'agent historique.

## Vérification des adresses e-mail

La saisie vérifie la syntaxe d'une adresse ; seul le lien envoyé par Keycloak
permet d'en confirmer la possession. Aucun service SMTP n'est encore configuré.
Dans **Mon profil**, « Envoyer un lien de vérification » deviendra opérationnel
après configuration SMTP du realm Keycloak avec les paramètres et identifiants
fournis par le futur prestataire. Tester l'envoi vers une adresse réelle avant
d'activer la vérification obligatoire ou l'authentification à deux facteurs.
Cette version n'active pas encore le double facteur. Les nouveaux comptes sont
créés avec `emailVerified=false` ; un compte déjà marqué vérifié dans Keycloak
conserve son état jusqu'à ce que son adresse soit modifiée.

Pour tester avec les conteneurs locaux, démarrer les services avec le Compose
local, générer le client Prisma dans `backend`, puis appliquer le schéma sur
une base locale de test avec `npx prisma db push`. Ne pas exécuter cette commande
sur le VPS dans cette phase. La mise en production nécessitera une sauvegarde
vérifiée et une revue du changement de schéma, puisque le démarrage du backend
applique actuellement `prisma db push`.
