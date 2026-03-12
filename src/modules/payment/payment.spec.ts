import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './controller/payment.controller';
import { PaymentService } from './service/payment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../stripe/service/stripe.service';

describe('Payment Module - Controller and Service', () => {
  let paymentController: PaymentController;
  let paymentService: PaymentService;
  let prismaService: PrismaService;
  let stripeService: StripeService;

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    customerId: 'cus_123456',
    publicKey: 'public-key',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaymentIntent = {
    id: 'pi_123456',
    amount: 50000,
    currency: 'inr',
    status: 'succeeded',
    customer: 'cus_123456',
    created: Math.floor(Date.now() / 1000),
    metadata: {},
  };

  const mockSubscription = {
    id: 'sub_123456',
    customer: 'cus_123456',
    items: {
      data: [
        {
          price: {
            amount: 99900,
            currency: 'inr',
            recurring: { interval: 'month' },
          },
        },
      ],
    },
    status: 'active',
    created: Math.floor(Date.now() / 1000),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            payment: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            createPaymentIntent: jest.fn(),
            createSubscription: jest.fn(),
            refundPayment: jest.fn(),
            listPaymentIntents: jest.fn(),
            listInvoices: jest.fn(),
            getCustomerByEmail: jest.fn(),
            createCustomer: jest.fn(),
          },
        },
      ],
    }).compile();

    paymentController = module.get<PaymentController>(PaymentController);
    paymentService = module.get<PaymentService>(PaymentService);
    prismaService = module.get<PrismaService>(PrismaService);
    stripeService = module.get<StripeService>(StripeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PaymentService.getOrCreateStripeCustomer', () => {
    it('should return existing customer ID if user has customerId', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockUser);

      const result = await paymentService.getOrCreateStripeCustomer('user-123');

      expect(result).toBe('cus_123456');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should create new customer if user does not have customerId', async () => {
      const userWithoutCustomer = { ...mockUser, customerId: null };
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(userWithoutCustomer);
      jest
        .spyOn(stripeService, 'getCustomerByEmail')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(stripeService, 'createCustomer')
        .mockResolvedValueOnce({
          id: 'cus_new_123',
          email: mockUser.email,
        });
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({
          ...mockUser,
          customerId: 'cus_new_123',
        });

      const result = await paymentService.getOrCreateStripeCustomer('user-123');

      expect(result).toBe('cus_new_123');
      expect(stripeService.createCustomer).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      await expect(
        paymentService.getOrCreateStripeCustomer('invalid-user'),
      ).rejects.toThrow();
    });

    it('should check if customer exists in Stripe before creating', async () => {
      const userWithoutCustomer = { ...mockUser, customerId: null };
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(userWithoutCustomer);
      jest
        .spyOn(stripeService, 'getCustomerByEmail')
        .mockResolvedValueOnce({
          id: 'cus_existing',
          email: mockUser.email,
        });
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({
          ...mockUser,
          customerId: 'cus_existing',
        });

      const result = await paymentService.getOrCreateStripeCustomer('user-123');

      expect(result).toBe('cus_existing');
      expect(stripeService.getCustomerByEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
    });

    it('should update user database with Stripe customer ID', async () => {
      const userWithoutCustomer = { ...mockUser, customerId: null };
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(userWithoutCustomer);
      jest
        .spyOn(stripeService, 'getCustomerByEmail')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(stripeService, 'createCustomer')
        .mockResolvedValueOnce({
          id: 'cus_new_123',
          email: mockUser.email,
        });
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({
          ...mockUser,
          customerId: 'cus_new_123',
        });

      await paymentService.getOrCreateStripeCustomer('user-123');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { customerId: 'cus_new_123' },
      });
    });
  });

  describe('PaymentService.getPaymentHistoryByCustomerId', () => {
    it('should return empty array if no email provided', async () => {
      const result = await paymentService.getPaymentHistoryByCustomerId('');

      expect(result).toEqual([]);
    });

    it('should decode URI encoded email', async () => {
      const encodedEmail = encodeURIComponent('user@example.com');
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockUser);
      jest
        .spyOn(stripeService, 'listPaymentIntents')
        .mockResolvedValueOnce([]);
      jest
        .spyOn(stripeService, 'listInvoices')
        .mockResolvedValueOnce([]);

      await paymentService.getPaymentHistoryByCustomerId(encodedEmail);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('should fetch payment history for existing user', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockUser);
      jest
        .spyOn(stripeService, 'listPaymentIntents')
        .mockResolvedValueOnce([mockPaymentIntent]);
      jest
        .spyOn(stripeService, 'listInvoices')
        .mockResolvedValueOnce([]);

      const result =
        await paymentService.getPaymentHistoryByCustomerId(mockUser.email);

      expect(result).toBeDefined();
      expect(stripeService.listPaymentIntents).toHaveBeenCalledWith(
        mockUser.customerId,
      );
    });

    it('should throw error if user not found', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      await expect(
        paymentService.getPaymentHistoryByCustomerId(mockUser.email),
      ).rejects.toThrow();
    });
  });

  describe('PaymentController.getPaymentHistory', () => {
    it('should call service with email parameter', async () => {
      jest
        .spyOn(paymentService, 'getPaymentHistoryByCustomerId')
        .mockResolvedValueOnce([]);

      await paymentController.getPaymentHistory('user@example.com');

      expect(
        paymentService.getPaymentHistoryByCustomerId,
      ).toHaveBeenCalledWith('user@example.com');
    });

    it('should return payment history from service', async () => {
      const mockHistory = [
        {
          id: 'pi_123',
          amount: 50000,
          currency: 'inr',
          status: 'succeeded',
          createdAt: new Date().toISOString(),
          description: 'Payment for subscription',
          type: 'subscription' as const,
          paymentIntentId: 'pi_123',
        },
      ];

      jest
        .spyOn(paymentService, 'getPaymentHistoryByCustomerId')
        .mockResolvedValueOnce(mockHistory);

      const result = await paymentController.getPaymentHistory('user@example.com');

      expect(result).toEqual(mockHistory);
    });

    it('should handle undefined email gracefully', async () => {
      jest
        .spyOn(paymentService, 'getPaymentHistoryByCustomerId')
        .mockResolvedValueOnce([]);

      await paymentController.getPaymentHistory();

      expect(
        paymentService.getPaymentHistoryByCustomerId,
      ).not.toHaveBeenCalled();
    });
  });

  describe('PaymentController.refundPayment', () => {
    it('should call service with payment intent ID', async () => {
      const mockRefund = {
        id: 'ref_123',
        payment_intent: 'pi_123',
        amount: 50000,
        status: 'succeeded',
      };

      jest
        .spyOn(paymentService, 'refundPayment')
        .mockResolvedValueOnce(mockRefund);

      const result = await paymentController.refundPayment({
        paymentIntentId: 'pi_123',
      });

      expect(paymentService.refundPayment).toHaveBeenCalledWith('pi_123');
      expect(result).toEqual(mockRefund);
    });

    it('should handle refund errors', async () => {
      jest
        .spyOn(paymentService, 'refundPayment')
        .mockRejectedValueOnce(new Error('Refund failed'));

      await expect(
        paymentController.refundPayment({ paymentIntentId: 'pi_123' }),
      ).rejects.toThrow('Refund failed');
    });
  });

  describe('PaymentController.createSubscription', () => {
    it('should create subscription with correct parameters', async () => {
      const mockSubscriptionResult = {
        id: 'sub_123',
        customerId: 'cus_123',
        amount: 99900,
        currency: 'inr',
        status: 'active',
      };

      jest
        .spyOn(paymentService, 'createSubscription')
        .mockResolvedValueOnce(mockSubscriptionResult);

      const result = await paymentController.createSubscription({
        amount: 999,
        currency: 'inr',
        userEmail: 'user@example.com',
      });

      expect(paymentService.createSubscription).toHaveBeenCalledWith(
        999,
        'inr',
        'user@example.com',
      );
      expect(result).toEqual(mockSubscriptionResult);
    });

    it('should use default currency if not provided', async () => {
      const mockSubscriptionResult = { id: 'sub_123', status: 'active' };

      jest
        .spyOn(paymentService, 'createSubscription')
        .mockResolvedValueOnce(mockSubscriptionResult);

      await paymentController.createSubscription({
        amount: 500,
        userEmail: 'user@example.com',
      });

      expect(paymentService.createSubscription).toHaveBeenCalledWith(
        500,
        'inr',
        'user@example.com',
      );
    });

    it('should handle subscription creation errors', async () => {
      jest
        .spyOn(paymentService, 'createSubscription')
        .mockRejectedValueOnce(new Error('Subscription creation failed'));

      await expect(
        paymentController.createSubscription({
          amount: 999,
          currency: 'inr',
          userEmail: 'user@example.com',
        }),
      ).rejects.toThrow('Subscription creation failed');
    });
  });

  describe('PaymentController.handleWebhook', () => {
    it('should handle payment_intent.succeeded event', async () => {
      const webhookEvent = {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      };

      jest
        .spyOn(paymentService, 'updatePaymentStatus')
        .mockResolvedValueOnce({});

      const request = { body: webhookEvent } as any;
      const result = await paymentController.handleWebhook(request);

      expect(result).toEqual({ received: true });
      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
        'pi_123',
        'succeeded',
      );
    });

    it('should handle payment_intent.payment_failed event', async () => {
      const webhookEvent = {
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_456' } },
      };

      jest
        .spyOn(paymentService, 'updatePaymentStatus')
        .mockResolvedValueOnce({});

      const request = { body: webhookEvent } as any;
      const result = await paymentController.handleWebhook(request);

      expect(result).toEqual({ received: true });
      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
        'pi_456',
        'failed',
      );
    });

    it('should handle unhandled webhook event types', async () => {
      const webhookEvent = {
        type: 'unknown.event',
        data: { object: { id: 'obj_123' } },
      };

      const spy = jest.spyOn(paymentService, 'updatePaymentStatus');

      const request = { body: webhookEvent } as any;
      const result = await paymentController.handleWebhook(request);

      expect(result).toEqual({ received: true });
      expect(spy).not.toHaveBeenCalled();
    });

    it('should return received true for all webhook types', async () => {
      const webhookEvents = [
        { type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } },
        { type: 'payment_intent.payment_failed', data: { object: { id: 'pi_2' } } },
        { type: 'unknown.event', data: { object: { id: 'obj_1' } } },
      ];

      for (const event of webhookEvents) {
        const request = { body: event } as any;
        const result = await paymentController.handleWebhook(request);
        expect(result).toEqual({ received: true });
      }
    });

    it('should handle webhook processing errors gracefully', async () => {
      const webhookEvent = {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_error' } },
      };

      jest
        .spyOn(paymentService, 'updatePaymentStatus')
        .mockRejectedValueOnce(new Error('Processing error'));

      const request = { body: webhookEvent } as any;
      const result = await paymentController.handleWebhook(request);

      // Should still return received: true even on error
      expect(result).toEqual({ received: true });
    });
  });

  describe('Integration Tests', () => {
    it('should complete payment flow from creation to webhook', async () => {
      // Setup user
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockUser);

      // Create subscription
      jest
        .spyOn(paymentService, 'createSubscription')
        .mockResolvedValueOnce({
          id: 'sub_123',
          status: 'active',
        });

      const subResult = await paymentController.createSubscription({
        amount: 999,
        userEmail: mockUser.email,
      });

      expect(subResult).toBeDefined();

      // Simulate webhook
      const webhookEvent = {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      };

      jest
        .spyOn(paymentService, 'updatePaymentStatus')
        .mockResolvedValueOnce({});

      const request = { body: webhookEvent } as any;
      const webhookResult = await paymentController.handleWebhook(request);

      expect(webhookResult).toEqual({ received: true });
    });

    it('should handle refund after successful payment', async () => {
      // Create payment intent
      const mockResult = { id: 'pi_123', status: 'succeeded' };
      jest
        .spyOn(paymentService, 'refundPayment')
        .mockResolvedValueOnce(mockResult);

      const result = await paymentController.refundPayment({
        paymentIntentId: 'pi_123',
      });

      expect(result.status).toBe('succeeded');
    });

    it('should get complete payment history', async () => {
      const mockHistory = [
        {
          id: 'pi_001',
          amount: 50000,
          currency: 'inr',
          status: 'succeeded',
          createdAt: new Date().toISOString(),
          description: 'Monthly subscription',
          type: 'subscription' as const,
          paymentIntentId: 'pi_001',
        },
        {
          id: 'pi_002',
          amount: 10000,
          currency: 'inr',
          status: 'succeeded',
          createdAt: new Date().toISOString(),
          description: 'One-time payment',
          type: 'one_time' as const,
          paymentIntentId: 'pi_002',
        },
      ];

      jest
        .spyOn(paymentService, 'getPaymentHistoryByCustomerId')
        .mockResolvedValueOnce(mockHistory);

      const result = await paymentController.getPaymentHistory(mockUser.email);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('subscription');
      expect(result[1].type).toBe('one_time');
    });
  });
});
