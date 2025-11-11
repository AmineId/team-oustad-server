# Configuration Email pour Team Fitness

Ce guide explique comment configurer le service d'envoi d'emails pour les notifications de configuration de compte.

## 📧 Configuration SMTP

### Variables d'environnement

Ajoutez ces variables dans vos fichiers `.env`, `.env.preprod`, et `.env.prod` :

```env
# Configuration Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-application

# URL Frontend (pour les liens dans les emails)
FRONTEND_URL=http://localhost:3000
```

### Options de configuration SMTP populaires

#### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=mot-de-passe-application
```

**Important** : Pour Gmail, vous devez créer un "Mot de passe d'application" :
1. Allez dans votre compte Google
2. Sécurité → Validation en deux étapes (activez-la si nécessaire)
3. Mots de passe d'application → Créer un mot de passe
4. Utilisez ce mot de passe dans `SMTP_PASS`

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=votre-clé-api-sendgrid
```

#### Mailtrap (pour tests)
```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=votre-username-mailtrap
SMTP_PASS=votre-password-mailtrap
```

#### Office 365 / Outlook
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@outlook.com
SMTP_PASS=votre-mot-de-passe
```

#### Amazon SES
```env
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-smtp-username
SMTP_PASS=votre-smtp-password
```

## 🚀 Utilisation de l'API

### 1. Envoyer un email de configuration (Admins/Owners)

Permet d'envoyer un email à un utilisateur pour qu'il configure son mot de passe.

**Endpoint** : `POST /auth/send-setup-email`

**Authentification** : Requise (Bearer token)

**Permissions** :
- **Owners** : Peuvent envoyer à n'importe quel utilisateur
- **Admins** : Peuvent envoyer uniquement aux membres de leur salle
- **Members** : Peuvent envoyer uniquement à eux-mêmes

#### Par email
```bash
curl -X POST http://localhost:3000/auth/send-setup-email \
  -H "Authorization: Bearer votre-token-jwt" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nouveau-membre@example.com"
  }'
```

#### Par userId
```bash
curl -X POST http://localhost:3000/auth/send-setup-email \
  -H "Authorization: Bearer votre-token-jwt" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 5
  }'
```

**Réponse** :
```json
{
  "message": "Email de configuration envoyé à nouveau-membre@example.com",
  "user": {
    "id": 5,
    "email": "nouveau-membre@example.com",
    "fullName": "Jean Dupont",
    "gym": "Fitness Pro"
  }
}
```

### 2. Configurer le mot de passe (Utilisateur)

Une fois que l'utilisateur a reçu l'email avec le code, il peut créer son mot de passe.

**Endpoint** : `POST /auth/setup-password`

**Authentification** : Non requise (public)

```bash
curl -X POST http://localhost:3000/auth/setup-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nouveau-membre@example.com",
    "token": "123456",
    "password": "monNouveauMotDePasse123"
  }'
```

**Réponse** :
```json
{
  "message": "Mot de passe créé avec succès"
}
```

### 3. Se connecter

Après avoir configuré le mot de passe, l'utilisateur peut se connecter.

**Endpoint** : `POST /auth/login`

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nouveau-membre@example.com",
    "password": "monNouveauMotDePasse123"
  }'
```

## 📋 Workflow complet

### Scénario : Création d'un nouveau membre

1. **Admin/Owner crée un utilisateur**
   ```bash
   POST /users
   {
     "email": "jean@example.com",
     "fullName": "Jean Dupont",
     "role": "member",
     "gymId": 1
   }
   ```

2. **Admin/Owner envoie l'email de configuration**
   ```bash
   POST /auth/send-setup-email
   {
     "email": "jean@example.com"
   }
   ```

3. **L'utilisateur reçoit un email** avec :
   - Un code à 6 chiffres (ex: 123456)
   - Un lien direct vers la page de configuration
   - Le lien expire dans 24 heures

4. **L'utilisateur configure son mot de passe**
   ```bash
   POST /auth/setup-password
   {
     "email": "jean@example.com",
     "token": "123456",
     "password": "motDePasse123"
   }
   ```

