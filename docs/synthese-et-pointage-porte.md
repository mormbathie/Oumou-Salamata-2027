# Synthèse des inscriptions et pointage à la porte

## Calculer les montants des inscriptions

La page **Synthèse des inscriptions** est accessible à l’administration, au directeur et au comptable, y compris depuis le menu mobile.

Choisir l’année, éventuellement une classe, puis **Avec** ou **Sans** Karaté et Journée continue. Les deux filtres se combinent : **Sans Karaté** et **Sans Journée continue** donnent les élèves sans aucune de ces deux options. Choisir ensuite une situation : payée, partielle, impayée, non soldée ou non facturée.

La page affiche le nombre d’élèves sélectionnés, le total facturé, le total encaissé et le reste à payer. Ces montants viennent exclusivement des factures d’inscription non annulées de l’année sélectionnée. Une correction de paiement déjà enregistrée est donc prise en compte. Les mensualités et les ventes séparées de Kimono ne sont pas ajoutées. Les élèves n’ayant aucune facture active sont visibles comme **Non facturée** ; leur tarif théorique est une estimation distincte, jamais ajouté à la dette réelle.

Les filtres d’options concernent les **options actuelles de la fiche élève**, même lorsqu’une année ancienne est consultée. Ils ne reconstituent pas les anciennes options. La liste conserve les élèves sans classe ayant une facture dans l’année, sauf si une classe précise est sélectionnée. Plusieurs factures d’inscription d’un même élève sont signalées et leurs montants réels sont additionnés, sans supprimer d’écriture.

**Imprimer la synthèse** produit un document avec les filtres, les totaux et la liste détaillée. La page ne modifie aucune facture et ne déclenche aucun paiement.

## Préparer le QR commun à la porte

À faire par un administrateur ou le directeur dans **Pointage des professeurs → QR commun à la porte** :

1. Se placer physiquement à l’entrée de l’école.
2. Autoriser la localisation précise du téléphone et toucher **Utiliser ma position à la porte**. Ne pas utiliser la position du domicile.
3. Vérifier latitude/longitude et choisir un périmètre adapté (100 mètres par défaut, autorisé entre 50 et 300 mètres).
4. Cocher **Activer le pointage personnel** puis **Enregistrer**.
5. **Imprimer le QR de la porte** et afficher la feuille à l’entrée.

Le pointage personnel reste désactivé tant que cette configuration n’a pas été réalisée. Le pointage par contrôleur fonctionne indépendamment.

**Remplacer le QR code** rend les anciens exemplaires invalides : réimprimer ensuite l’affiche. La modification de configuration est tracée au nom du responsable.

## Badger avec son compte professeur

Le QR est commun à tous les professeurs ; chacun pointe uniquement **son propre compte**.

- Ouvrir l’affiche avec la caméra du téléphone, se connecter si nécessaire, ou utiliser **Mon pointage → Scanner le QR de la porte** dans l’application.
- Choisir **Mon arrivée** et toucher **Confirmer mon arrivée**. Autoriser la localisation précise.
- Au départ, scanner de nouveau, choisir **Mon départ** et confirmer.

L’ouverture du lien ou la lecture du QR n’enregistre rien avant confirmation. L’heure provient du serveur. Un double scan de l’arrivée ne devient pas un départ ; une confirmation répétée ne remplace pas la première heure. Un départ sans arrivée est refusé. Le calendrier de repos, les jours fériés et les règles de retard existantes s’appliquent. Les heures sont consultables dans **Mes pointages** et dans le profil.

## Pointage par le contrôleur

Le contrôleur conserve le scan de la carte personnelle de chaque professeur. Il sélectionne désormais explicitement **Arrivée** ou **Départ**, puis scanne la carte. Ce recours reste disponible si le professeur n’a pas de téléphone, refuse la localisation ou ne peut pas obtenir une position suffisamment précise.

## Contrôle de proximité et limites

Une connexion Internet et l’autorisation de localisation sont nécessaires. Le serveur vérifie la distance à l’école et la précision déclarée : une précision insuffisante ou une position éloignée est refusée. Les coordonnées du professeur ne sont pas enregistrées dans le pointage ; seuls les horaires et l’auteur sont conservés. La mesure est demandée uniquement lors de la confirmation, sans suivi permanent.

La localisation d’un navigateur n’est pas une preuve inviolable : un téléphone modifié peut fournir de fausses coordonnées. Ce contrôle limite le pointage à distance ordinaire, mais ne garantit pas une présence physique contre la fraude volontaire. Pour une exigence plus forte, conserver le contrôle humain ou prévoir une borne à l’école. Ne pas présenter le QR fixe comme une protection absolue.

Références : [localisation et autorisation du navigateur](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [précision de la position](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/accuracy).

## Déploiement et données

Cette version ajoute uniquement une table de configuration de la porte ; elle ne réécrit ni les élèves, ni les factures, ni les paiements existants. Le schéma est ajouté sans suppression. Une sauvegarde précède le déploiement et les images précédentes restent disponibles pour le rollback. La position de l’école n’est pas inventée ou activée par défaut.
