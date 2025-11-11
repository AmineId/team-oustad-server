# 🤝 Guide de Contribution

Merci de contribuer à Team Fitness API !

## 📋 Avant de Commencer

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`)
3. Testez vos modifications
4. Committez (`git commit -m 'Add: AmazingFeature'`)
5. Push vers la branche (`git push origin feature/AmazingFeature`)
6. Ouvrez une Pull Request

## 🎯 Standards de Code

### Style
- Utiliser des noms de variables explicites
- Commenter le code complexe
- Suivre les conventions JavaScript existantes

### Commits
Format : `Type: Description courte`

Types :
- `Add:` Nouvelle fonctionnalité
- `Fix:` Correction de bug
- `Update:` Mise à jour
- `Refactor:` Refactoring
- `Docs:` Documentation
- `Test:` Tests

Exemples :
```
Add: endpoint pour acquitter les paiements
Fix: bug dans la validation des emails
Update: swagger avec nouveaux endpoints
Docs: guide d'intégration Flutter
```

## 🧪 Tests

Avant de soumettre :

```bash
# Vérifier que le serveur démarre
npm start

# Tester les endpoints principaux
node tests/test-api-quick.js

# Tester le système de paiement
node tests/test-acknowledge-olivia.js
```

## 📚 Documentation

- Mettre à jour `swagger.yml` pour les nouveaux endpoints
- Ajouter des exemples dans `docs/` si nécessaire
- Mettre à jour le `README.md` pour les nouvelles features

## ✅ Checklist PR

- [ ] Le code fonctionne localement
- [ ] Les tests passent
- [ ] La documentation est à jour
- [ ] Le swagger est mis à jour
- [ ] Pas de conflits avec main
- [ ] Les commits suivent le format standard

## 🐛 Signaler un Bug

Créez une issue avec :
- Description claire du problème
- Steps to reproduce
- Comportement attendu vs obtenu
- Environnement (OS, Node version, etc.)

## 💡 Proposer une Feature

Créez une issue "Feature Request" avec :
- Description de la fonctionnalité
- Cas d'usage
- Impact sur l'API existante

## 📞 Contact

Questions ? Ouvrez une issue ou contactez l'équipe.

Merci ! 🙏