5. **L'utilisateur se connecte**
   ```bash
   POST /auth/login
   {
     "email": "jean@example.com",
     "password": "motDePasse123"
   }
   ```

## 🎨 Personnalisation des emails

Les emails sont envoyés en HTML avec un design responsive. Vous pouvez personnaliser :

1. **Logo et couleurs** : Modifiez le fichier `services/emailService.js`
2. **Texte du message** : Changez le contenu HTML dans `sendAccountSetupEmail()`
3. **Expiration du token** : Modifiez la durée (actuellement 24h)

## 🧪 Tests

### Test avec Mailtrap (recommandé pour dev)

1. Créez un compte sur [Mailtrap.io](https://mailtrap.io/)
2. Obtenez vos credentials SMTP
3. Configurez dans `.env` :
   ```env
   SMTP_HOST=smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_USER=votre-username
   SMTP_PASS=votre-password
   ```
4. Tous les emails seront capturés par Mailtrap (pas envoyés réellement)

### Test avec Gmail

1. Activez la validation en deux étapes
2. Créez un mot de passe d'application
3. Configurez dans `.env`
4. Testez l'envoi d'un email

## 🔒 Sécurité

### Bonnes pratiques

✅ **Tokens sécurisés** : Code à 6 chiffres aléatoires  
✅ **Expiration** : 24 heures pour les emails de configuration  
✅ **Usage unique** : Les tokens ne peuvent être utilisés qu'une seule fois  
✅ **Nettoyage** : Les anciens tokens sont supprimés avant d'en créer un nouveau  
✅ **Permissions** : Vérification des droits avant l'envoi  

### Recommandations production

1. **Utilisez un service SMTP professionnel** (SendGrid, Amazon SES, Mailgun)
2. **Configurez SPF, DKIM et DMARC** pour éviter le spam
3. **Limitez le nombre d'emails** par utilisateur/IP
4. **Loggez les envois** pour audit
5. **Utilisez HTTPS** pour tous les liens dans les emails

## 🐛 Dépannage

### Email non reçu

1. Vérifiez les logs du serveur
2. Vérifiez le dossier spam
3. Testez avec Mailtrap pour voir si l'email est généré
4. Vérifiez les credentials SMTP

### Erreur "Invalid login"

- Vérifiez `SMTP_USER` et `SMTP_PASS`
- Pour Gmail, assurez-vous d'utiliser un mot de passe d'application
- Vérifiez que la validation en 2 étapes est activée (Gmail)

### Erreur de connexion SMTP

- Vérifiez `SMTP_HOST` et `SMTP_PORT`
- Vérifiez `SMTP_SECURE` (true pour port 465, false sinon)
- Vérifiez votre pare-feu

### Token expiré ou invalide

- Le token expire après 24 heures
- Le token ne peut être utilisé qu'une seule fois
- Renvoyez un nouvel email avec `POST /auth/send-setup-email`

## 📊 Monitoring

### Logs disponibles

Les logs incluent :
- ✅ Email envoyé avec succès
- ❌ Erreur d'envoi (avec code et message)
- 📧 Détails de l'email (destinataire, sujet)
- 🔗 URL de configuration générée

### Exemple de logs
```
📧 SERVICE: Envoi email de configuration de compte
   Destinataire: jean@example.com
   Nom: Jean Dupont
   Token: 123456
🔗 URL de configuration: http://localhost:3000/setup-password?email=jean@example.com&token=123456
📬 Configuration email:
   From: "Team Fitness" <noreply@teamfitness.com>
   To: jean@example.com
   Subject: 🎉 Bienvenue sur Team Fitness - Configurez votre compte
🔄 Envoi email en cours...
✅ Email de configuration envoyé avec succès à: jean@example.com
```

## 🔗 Ressources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail SMTP](https://support.google.com/mail/answer/7126229)
- [SendGrid Documentation](https://docs.sendgrid.com/)
- [Mailtrap Documentation](https://mailtrap.io/docs/)
- [Amazon SES](https://aws.amazon.com/ses/)
