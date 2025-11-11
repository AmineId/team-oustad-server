# Firebase Cloud Messaging (FCM) Setup Guide

This guide will help you configure Firebase Cloud Messaging for push notifications in the Team Fitness Server.

## Prerequisites

- A Google account
- Access to the [Firebase Console](https://console.firebase.google.com)

## Step-by-Step Setup

### 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"** or select an existing project
3. Follow the setup wizard:
   - Enter your project name (e.g., "Team Fitness")
   - (Optional) Enable Google Analytics
   - Accept the terms and create the project

### 2. Generate Service Account Key

1. In your Firebase project, click the **gear icon** ⚙️ (Project Settings)
2. Go to the **"Service accounts"** tab
3. Click **"Generate new private key"**
4. A JSON file will be downloaded - **keep this file secure!**

### 3. Add Service Account to Your Project

1. **Rename** the downloaded JSON file to `firebase-service-account.json`
2. **Move** the file to your project root:
   ```bash
   /mnt/i/Dev Projects/team_fitness_server/firebase-service-account.json
   ```

3. **IMPORTANT**: This file is already in `.gitignore` - never commit it to version control!

4. **Verify** the file structure matches this example (see `firebase-service-account.example.json`):
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
     ...
   }
   ```

### 4. Update Environment Variables

Add the following line to your `.env` file:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

Your `.env` file should now look like this:

```env
DATABASE_URL="postgresql://admin:admin@localhost:5432/fitness?schema=public"
JWT_SECRET="replace_this_with_a_strong_secret"
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### 5. Restart the Server

After adding the environment variable, restart your Node.js server for the changes to take effect:

```bash
npm start
# or if using nodemon
npm run dev
```

### 6. Verify Configuration

You should see this message in your console logs when Firebase initializes successfully:

```
✅ Firebase Admin SDK initialisé
```

If you see warnings like:
```
⚠️ FIREBASE_SERVICE_ACCOUNT_PATH non défini dans .env
```

Then the environment variable is not being loaded correctly. Make sure you've restarted the server.

## Testing Push Notifications

Once Firebase is configured, the server will automatically send push notifications for:

- ✅ **Payment confirmed**: When a payment is marked as completed
- ⚠️ **Payment due**: Reminders for upcoming payments
- 🚨 **Payment overdue**: Alerts for late payments
- 💪 **New training plan**: When a coach assigns a new workout plan
- 📋 **New subscription**: When a new subscription is created
- 🔄 **Payment status changes**: When payment status is updated
- 📝 **Planning modified**: When a training plan is updated
- 🗑️ **Planning deleted**: When a training plan is removed

## Troubleshooting

### "Firebase non initialisé" Error

**Cause**: Firebase couldn't initialize because:
- The service account file path is incorrect
- The service account JSON file is malformed
- Environment variables aren't loaded

**Solution**:
1. Verify the file path in `.env` matches the actual file location
2. Ensure the JSON file is valid (open it in a text editor)
3. Restart the server after changing `.env`

### "Invalid service account" Error

**Cause**: The service account credentials are invalid or expired.

**Solution**:
1. Generate a new service account key from Firebase Console
2. Replace the old JSON file with the new one
3. Restart the server

### Tokens Not Being Saved

**Cause**: The Flutter app might not be sending the FCM token correctly.

**Solution**:
Check the Flutter app logs and ensure the token is being sent to:
```
PUT /users/fcm-token
```

With body:
```json
{
  "fcmToken": "your_firebase_token_here"
}
```

## Security Best Practices

1. **Never commit** `firebase-service-account.json` to version control
2. **Rotate credentials** periodically for security
3. **Use environment-specific** service accounts for dev/staging/production
4. **Limit permissions** of the service account to only what's needed (Cloud Messaging)

## Flutter App Configuration

Make sure your Flutter app is also configured with Firebase:

1. Add Firebase to your Flutter app via FlutterFire CLI
2. Configure FCM in your Flutter app to receive notifications
3. Send the device token to the server using the `/users/fcm-token` endpoint

## Additional Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [FlutterFire Documentation](https://firebase.flutter.dev/)
