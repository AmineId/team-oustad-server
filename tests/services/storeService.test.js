jest.mock('../../utils/prismaClient', () => ({
  storeProduct: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  },
  storeReservation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn()
  }
}));

const prisma = require('../../utils/prismaClient');
const storeService = require('../../services/storeService');

const mockProduct = {
  id: 1,
  displayId: 'PROD-abc',
  name: 'Protein Bar',
  price: 5.0,
  stock: 20,
  availableStock: 20,
  isActive: true,
  gymId: 1,
  category: 'nutrition',
  StoreReservation: []
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('storeService', () => {

  describe('getProducts', () => {
    it('should return products with computed availableStock', async () => {
      prisma.storeProduct.findMany.mockResolvedValue([mockProduct]);
      const result = await storeService.getProducts({});
      expect(result).toHaveLength(1);
      expect(result[0].availableStock).toBe(20);
      expect(result[0].reservedStock).toBe(0);
    });

    it('should filter by gymId', async () => {
      prisma.storeProduct.findMany.mockResolvedValue([]);
      await storeService.getProducts({ gymId: 1 });
      const call = prisma.storeProduct.findMany.mock.calls[0][0];
      expect(call.where.gymId).toBe(1);
    });

    it('should filter by category', async () => {
      prisma.storeProduct.findMany.mockResolvedValue([]);
      await storeService.getProducts({ category: 'nutrition' });
      const call = prisma.storeProduct.findMany.mock.calls[0][0];
      expect(call.where.category).toBe('nutrition');
    });

    it('should add stock filter when hasStock is true', async () => {
      prisma.storeProduct.findMany.mockResolvedValue([]);
      await storeService.getProducts({ hasStock: true });
      const call = prisma.storeProduct.findMany.mock.calls[0][0];
      expect(call.where.availableStock).toEqual({ gt: 0 });
    });

    it('should compute reservedStock from pending reservations', async () => {
      const product = {
        ...mockProduct,
        StoreReservation: [
          { status: 'pending', quantity: 3 },
          { status: 'pending', quantity: 2 }
        ]
      };
      prisma.storeProduct.findMany.mockResolvedValue([product]);
      const result = await storeService.getProducts({});
      expect(result[0].reservedStock).toBe(5);
      expect(result[0].availableStock).toBe(15);
    });
  });

  describe('getProductById', () => {
    it('should return null when not found', async () => {
      prisma.storeProduct.findUnique.mockResolvedValue(null);
      const result = await storeService.getProductById('PROD-999');
      expect(result).toBeNull();
    });

    it('should return product with computed stock', async () => {
      const product = {
        ...mockProduct,
        StoreReservation: [{ quantity: 4 }]
      };
      prisma.storeProduct.findUnique.mockResolvedValue(product);
      const result = await storeService.getProductById('PROD-abc');
      expect(result.reservedStock).toBe(4);
      expect(result.availableStock).toBe(16);
    });
  });

  describe('createProduct', () => {
    it('should throw when gymId is missing', async () => {
      await expect(storeService.createProduct({ name: 'Shaker', price: 10, stock: 5 }))
        .rejects.toThrow('gymId est requis');
    });

    it('should create product successfully', async () => {
      prisma.storeProduct.create.mockResolvedValue(mockProduct);
      const result = await storeService.createProduct({
        name: 'Shaker', price: 10, stock: 5, gymId: 1, category: 'equipment'
      });
      expect(prisma.storeProduct.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateProduct', () => {
    it('should update product fields', async () => {
      prisma.storeProduct.update.mockResolvedValue({ ...mockProduct, name: 'Updated' });
      await storeService.updateProduct('PROD-abc', { name: 'Updated' });
      expect(prisma.storeProduct.update).toHaveBeenCalledTimes(1);
    });

    it('should recalculate availableStock when stock is updated', async () => {
      prisma.storeProduct.findUnique.mockResolvedValue({
        ...mockProduct,
        StoreReservation: [{ quantity: 3 }]
      });
      prisma.storeProduct.update.mockResolvedValue({});

      await storeService.updateProduct('PROD-abc', { stock: 30 });
      const updatesData = prisma.storeProduct.update.mock.calls[0][0].data;
      expect(updatesData.availableStock).toBe(27); // 30 - 3
    });
  });

  describe('deleteProduct', () => {
    it('should throw when pending reservations exist', async () => {
      prisma.storeReservation.count.mockResolvedValue(2);
      await expect(storeService.deleteProduct('PROD-abc')).rejects.toThrow('réservations en attente');
    });

    it('should delete product when no pending reservations', async () => {
      prisma.storeReservation.count.mockResolvedValue(0);
      prisma.storeProduct.delete.mockResolvedValue(mockProduct);
      await storeService.deleteProduct('PROD-abc');
      expect(prisma.storeProduct.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('createReservation', () => {
    it('should throw when product not found', async () => {
      prisma.storeProduct.findUnique.mockResolvedValue(null);
      await expect(storeService.createReservation({ productId: 999, memberId: 1, quantity: 1 }))
        .rejects.toThrow('Produit non trouvé');
    });

    it('should throw when product is inactive', async () => {
      prisma.storeProduct.findUnique.mockResolvedValue({
        ...mockProduct,
        isActive: false,
        StoreReservation: []
      });
      await expect(storeService.createReservation({ productId: 1, memberId: 1, quantity: 1 }))
        .rejects.toThrow('non disponible');
    });

    it('should throw when stock is insufficient', async () => {
      prisma.storeProduct.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 3,
        StoreReservation: [{ quantity: 2 }]
      });
      await expect(storeService.createReservation({ productId: 1, memberId: 1, quantity: 5 }))
        .rejects.toThrow('Stock insuffisant');
    });

    it('should create reservation and update stock', async () => {
      prisma.storeProduct.findUnique
        .mockResolvedValueOnce({ ...mockProduct, StoreReservation: [] })
        .mockResolvedValueOnce({ ...mockProduct, StoreReservation: [{ quantity: 2 }] });
      prisma.storeReservation.create.mockResolvedValue({ id: 1, displayId: 'RESV-abc' });
      prisma.storeProduct.update.mockResolvedValue({});

      const result = await storeService.createReservation({ productId: 1, memberId: 5, quantity: 2 });
      expect(prisma.storeReservation.create).toHaveBeenCalledTimes(1);
      expect(prisma.storeProduct.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMemberReservations', () => {
    it('should return member reservations', async () => {
      prisma.storeReservation.findMany.mockResolvedValue([{ id: 1 }]);
      const result = await storeService.getMemberReservations(5);
      expect(result).toHaveLength(1);
    });

    it('should filter by status when provided', async () => {
      prisma.storeReservation.findMany.mockResolvedValue([]);
      await storeService.getMemberReservations(5, 'pending');
      const call = prisma.storeReservation.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('pending');
    });
  });

  describe('cancelReservation', () => {
    it('should throw when reservation not found', async () => {
      prisma.storeReservation.findUnique.mockResolvedValue(null);
      await expect(storeService.cancelReservation('RESV-999', 1, 'admin')).rejects.toThrow('non trouvée');
    });

    it('should throw when member tries to cancel another member reservation', async () => {
      prisma.storeReservation.findUnique.mockResolvedValue({
        displayId: 'RESV-abc', memberId: 10, status: 'pending', productId: 1, Member: {}
      });
      await expect(storeService.cancelReservation('RESV-abc', 99, 'member')).rejects.toThrow('Non autorisé');
    });

    it('should throw when reservation is not pending', async () => {
      prisma.storeReservation.findUnique.mockResolvedValue({
        displayId: 'RESV-abc', memberId: 5, status: 'completed', productId: 1, Member: {}
      });
      await expect(storeService.cancelReservation('RESV-abc', 5, 'member')).rejects.toThrow('en attente');
    });

    it('should cancel reservation and update stock', async () => {
      prisma.storeReservation.findUnique.mockResolvedValue({
        displayId: 'RESV-abc', memberId: 5, status: 'pending', productId: 1, Member: {}
      });
      prisma.storeReservation.update.mockResolvedValue({ status: 'cancelled' });
      prisma.storeProduct.findUnique.mockResolvedValue({ ...mockProduct, StoreReservation: [] });
      prisma.storeProduct.update.mockResolvedValue({});

      await storeService.cancelReservation('RESV-abc', 5, 'member');
      expect(prisma.storeReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) })
      );
    });
  });

  describe('completeReservation', () => {
    it('should throw when reservation not found', async () => {
      prisma.storeReservation.findUnique.mockResolvedValue(null);
      await expect(storeService.completeReservation('RESV-999')).rejects.toThrow('non trouvée');
    });

    it('should throw when reservation is not pending', async () => {
      prisma.storeReservation.findUnique.mockResolvedValue({ status: 'cancelled', productId: 1 });
      await expect(storeService.completeReservation('RESV-abc')).rejects.toThrow('en attente');
    });

    it('should complete reservation and decrement stock', async () => {
      prisma.storeReservation.findUnique.mockResolvedValue({
        displayId: 'RESV-abc', status: 'pending', productId: 1, quantity: 2
      });
      prisma.storeProduct.update.mockResolvedValue({});
      prisma.storeReservation.update.mockResolvedValue({ status: 'completed' });
      prisma.storeProduct.findUnique.mockResolvedValue({ ...mockProduct, StoreReservation: [] });

      await storeService.completeReservation('RESV-abc');
      expect(prisma.storeProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: { decrement: 2 } } })
      );
    });
  });

  describe('getStoreStats', () => {
    it('should return store statistics', async () => {
      prisma.storeProduct.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
      prisma.storeReservation.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(40);
      prisma.storeReservation.aggregate.mockResolvedValue({ _sum: { totalPrice: 500 } });
      prisma.storeProduct.findMany.mockResolvedValue([]);

      const result = await storeService.getStoreStats(1);
      expect(result.totalProducts).toBe(10);
      expect(result.activeProducts).toBe(8);
      expect(result.totalRevenue).toBe(500);
    });

    it('should return 0 totalRevenue when no completed reservations', async () => {
      prisma.storeProduct.count.mockResolvedValue(0);
      prisma.storeReservation.count.mockResolvedValue(0);
      prisma.storeReservation.aggregate.mockResolvedValue({ _sum: { totalPrice: null } });
      prisma.storeProduct.findMany.mockResolvedValue([]);

      const result = await storeService.getStoreStats(1);
      expect(result.totalRevenue).toBe(0);
    });
  });

});
