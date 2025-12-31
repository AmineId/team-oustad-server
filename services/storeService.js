const prisma = require('../utils/prismaClient');
const { generateStoreProductId, generateStoreReservationId } = require('../utils/idGenerator');

/**
 * Récupérer les produits avec filtres
 */
async function getProducts(filters = {}) {
  const where = {
    isActive: filters.isActive !== undefined ? filters.isActive : true
  };

  if (filters.gymId) where.gymId = filters.gymId;
  if (filters.category) where.category = filters.category;
  
  // Filtrer seulement les produits avec stock disponible
  if (filters.hasStock) {
    where.stock = { gt: 0 };
  }

  const products = await prisma.storeProduct.findMany({
    where,
    include: {
      Gym: {
        select: {
          id: true,
          name: true,
          displayId: true
        }
      },
      Creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      _count: {
        select: {
          StoreReservation: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Calculer le stock disponible pour chaque produit
  return products.map(product => {
    const pendingReservations = product.StoreReservation?.filter(
      r => r.status === 'pending'
    ) || [];
    
    const reservedStock = pendingReservations.reduce(
      (sum, r) => sum + r.quantity, 
      0
    );
    
    const availableStock = Math.max(0, product.stock - reservedStock);

    return {
      ...product,
      reservedStock,
      availableStock,
      _count: undefined // Retirer le _count de la réponse
    };
  });
}

/**
 * Récupérer un produit par ID
 */
async function getProductById(productId) {
  const product = await prisma.storeProduct.findUnique({
    where: { displayId: productId },
    include: {
      Gym: {
        select: {
          id: true,
          name: true,
          displayId: true
        }
      },
      Creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      },
      StoreReservation: {
        where: { status: 'pending' },
        select: {
          quantity: true
        }
      }
    }
  });

  if (!product) return null;

  // Calculer stock réservé et disponible
  const reservedStock = product.StoreReservation.reduce(
    (sum, r) => sum + r.quantity, 
    0
  );
  const availableStock = Math.max(0, product.stock - reservedStock);

  return {
    ...product,
    reservedStock,
    availableStock,
    StoreReservation: undefined
  };
}

/**
 * Créer un nouveau produit
 */
async function createProduct(data) {
  const displayId = data.displayId || generateStoreProductId();

  const product = await prisma.storeProduct.create({
    data: {
      displayId,
      name: data.name,
      description: data.description,
      imagesBase64: data.imagesBase64 || [],
      price: data.price,
      stock: data.stock,
      category: data.category,
      gymId: data.gymId,
      createdBy: data.createdBy,
      availableStock: data.stock // Initialement égal au stock total
    },
    include: {
      Gym: {
        select: {
          id: true,
          name: true,
          displayId: true
        }
      },
      Creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  return product;
}

/**
 * Mettre à jour un produit
 */
async function updateProduct(productId, updates) {
  // Si le stock est mis à jour, recalculer availableStock
  if (updates.stock !== undefined) {
    const product = await prisma.storeProduct.findUnique({
      where: { displayId: productId },
      include: {
        StoreReservation: {
          where: { status: 'pending' },
          select: { quantity: true }
        }
      }
    });

    const reservedStock = product.StoreReservation.reduce(
      (sum, r) => sum + r.quantity, 
      0
    );
    updates.availableStock = Math.max(0, updates.stock - reservedStock);
  }

  const product = await prisma.storeProduct.update({
    where: { displayId: productId },
    data: updates,
    include: {
      Gym: {
        select: {
          id: true,
          name: true,
          displayId: true
        }
      },
      Creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  return product;
}

/**
 * Supprimer un produit
 */
async function deleteProduct(productId) {
  // Vérifier qu'il n'y a pas de réservations en attente
  const pendingReservations = await prisma.storeReservation.count({
    where: {
      Product: { displayId: productId },
      status: 'pending'
    }
  });

  if (pendingReservations > 0) {
    throw new Error('Impossible de supprimer un produit avec des réservations en attente');
  }

  return await prisma.storeProduct.delete({
    where: { displayId: productId }
  });
}

/**
 * Créer une réservation
 */
async function createReservation(data) {
  const { productId, memberId, quantity, notes } = data;

  // Récupérer le produit
  const product = await prisma.storeProduct.findUnique({
    where: { id: productId },
    include: {
      StoreReservation: {
        where: { status: 'pending' },
        select: { quantity: true }
      }
    }
  });

  if (!product) {
    throw new Error('Produit non trouvé');
  }

  if (!product.isActive) {
    throw new Error('Produit non disponible');
  }

  // Calculer stock disponible
  const reservedStock = product.StoreReservation.reduce(
    (sum, r) => sum + r.quantity, 
    0
  );
  const availableStock = product.stock - reservedStock;

  if (availableStock < quantity) {
    throw new Error(`Stock insuffisant. Disponible: ${availableStock}`);
  }

  // Créer la réservation
  const displayId = generateStoreReservationId();
  const totalPrice = product.price * quantity;

  const reservation = await prisma.storeReservation.create({
    data: {
      displayId,
      productId,
      memberId,
      quantity,
      totalPrice,
      notes,
      status: 'pending'
    },
    include: {
      Product: {
        select: {
          id: true,
          displayId: true,
          name: true,
          imageUrl: true,
          price: true
        }
      },
      Member: {
        select: {
          userId: true,
          User: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }
    }
  });

  // Mettre à jour le stock réservé du produit
  await updateProductReservedStock(productId);

  return reservation;
}

/**
 * Récupérer les réservations d'un membre
 */
async function getMemberReservations(memberId, status = null) {
  const where = { memberId };
  if (status) where.status = status;

  return await prisma.storeReservation.findMany({
    where,
    include: {
      Product: {
        select: {
          id: true,
          displayId: true,
          name: true,
          imageUrl: true,
          price: true,
          category: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Récupérer toutes les réservations (staff)
 */
async function getAllReservations(filters = {}) {
  const where = {};
  
  if (filters.gymId) {
    where.Product = { gymId: filters.gymId };
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.productId) {
    where.productId = filters.productId;
  }

  return await prisma.storeReservation.findMany({
    where,
    include: {
      Product: {
        select: {
          id: true,
          displayId: true,
          name: true,
          imageUrl: true,
          price: true,
          category: true
        }
      },
      Member: {
        select: {
          userId: true,
          User: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Annuler une réservation
 */
async function cancelReservation(reservationId, userId, userRole) {
  const reservation = await prisma.storeReservation.findUnique({
    where: { displayId: reservationId },
    include: { Member: true }
  });

  if (!reservation) {
    throw new Error('Réservation non trouvée');
  }

  // Vérifier les permissions
  if (userRole === 'member' && reservation.memberId !== userId) {
    throw new Error('Non autorisé à annuler cette réservation');
  }

  if (reservation.status !== 'pending') {
    throw new Error('Seules les réservations en attente peuvent être annulées');
  }

  const updated = await prisma.storeReservation.update({
    where: { displayId: reservationId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date()
    },
    include: {
      Product: {
        select: {
          id: true,
          displayId: true,
          name: true,
          imageUrl: true,
          price: true
        }
      }
    }
  });

  // Mettre à jour le stock réservé
  await updateProductReservedStock(reservation.productId);

  return updated;
}

/**
 * Finaliser une réservation (produit retiré)
 */
async function completeReservation(reservationId) {
  const reservation = await prisma.storeReservation.findUnique({
    where: { displayId: reservationId }
  });

  if (!reservation) {
    throw new Error('Réservation non trouvée');
  }

  if (reservation.status !== 'pending') {
    throw new Error('Seules les réservations en attente peuvent être finalisées');
  }

  // Décrémenter le stock réel du produit
  await prisma.storeProduct.update({
    where: { id: reservation.productId },
    data: {
      stock: { decrement: reservation.quantity }
    }
  });

  const updated = await prisma.storeReservation.update({
    where: { displayId: reservationId },
    data: {
      status: 'completed',
      completedAt: new Date()
    },
    include: {
      Product: {
        select: {
          id: true,
          displayId: true,
          name: true,
          price: true
        }
      },
      Member: {
        select: {
          userId: true,
          User: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }
    }
  });

  // Mettre à jour le stock réservé
  await updateProductReservedStock(reservation.productId);

  return updated;
}

/**
 * Mettre à jour le stock réservé d'un produit
 */
async function updateProductReservedStock(productId) {
  const product = await prisma.storeProduct.findUnique({
    where: { id: productId },
    include: {
      StoreReservation: {
        where: { status: 'pending' },
        select: { quantity: true }
      }
    }
  });

  const reservedStock = product.StoreReservation.reduce(
    (sum, r) => sum + r.quantity, 
    0
  );
  const availableStock = Math.max(0, product.stock - reservedStock);

  await prisma.storeProduct.update({
    where: { id: productId },
    data: {
      reservedStock,
      availableStock
    }
  });
}

/**
 * Statistiques du store
 */
async function getStoreStats(gymId) {
  const [
    totalProducts,
    activeProducts,
    totalReservations,
    pendingReservations,
    completedReservations,
    totalRevenue
  ] = await Promise.all([
    prisma.storeProduct.count({ where: { gymId } }),
    prisma.storeProduct.count({ where: { gymId, isActive: true } }),
    prisma.storeReservation.count({
      where: { Product: { gymId } }
    }),
    prisma.storeReservation.count({
      where: { Product: { gymId }, status: 'pending' }
    }),
    prisma.storeReservation.count({
      where: { Product: { gymId }, status: 'completed' }
    }),
    prisma.storeReservation.aggregate({
      where: { Product: { gymId }, status: 'completed' },
      _sum: { totalPrice: true }
    })
  ]);

  // Produits les plus réservés
  const topProducts = await prisma.storeProduct.findMany({
    where: { gymId },
    include: {
      _count: {
        select: {
          StoreReservation: {
            where: { status: 'completed' }
          }
        }
      }
    },
    orderBy: {
      StoreReservation: {
        _count: 'desc'
      }
    },
    take: 5
  });

  return {
    totalProducts,
    activeProducts,
    totalReservations,
    pendingReservations,
    completedReservations,
    totalRevenue: totalRevenue._sum.totalPrice || 0,
    topProducts: topProducts.map(p => ({
      id: p.id,
      displayId: p.displayId,
      name: p.name,
      totalSold: p._count.StoreReservation
    }))
  };
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createReservation,
  getMemberReservations,
  getAllReservations,
  cancelReservation,
  completeReservation,
  getStoreStats
};
