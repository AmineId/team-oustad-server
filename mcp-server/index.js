#!/usr/bin/env node

/**
 * Team Fitness MCP Server
 * 
 * Ce serveur MCP expose les fonctionnalités de l'API Team Fitness via le protocole MCP.
 * Il permet aux assistants IA d'interagir avec :
 * - Authentification (login, forgot password, etc.)
 * - Gestion des salles (gyms)
 * - Gestion des utilisateurs (members, admins, owners)
 * - Gestion des abonnements et paiements
 * - Gestion des plannings d'entraînement
 * - Notifications push
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Configuration des environnements
const ACTIVE_ENV = process.env.ACTIVE_ENV || 'dev';
const API_URLS = {
  dev: process.env.DEV_API_BASE_URL || 'http://localhost:3000',
  preprod: process.env.PREPROD_API_BASE_URL || 'https://preprod-api.teamfitness.com',
  prod: process.env.PROD_API_BASE_URL || 'https://api.teamfitness.com',
};

const API_BASE_URL = API_URLS[ACTIVE_ENV];
let AUTH_TOKEN = null;

// Stockage des tokens par environnement
const AUTH_TOKENS = {
  dev: null,
  preprod: null,
  prod: null,
};

// Client Axios pour les appels API
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token d'authentification
apiClient.interceptors.request.use((config) => {
  const token = AUTH_TOKENS[ACTIVE_ENV] || AUTH_TOKEN;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Création du serveur MCP
const server = new Server(
  {
    name: 'teamfitness-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ==================== DÉFINITION DES OUTILS ====================

const TOOLS = [
  // ===== GESTION D'ENVIRONNEMENT =====
  {
    name: 'env_get_current',
    description: 'Obtenir l\'environnement actuellement actif (dev, preprod, prod)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'env_switch',
    description: 'Changer d\'environnement (dev, preprod, prod)',
    inputSchema: {
      type: 'object',
      properties: {
        environment: {
          type: 'string',
          description: 'Environnement cible',
          enum: ['dev', 'preprod', 'prod'],
        },
      },
      required: ['environment'],
    },
  },
  {
    name: 'env_list_tokens',
    description: 'Lister l\'état de connexion pour chaque environnement',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ===== AUTHENTIFICATION =====
  {
    name: 'auth_login',
    description: 'Se connecter à l\'API Team Fitness et obtenir un token d\'authentification pour l\'environnement actif',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email de l\'utilisateur',
        },
        password: {
          type: 'string',
          description: 'Mot de passe de l\'utilisateur',
        },
      },
      required: ['email', 'password'],
    },
  },
  {
    name: 'auth_me',
    description: 'Obtenir les informations de l\'utilisateur connecté',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'auth_forgot_password',
    description: 'Demander un code de réinitialisation de mot de passe',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email de l\'utilisateur',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'auth_reset_password',
    description: 'Réinitialiser le mot de passe avec le code reçu',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email de l\'utilisateur',
        },
        token: {
          type: 'string',
          description: 'Code à 6 chiffres reçu par email',
        },
        newPassword: {
          type: 'string',
          description: 'Nouveau mot de passe (minimum 6 caractères)',
        },
      },
      required: ['email', 'token', 'newPassword'],
    },
  },

  // ===== SALLES DE SPORT (GYMS) =====
  {
    name: 'gyms_list',
    description: 'Lister les salles de sport accessibles (owners voient tout, managers/members voient leur salle)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'gyms_get',
    description: 'Obtenir les détails d\'une salle de sport spécifique',
    inputSchema: {
      type: 'object',
      properties: {
        gymId: {
          type: 'number',
          description: 'ID de la salle',
        },
      },
      required: ['gymId'],
    },
  },
  {
    name: 'gyms_create',
    description: 'Créer une nouvelle salle de sport (réservé aux owners)',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nom de la salle',
        },
        address: {
          type: 'string',
          description: 'Adresse de la salle',
        },
        phone: {
          type: 'string',
          description: 'Téléphone de la salle',
        },
      },
      required: ['name', 'address'],
    },
  },
  {
    name: 'gyms_update',
    description: 'Mettre à jour une salle de sport',
    inputSchema: {
      type: 'object',
      properties: {
        gymId: {
          type: 'number',
          description: 'ID de la salle',
        },
        name: {
          type: 'string',
          description: 'Nouveau nom de la salle',
        },
        address: {
          type: 'string',
          description: 'Nouvelle adresse',
        },
        phone: {
          type: 'string',
          description: 'Nouveau téléphone',
        },
      },
      required: ['gymId'],
    },
  },
  {
    name: 'gyms_get_opening_hours',
    description: 'Obtenir les horaires d\'ouverture d\'une salle',
    inputSchema: {
      type: 'object',
      properties: {
        gymId: {
          type: 'number',
          description: 'ID de la salle',
        },
      },
      required: ['gymId'],
    },
  },

  // ===== UTILISATEURS =====
  {
    name: 'users_list',
    description: 'Lister les utilisateurs (managers voient leur salle, owners voient tout)',
    inputSchema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: 'Filtrer par rôle (manager, member, owner)',
          enum: ['manager', 'member', 'owner'],
        },
        gymId: {
          type: 'number',
          description: 'Filtrer par salle (owners uniquement)',
        },
      },
    },
  },
  {
    name: 'users_get',
    description: 'Obtenir les détails d\'un utilisateur',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'number',
          description: 'ID de l\'utilisateur',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'users_create',
    description: 'Créer un nouvel utilisateur (membre, manager ou owner)',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email de l\'utilisateur',
        },
        fullName: {
          type: 'string',
          description: 'Nom complet',
        },
        role: {
          type: 'string',
          description: 'Rôle (manager, member, owner ; admin accepté comme alias de manager)',
          enum: ['manager', 'member', 'owner'],
        },
        gymId: {
          type: 'number',
          description: 'ID de la salle (obligatoire pour manager et member)',
        },
      },
      required: ['email', 'fullName', 'role'],
    },
  },

  // ===== ABONNEMENTS =====
  {
    name: 'subscriptions_create',
    description: 'Créer un abonnement pour un membre',
    inputSchema: {
      type: 'object',
      properties: {
        memberId: {
          type: 'number',
          description: 'ID du membre',
        },
        subscriptionTypeId: {
          type: 'number',
          description: 'ID du type d\'abonnement',
        },
        paymentFrequency: {
          type: 'number',
          description: 'Fréquence de paiement (1=unique, 3=trimestriel, 6=semestriel, 12=mensuel)',
          enum: [1, 3, 6, 12],
        },
        startDate: {
          type: 'string',
          description: 'Date de début (format YYYY-MM-DD)',
        },
      },
      required: ['memberId', 'subscriptionTypeId'],
    },
  },
  {
    name: 'subscriptions_get',
    description: 'Obtenir le statut détaillé d\'un abonnement',
    inputSchema: {
      type: 'object',
      properties: {
        subscriptionId: {
          type: 'number',
          description: 'ID de l\'abonnement',
        },
      },
      required: ['subscriptionId'],
    },
  },
  {
    name: 'subscriptions_list_member',
    description: 'Lister tous les abonnements d\'un membre',
    inputSchema: {
      type: 'object',
      properties: {
        memberId: {
          type: 'number',
          description: 'ID du membre',
        },
      },
      required: ['memberId'],
    },
  },
  {
    name: 'subscriptions_types_list',
    description: 'Lister les types d\'abonnements disponibles',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'payment_acknowledge',
    description: 'Acquitter un paiement (marquer comme payé et activer l\'abonnement si nécessaire)',
    inputSchema: {
      type: 'object',
      properties: {
        paymentId: {
          type: 'number',
          description: 'ID du paiement',
        },
        paymentMethod: {
          type: 'string',
          description: 'Méthode de paiement (cash, card, transfer)',
          enum: ['cash', 'card', 'transfer'],
        },
        transactionId: {
          type: 'string',
          description: 'ID de transaction (optionnel)',
        },
      },
      required: ['paymentId', 'paymentMethod'],
    },
  },

  // ===== PLANNINGS D'ENTRAÎNEMENT =====
  {
    name: 'plannings_list',
    description: 'Lister les plannings (coaches voient leurs plannings, membres voient les leurs)',
    inputSchema: {
      type: 'object',
      properties: {
        memberId: {
          type: 'number',
          description: 'Filtrer par membre (coaches uniquement)',
        },
        status: {
          type: 'string',
          description: 'Filtrer par statut',
          enum: ['active', 'completed', 'cancelled'],
        },
      },
    },
  },
  {
    name: 'plannings_get_member',
    description: 'Obtenir tous les plannings d\'un membre avec détails complets',
    inputSchema: {
      type: 'object',
      properties: {
        memberId: {
          type: 'number',
          description: 'ID du membre',
        },
        status: {
          type: 'string',
          description: 'Filtrer par statut',
          enum: ['active', 'completed', 'cancelled'],
        },
      },
      required: ['memberId'],
    },
  },
  {
    name: 'plannings_get_next_day',
    description: 'Obtenir le prochain jour d\'entraînement pour un membre (aujourd\'hui ou demain)',
    inputSchema: {
      type: 'object',
      properties: {
        memberId: {
          type: 'number',
          description: 'ID du membre',
        },
      },
      required: ['memberId'],
    },
  },
  {
    name: 'plannings_create',
    description: 'Créer un nouveau planning d\'entraînement (coaches uniquement)',
    inputSchema: {
      type: 'object',
      properties: {
        memberId: {
          type: 'number',
          description: 'ID du membre',
        },
        title: {
          type: 'string',
          description: 'Titre du planning',
        },
        description: {
          type: 'string',
          description: 'Description du planning',
        },
        startDate: {
          type: 'string',
          description: 'Date de début (format YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          description: 'Date de fin (format YYYY-MM-DD)',
        },
      },
      required: ['memberId', 'title', 'startDate', 'endDate'],
    },
  },
  {
    name: 'exercises_list',
    description: 'Lister tous les exercices disponibles',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filtrer par catégorie',
          enum: ['strength', 'cardio', 'flexibility', 'balance', 'functional'],
        },
        difficulty: {
          type: 'string',
          description: 'Filtrer par difficulté',
          enum: ['beginner', 'intermediate', 'advanced'],
        },
      },
    },
  },
  {
    name: 'exercises_create',
    description: 'Créer un nouvel exercice (coaches uniquement)',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nom de l\'exercice',
        },
        description: {
          type: 'string',
          description: 'Description de l\'exercice',
        },
        category: {
          type: 'string',
          description: 'Catégorie',
          enum: ['strength', 'cardio', 'flexibility', 'balance', 'functional'],
        },
        difficulty: {
          type: 'string',
          description: 'Difficulté',
          enum: ['beginner', 'intermediate', 'advanced'],
        },
        muscleGroup: {
          type: 'array',
          description: 'Groupes musculaires ciblés',
          items: { type: 'string' },
        },
        equipment: {
          type: 'array',
          description: 'Équipement nécessaire',
          items: { type: 'string' },
        },
        instructions: {
          type: 'string',
          description: 'Instructions détaillées',
        },
      },
      required: ['name', 'category', 'difficulty'],
    },
  },
  {
    name: 'plannings_add_exercise',
    description: 'Ajouter un exercice à un jour spécifique d\'un planning',
    inputSchema: {
      type: 'object',
      properties: {
        planningId: {
          type: 'number',
          description: 'ID du planning',
        },
        dayOfWeek: {
          type: 'number',
          description: 'Jour de la semaine (0=Dimanche, 1=Lundi, ..., 6=Samedi)',
          minimum: 0,
          maximum: 6,
        },
        exerciseId: {
          type: 'number',
          description: 'ID de l\'exercice',
        },
        sets: {
          type: 'number',
          description: 'Nombre de séries',
        },
        reps: {
          type: 'number',
          description: 'Nombre de répétitions',
        },
        weight: {
          type: 'number',
          description: 'Poids en kg',
        },
        duration: {
          type: 'number',
          description: 'Durée en minutes (pour cardio)',
        },
        restTime: {
          type: 'number',
          description: 'Temps de repos en secondes',
        },
        notes: {
          type: 'string',
          description: 'Notes spécifiques',
        },
      },
      required: ['planningId', 'dayOfWeek', 'exerciseId'],
    },
  },

  // ===== DEMANDE D'AIDE =====
  {
    name: 'request_help',
    description: 'Demander de l\'aide au coach pour un exercice (membres uniquement)',
    inputSchema: {
      type: 'object',
      properties: {
        exerciseName: {
          type: 'string',
          description: 'Nom de l\'exercice nécessitant de l\'aide',
        },
        notes: {
          type: 'string',
          description: 'Notes optionnelles sur la demande',
        },
      },
      required: ['exerciseName'],
    },
  },
];

// ==================== GESTIONNAIRES DES OUTILS ====================

async function handleToolCall(name, args) {
  try {
    switch (name) {
      // ===== GESTION D'ENVIRONNEMENT =====
      case 'env_get_current': {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              activeEnvironment: ACTIVE_ENV,
              apiUrl: API_BASE_URL,
              isAuthenticated: !!AUTH_TOKENS[ACTIVE_ENV],
              availableEnvironments: Object.keys(API_URLS),
            }, null, 2),
          }],
        };
      }

      case 'env_switch': {
        const targetEnv = args.environment;
        if (!API_URLS[targetEnv]) {
          throw new Error(`Environnement invalide: ${targetEnv}. Disponibles: ${Object.keys(API_URLS).join(', ')}`);
        }

        // Mettre à jour l'environnement
        process.env.ACTIVE_ENV = targetEnv;
        
        // Mettre à jour l'URL de base du client API
        apiClient.defaults.baseURL = API_URLS[targetEnv];
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Environnement changé vers: ${targetEnv}`,
              previousEnvironment: ACTIVE_ENV,
              newEnvironment: targetEnv,
              newApiUrl: API_URLS[targetEnv],
              isAuthenticated: !!AUTH_TOKENS[targetEnv],
              warning: AUTH_TOKENS[targetEnv] ? null : 'Vous devez vous reconnecter avec auth_login',
            }, null, 2),
          }],
        };
      }

      case 'env_list_tokens': {
        const envStatus = {};
        for (const env of Object.keys(API_URLS)) {
          envStatus[env] = {
            url: API_URLS[env],
            isAuthenticated: !!AUTH_TOKENS[env],
            isActive: env === ACTIVE_ENV,
          };
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              activeEnvironment: ACTIVE_ENV,
              environments: envStatus,
            }, null, 2),
          }],
        };
      }

      // ===== AUTHENTIFICATION =====
      case 'auth_login': {
        const response = await apiClient.post('/auth/login', {
          email: args.email,
          password: args.password,
        });
        
        // Stocker le token pour l'environnement actif
        AUTH_TOKENS[ACTIVE_ENV] = response.data.token;
        AUTH_TOKEN = response.data.token; // Pour compatibilité
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Connexion réussie sur ${ACTIVE_ENV}`,
              environment: ACTIVE_ENV,
              user: response.data.user,
            }, null, 2),
          }],
        };
      }

      case 'auth_me': {
        const response = await apiClient.get('/auth/me');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'auth_forgot_password': {
        const response = await apiClient.post('/auth/forgot-password', {
          email: args.email,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'auth_reset_password': {
        const response = await apiClient.post('/auth/reset-password', {
          email: args.email,
          token: args.token,
          newPassword: args.newPassword,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      // ===== SALLES DE SPORT =====
      case 'gyms_list': {
        const response = await apiClient.get('/gyms');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'gyms_get': {
        const response = await apiClient.get(`/gyms/${args.gymId}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'gyms_create': {
        const response = await apiClient.post('/gyms', {
          name: args.name,
          address: args.address,
          phone: args.phone,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'gyms_update': {
        const updateData = {};
        if (args.name) updateData.name = args.name;
        if (args.address) updateData.address = args.address;
        if (args.phone) updateData.phone = args.phone;
        
        const response = await apiClient.put(`/gyms/${args.gymId}`, updateData);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'gyms_get_opening_hours': {
        const response = await apiClient.get(`/gyms/${args.gymId}/opening-hours`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      // ===== UTILISATEURS =====
      case 'users_list': {
        const params = {};
        if (args.role) params.role = args.role;
        if (args.gymId) params.gymId = args.gymId;
        
        const response = await apiClient.get('/users', { params });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'users_get': {
        const response = await apiClient.get(`/users/${args.userId}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'users_create': {
        const response = await apiClient.post('/users', {
          email: args.email,
          fullName: args.fullName,
          role: args.role,
          gymId: args.gymId,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      // ===== ABONNEMENTS =====
      case 'subscriptions_create': {
        const response = await apiClient.post('/subscriptions', {
          memberId: args.memberId,
          subscriptionTypeId: args.subscriptionTypeId,
          paymentFrequency: args.paymentFrequency || 12,
          startDate: args.startDate,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'subscriptions_get': {
        const response = await apiClient.get(`/subscriptions/${args.subscriptionId}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'subscriptions_list_member': {
        const response = await apiClient.get(`/subscriptions/member/${args.memberId}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'subscriptions_types_list': {
        const response = await apiClient.get('/subscription-types');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'payment_acknowledge': {
        const response = await apiClient.post(
          `/subscriptions/payments/${args.paymentId}/acknowledge`,
          {
            paymentMethod: args.paymentMethod,
            transactionId: args.transactionId,
          }
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      // ===== PLANNINGS =====
      case 'plannings_list': {
        const params = {};
        if (args.memberId) params.memberId = args.memberId;
        if (args.status) params.status = args.status;
        
        const response = await apiClient.get('/plannings', { params });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'plannings_get_member': {
        const params = {};
        if (args.status) params.status = args.status;
        
        const response = await apiClient.get(`/plannings/member/${args.memberId}`, { params });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'plannings_get_next_day': {
        const response = await apiClient.get(`/plannings/next-day/${args.memberId}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'plannings_create': {
        const response = await apiClient.post('/plannings', {
          memberId: args.memberId,
          title: args.title,
          description: args.description,
          startDate: args.startDate,
          endDate: args.endDate,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'exercises_list': {
        const params = {};
        if (args.category) params.category = args.category;
        if (args.difficulty) params.difficulty = args.difficulty;
        
        const response = await apiClient.get('/plannings/exercises', { params });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'exercises_create': {
        const response = await apiClient.post('/plannings/exercises', {
          name: args.name,
          description: args.description,
          category: args.category,
          difficulty: args.difficulty,
          muscleGroup: args.muscleGroup || [],
          equipment: args.equipment || [],
          instructions: args.instructions,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      case 'plannings_add_exercise': {
        const response = await apiClient.post(
          `/plannings/${args.planningId}/days/${args.dayOfWeek}/exercises`,
          {
            exerciseId: args.exerciseId,
            sets: args.sets,
            reps: args.reps,
            weight: args.weight,
            duration: args.duration,
            restTime: args.restTime,
            notes: args.notes,
          }
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      // ===== DEMANDE D'AIDE =====
      case 'request_help': {
        const response = await apiClient.post('/plannings/request-help', {
          exerciseName: args.exerciseName,
          notes: args.notes,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Outil inconnu: ${name}`);
    }
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message;
    const statusCode = error.response?.status;
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          message: errorMessage,
          statusCode: statusCode,
          details: error.response?.data,
        }, null, 2),
      }],
      isError: true,
    };
  }
}

// ==================== CONFIGURATION DU SERVEUR ====================

// Gestionnaire pour lister les outils
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Gestionnaire pour appeler les outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.error(`[MCP] Appel outil: ${name}`);
  console.error(`[MCP] Arguments:`, JSON.stringify(args, null, 2));
  
  return await handleToolCall(name, args);
});

// ==================== DÉMARRAGE DU SERVEUR ====================

async function main() {
  console.error('[MCP] Démarrage Team Fitness MCP Server...');
  console.error(`[MCP] Environnement actif: ${ACTIVE_ENV}`);
  console.error(`[MCP] API URL: ${API_BASE_URL}`);
  console.error('[MCP] Environnements disponibles:');
  Object.entries(API_URLS).forEach(([env, url]) => {
    const marker = env === ACTIVE_ENV ? '→' : ' ';
    console.error(`[MCP]   ${marker} ${env}: ${url}`);
  });
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[MCP] ✅ Serveur démarré et prêt à recevoir des requêtes');
  console.error('[MCP] 💡 Utilisez env_switch pour changer d\'environnement');
}

main().catch((error) => {
  console.error('[MCP] Erreur fatale:', error);
  process.exit(1);
});
