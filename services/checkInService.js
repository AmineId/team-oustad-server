const prisma = require('../utils/prismaClient');
const { generateDisplayId } = require('../utils/idGenerator');

/**
 * Service pour la gestion des check-ins et quotas de séances
 */
class CheckInService {

  /**
   * Créer un check-in en salle
   */
  async createCheckIn(data) {
    const { memberId, subscriptionId, gymId, isManual, createdBy, notes } = data;

    // Vérifier l'abonnement
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        SubscriptionType: true,
        Member: {
          include: {
            User: true
          }
        }
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'active') {
      throw new Error(`Subscription is ${subscription.status}`);
    }

    // Vérifier si l'abonnement a expiré
    if (subscription.endDate && new Date(subscription.endDate) < new Date()) {
      throw new Error('Subscription has expired');
    }

    // Vérifier le quota de séances
    if (subscription.sessionQuota !== null) {
      if (subscription.sessionsUsed >= subscription.sessionQuota) {
        throw new Error(`Session quota exhausted (${subscription.sessionsUsed}/${subscription.sessionQuota})`);
      }
    }

    // Vérifier s'il n'y a pas déjà un check-in aujourd'hui (jour calendaire)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todayCheckIn = await prisma.gymCheckIn.findFirst({
      where: {
        memberId,
        checkInTime: {
          gte: todayStart,
          lte: todayEnd
        }
      },
      orderBy: {
        checkInTime: 'desc'
      }
    });

    if (todayCheckIn) {
      throw new Error('QR code already scanned today. Next access tomorrow');
    }

    const displayId = generateDisplayId('CHECKIN');

    // Créer le check-in
    const checkIn = await prisma.gymCheckIn.create({
      data: {
        displayId,
        memberId,
        subscriptionId,
        gymId,
        isManual,
        createdBy,
        notes
      },
      include: {
        Member: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        Subscription: {
          include: {
            SubscriptionType: true
          }
        }
      }
    });

    // Incrémenter le compteur de séances utilisées
    if (subscription.sessionQuota !== null) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          sessionsUsed: {
            increment: 1
          }
        }
      });
    }

    return {
      ...checkIn,
      sessionsRemaining: subscription.sessionQuota 
        ? subscription.sessionQuota - subscription.sessionsUsed - 1
        : null
    };
  }

  /**
   * Check-in via QR code
   */
  async checkInByQR(qrCode, gymId) {
    console.log(`\n📱 Check-in via QR - GymID: ${gymId}`);
    console.log(`📥 QR Code reçu (type: ${typeof qrCode}):`, typeof qrCode === 'string' ? qrCode.substring(0, 100) : qrCode);
    
    // Parser le QR code si c'est un JSON string ou un objet
    let qrData;
    let displayId;

    if (typeof qrCode === 'string') {
      try {
        qrData = JSON.parse(qrCode);
        displayId = qrData.displayId || qrCode; // Utiliser displayId du JSON ou le string brut
        console.log(`✅ QR parsé en JSON - DisplayID extrait: ${displayId}`);
      } catch (e) {
        displayId = qrCode; // Si ce n'est pas du JSON, utiliser tel quel
        console.log(`ℹ️  QR n'est pas du JSON - Utilisation directe: ${displayId}`);
      }
    } else if (typeof qrCode === 'object') {
      qrData = qrCode;
      displayId = qrData.displayId;
      console.log(`✅ QR est un objet - DisplayID: ${displayId}`);
    } else {
      displayId = String(qrCode);
      console.log(`⚠️  QR type inattendu - Conversion en string: ${displayId}`);
    }

    // Trouver l'utilisateur via son displayId
    console.log(`🔍 Recherche utilisateur avec displayId: ${displayId}`);
    const user = await prisma.user.findFirst({
      where: {
        displayId: displayId // Utiliser displayId au lieu de uniqueCode
      },
      include: {
        Member: {
          include: {
            Subscription: {
              where: {
                status: 'active'
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 1,
              include: {
                SubscriptionType: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.Member) {
      console.error(`❌ Membre non trouvé - DisplayID: ${displayId}`);
      console.log(`🔍 Debug: user=${!!user}, user.Member=${user?.Member ? 'exists' : 'null'}`);
      throw new Error('Member not found');
    }

    console.log(`✅ Utilisateur trouvé: ${user.firstName} ${user.lastName} (ID: ${user.id})`);
    console.log(`📊 Profil Member: userId=${user.Member.userId}`);
    console.log(`📦 Abonnements actifs: ${user.Member.Subscription?.length || 0}`);

    const activeSubscription = user.Member.Subscription[0];

    if (!activeSubscription) {
      console.error(`❌ Aucun abonnement actif trouvé pour ${user.firstName} ${user.lastName}`);
      throw new Error('No active subscription found');
    }

    console.log(`✅ Abonnement actif trouvé: ${activeSubscription.SubscriptionType.name} (ID: ${activeSubscription.id})`);
    console.log(`📊 Quota: ${activeSubscription.sessionsUsed}/${activeSubscription.SubscriptionType.sessionQuota || '∞'}`);

    // Effectuer le check-in
    console.log(`🔄 Création du check-in...`);
    const checkInResult = await this.createCheckIn({
      memberId: user.id,
      subscriptionId: activeSubscription.id,
      gymId,
      isManual: false,
      createdBy: null,
      notes: 'Check-in via QR code'
    });

    console.log(`✅ Check-in créé: ${checkInResult.displayId}`);

    // Récupérer le quota mis à jour après le check-in
    console.log(`🔄 Récupération du quota mis à jour...`);
    const updatedQuota = await this.getSubscriptionQuota(activeSubscription.id);

    console.log(`📊 Quota après check-in: ${updatedQuota.sessionsUsed}/${updatedQuota.sessionQuota || '∞'} (${updatedQuota.sessionsRemaining || '∞'} restantes)`);

    // Générer un message contextuel
    let message = 'Check-in effectué avec succès';
    if (updatedQuota.isUnlimited) {
      message = 'Check-in effectué - Séances illimitées';
    } else {
      message = `Check-in effectué - ${updatedQuota.sessionsRemaining} séance(s) restante(s)`;
    }

    console.log(`✅ ${message}\n`);

    return {
      success: true,
      message,
      checkIn: checkInResult,
      member: {
        id: user.id,
        displayId: user.displayId,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        profileImageUrl: user.profileImage || null
      },
      quota: {
        sessionQuota: updatedQuota.sessionQuota,
        sessionsUsed: updatedQuota.sessionsUsed,
        sessionsRemaining: updatedQuota.sessionsRemaining,
        isUnlimited: updatedQuota.isUnlimited,
        percentageUsed: updatedQuota.percentageUsed,
        canCheckIn: updatedQuota.canCheckIn
      }
    };
  }

  /**
   * Récupérer l'historique des check-ins d'un membre
   */
  async getMemberCheckIns(memberId, options = {}) {
    const { startDate, endDate, limit = 50 } = options;

    const where = {
      memberId
    };

    if (startDate || endDate) {
      where.checkInTime = {};
      if (startDate) where.checkInTime.gte = startDate;
      if (endDate) where.checkInTime.lte = endDate;
    }

    const checkIns = await prisma.gymCheckIn.findMany({
      where,
      orderBy: {
        checkInTime: 'desc'
      },
      take: limit,
      include: {
        Gym: {
          select: {
            id: true,
            name: true
          }
        },
        Subscription: {
          include: {
            SubscriptionType: true
          }
        }
      }
    });

    return checkIns;
  }

  /**
   * Récupérer les informations de quota d'un abonnement
   */
  async getSubscriptionQuota(subscriptionId) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        SubscriptionType: true,
        Member: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const isUnlimited = subscription.sessionQuota === null;
    const sessionsRemaining = isUnlimited 
      ? null 
      : subscription.sessionQuota - subscription.sessionsUsed;

    const percentageUsed = isUnlimited
      ? 0
      : (subscription.sessionsUsed / subscription.sessionQuota) * 100;

    return {
      subscriptionId: subscription.id,
      displayId: subscription.displayId,
      member: subscription.Member,
      subscriptionType: subscription.SubscriptionType,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      sessionQuota: subscription.sessionQuota,
      sessionsUsed: subscription.sessionsUsed,
      sessionsRemaining,
      isUnlimited,
      percentageUsed: Math.round(percentageUsed),
      canCheckIn: subscription.status === 'active' && (isUnlimited || sessionsRemaining > 0)
    };
  }

  /**
   * Récupérer les membres présents dans la salle (pas encore checkout)
   */
  async getPresentMembers(gymId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const present = await prisma.gymCheckIn.findMany({
      where: {
        gymId,
        checkOutTime: null,
        checkInTime: {
          gte: todayStart
        }
      },
      include: {
        Member: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profileImage: true
              }
            }
          }
        },
        Subscription: {
          include: {
            SubscriptionType: true
          }
        }
      },
      orderBy: {
        checkInTime: 'desc'
      }
    });

    return present.map(checkIn => ({
      ...checkIn,
      hoursAgo: Math.floor((new Date() - checkIn.checkInTime) / (1000 * 60 * 60))
    }));
  }

  /**
   * Statistiques de fréquentation d'une salle
   */
  async getGymStats(gymId, options = {}) {
    const { startDate, endDate } = options;

    const where = {
      gymId
    };

    if (startDate || endDate) {
      where.checkInTime = {};
      if (startDate) where.checkInTime.gte = startDate;
      if (endDate) where.checkInTime.lte = endDate;
    }

    const totalCheckIns = await prisma.gymCheckIn.count({ where });

    const uniqueMembers = await prisma.gymCheckIn.groupBy({
      by: ['memberId'],
      where,
      _count: true
    });

    const avgCheckInsPerMember = uniqueMembers.length > 0
      ? totalCheckIns / uniqueMembers.length
      : 0;

    // Check-ins par jour de la semaine
    const checkIns = await prisma.gymCheckIn.findMany({
      where,
      select: {
        checkInTime: true
      }
    });

    const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
    checkIns.forEach(c => {
      const day = new Date(c.checkInTime).getDay();
      byDayOfWeek[day]++;
    });

    return {
      totalCheckIns,
      uniqueMembers: uniqueMembers.length,
      avgCheckInsPerMember: Math.round(avgCheckInsPerMember * 10) / 10,
      byDayOfWeek: {
        sunday: byDayOfWeek[0],
        monday: byDayOfWeek[1],
        tuesday: byDayOfWeek[2],
        wednesday: byDayOfWeek[3],
        thursday: byDayOfWeek[4],
        friday: byDayOfWeek[5],
        saturday: byDayOfWeek[6]
      },
      period: {
        startDate: startDate || checkIns[0]?.checkInTime,
        endDate: endDate || new Date()
      }
    };
  }

  /**
   * Auto checkout de tous les check-ins de la veille (appelé à minuit)
   */
  async autoCheckOutYesterday() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayCheckIns = await prisma.gymCheckIn.findMany({
      where: {
        checkOutTime: null,
        checkInTime: {
          lt: todayStart
        }
      }
    });

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    for (const checkIn of yesterdayCheckIns) {
      const duration = Math.floor((midnight - checkIn.checkInTime) / (1000 * 60));
      
      await prisma.gymCheckIn.update({
        where: { id: checkIn.id },
        data: {
          checkOutTime: midnight,
          duration
        }
      });
    }

    console.log(`Auto checked-out ${yesterdayCheckIns.length} check-ins from yesterday`);
    return yesterdayCheckIns.length;
  }
}

module.exports = new CheckInService();
