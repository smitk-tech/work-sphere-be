import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './service/stripe.service';
import { ConfigService } from '@nestjs/config';
import { Logger, HttpStatus } from '@nestjs/common';
import Stripe from 'stripe';

// Mock Stripe module
jest.mock('stripe', () => {
  return jest.fn(() => ({
    customers: {
      list: jest.fn(),
      create: jest.fn(),
    },
    paymentIntents: {
      list: jest.fn(),
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
  }));
});

describe('Stripe Module - Service', () => {
  let stripeService: StripeService;
  let configService: ConfigService;

  const mockStripeSecretKey = 'sk_test_123456789';

  const mockCustomer = {
    id: 'cus_123456',
    email: 'user@example.com',
    name: 'John Doe',
    object: 'customer',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'STRIPE_SECRET_KEY') {
                return mockStripeSecretKey;
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    stripeService = module.get<StripeService>(StripeService);
    configService = module.get<ConfigService>(ConfigService);

    // Initialize Stripe service
    stripeService.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('StripeService.getCustomerByEmail', () => {
    it('should return customer if found by email', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'list')
        .mockResolvedValueOnce({
          data: [mockCustomer],
        });

      const result = await stripeService.getCustomerByEmail('user@example.com');

      expect(result).toEqual(mockCustomer);
      expect(mockStripeSdk.customers.list).toHaveBeenCalledWith({
        email: 'user@example.com',
        limit: 1,
      });
    });

    it('should return null if customer not found by email', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'list')
        .mockResolvedValueOnce({
          data: [],
        });

      const result = await stripeService.getCustomerByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should throw error on Stripe API failure', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'list')
        .mockRejectedValueOnce(new Error('Stripe API Error'));

      await expect(
        stripeService.getCustomerByEmail('user@example.com'),
      ).rejects.toThrow();
    });

    it('should correctly format email parameter', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'list')
        .mockResolvedValueOnce({
          data: [mockCustomer],
        });

      const testEmail = 'test+tag@example.com';
      await stripeService.getCustomerByEmail(testEmail);

      expect(mockStripeSdk.customers.list).toHaveBeenCalledWith({
        email: testEmail,
        limit: 1,
      });
    });

    it('should handle multiple customers by returning first one', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'list')
        .mockResolvedValueOnce({
          data: [
            mockCustomer,
            { ...mockCustomer, id: 'cus_789' },
          ],
        });

      const result = await stripeService.getCustomerByEmail('user@example.com');

      expect(result.id).toBe('cus_123456');
    });
  });

  describe('StripeService.createCustomer', () => {
    it('should successfully create a customer', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'create')
        .mockResolvedValueOnce(mockCustomer);

      const result = await stripeService.createCustomer('user@example.com', 'John Doe');

      expect(result).toEqual(mockCustomer);
      expect(mockStripeSdk.customers.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        name: 'John Doe',
      });
    });

    it('should create customer with email only', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'create')
        .mockResolvedValueOnce({
          ...mockCustomer,
          name: undefined,
        });

      const result = await stripeService.createCustomer('user@example.com');

      expect(mockStripeSdk.customers.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        name: undefined,
      });
    });

    it('should throw error if customer creation fails', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'create')
        .mockRejectedValueOnce(new Error('Customer creation failed'));

      await expect(
        stripeService.createCustomer('user@example.com', 'John Doe'),
      ).rejects.toThrow();
    });

    it('should handle special characters in name', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'create')
        .mockResolvedValueOnce({
          ...mockCustomer,
          name: "O'Brien-Smith",
        });

      const result = await stripeService.createCustomer(
        'user@example.com',
        "O'Brien-Smith",
      );

      expect(mockStripeSdk.customers.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        name: "O'Brien-Smith",
      });
    });

    it('should return customer with id property', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.customers, 'create')
        .mockResolvedValueOnce(mockCustomer);

      const result = await stripeService.createCustomer('user@example.com');

      expect(result).toHaveProperty('id');
      expect(result.id).toMatch(/^cus_/);
    });
  });

  describe('StripeService.listPaymentIntents', () => {
    it('should return payment intents for customer', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'list')
        .mockResolvedValueOnce({
          data: [mockPaymentIntent],
        });

      const result = await stripeService.listPaymentIntents('cus_123456');

      expect(result).toEqual([mockPaymentIntent]);
      expect(mockStripeSdk.paymentIntents.list).toHaveBeenCalledWith({
        customer: 'cus_123456',
        limit: 100,
        expand: ['data.latest_charge'],
      });
    });

    it('should return empty array if no payment intents found', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'list')
        .mockResolvedValueOnce({
          data: [],
        });

      const result = await stripeService.listPaymentIntents('cus_123456');

      expect(result).toEqual([]);
    });

    it('should throw error on Stripe API failure', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'list')
        .mockRejectedValueOnce(new Error('Stripe API Error'));

      await expect(
        stripeService.listPaymentIntents('cus_123456'),
      ).rejects.toThrow();
    });

    it('should limit results to 100', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'list')
        .mockResolvedValueOnce({
          data: Array(100)
            .fill(null)
            .map((_, i) => ({
              ...mockPaymentIntent,
              id: `pi_${i}`,
            })),
        });

      const result = await stripeService.listPaymentIntents('cus_123456');

      expect(result).toHaveLength(100);
      expect(mockStripeSdk.paymentIntents.list).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        }),
      );
    });

    it('should expand latest charge data', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'list')
        .mockResolvedValueOnce({
          data: [mockPaymentIntent],
        });

      await stripeService.listPaymentIntents('cus_123456');

      expect(mockStripeSdk.paymentIntents.list).toHaveBeenCalledWith(
        expect.objectContaining({
          expand: ['data.latest_charge'],
        }),
      );
    });

    it('should handle multiple payment intents', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      const intents = [
        mockPaymentIntent,
        { ...mockPaymentIntent, id: 'pi_789' },
        { ...mockPaymentIntent, id: 'pi_456' },
      ];

      jest
        .spyOn(mockStripeSdk.paymentIntents, 'list')
        .mockResolvedValueOnce({
          data: intents,
        });

      const result = await stripeService.listPaymentIntents('cus_123456');

      expect(result).toHaveLength(3);
      expect(result.map((pi) => pi.id)).toEqual(['pi_123456', 'pi_789', 'pi_456']);
    });
  });

  describe('StripeService.createPaymentIntent', () => {
    it('should successfully create payment intent', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockResolvedValueOnce(mockPaymentIntent);

      const result = await stripeService.createPaymentIntent(
        500,
        'inr',
        'cus_123456',
      );

      expect(result).toEqual(mockPaymentIntent);
      expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith({
        amount: 50000,
        currency: 'inr',
        customer: 'cus_123456',
        automatic_payment_methods: {
          enabled: true,
        },
      });
    });

    it('should convert amount to smallest currency unit', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockResolvedValueOnce(mockPaymentIntent);

      await stripeService.createPaymentIntent(
        100,
        'inr',
        'cus_123456',
      );

      expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000,
        }),
      );
    });

    it('should use default currency if not provided', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockResolvedValueOnce(mockPaymentIntent);

      await stripeService.createPaymentIntent(500);

      expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'inr',
        }),
      );
    });

    it('should handle lowercase currency', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockResolvedValueOnce(mockPaymentIntent);

      await stripeService.createPaymentIntent(500, 'USD', 'cus_123456');

      expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'usd',
        }),
      );
    });

    it('should throw error if payment intent creation fails', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockRejectedValueOnce(new Error('Payment intent creation failed'));

      await expect(
        stripeService.createPaymentIntent(500, 'inr', 'cus_123456'),
      ).rejects.toThrow();
    });

    it('should create payment intent without customer ID', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockResolvedValueOnce({
          ...mockPaymentIntent,
          customer: undefined,
        });

      const result = await stripeService.createPaymentIntent(500, 'inr');

      expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: undefined,
        }),
      );
    });

    it('should enable automatic payment methods', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockResolvedValueOnce(mockPaymentIntent);

      await stripeService.createPaymentIntent(500, 'inr', 'cus_123456');

      expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          automatic_payment_methods: {
            enabled: true,
          },
        }),
      );
    });

    it('should handle decimal amounts correctly', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockResolvedValueOnce(mockPaymentIntent);

      await stripeService.createPaymentIntent(99.99, 'inr', 'cus_123456');

      expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 9999,
        }),
      );
    });

    it('should return payment intent with id property', async () => {
      const mockStripeSdk = (stripeService as any).stripe;
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockResolvedValueOnce(mockPaymentIntent);

      const result = await stripeService.createPaymentIntent(500, 'inr');

      expect(result).toHaveProperty('id');
      expect(result.id).toMatch(/^pi_/);
    });
  });

  describe('StripeService.onModuleInit', () => {
    it('should initialize Stripe with secret key from config', () => {
      expect(configService.get).toHaveBeenCalledWith('STRIPE_SECRET_KEY');
    });

    it('should log warning if STRIPE_SECRET_KEY is not defined', async () => {
      const moduleWithoutKey = await Test.createTestingModule({
        providers: [
          StripeService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => null),
            },
          },
        ],
      }).compile();

      const service = moduleWithoutKey.get<StripeService>(StripeService);
      const loggerSpy = jest.spyOn(Logger.prototype, 'warn');

      service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should create customer and then list payment intents', async () => {
      const mockStripeSdk = (stripeService as any).stripe;

      // Create customer
      jest
        .spyOn(mockStripeSdk.customers, 'create')
        .mockResolvedValueOnce(mockCustomer);
      const customer = await stripeService.createCustomer('user@example.com');

      expect(customer.id).toBe('cus_123456');

      // List payment intents for customer
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'list')
        .mockResolvedValueOnce({
          data: [mockPaymentIntent],
        });

      const intents = await stripeService.listPaymentIntents(customer.id);

      expect(intents).toHaveLength(1);
      expect(intents[0].customer).toBe('cus_123456');
    });

    it('should complete full payment flow', async () => {
      const mockStripeSdk = (stripeService as any).stripe;

      // Find or create customer
      jest
        .spyOn(mockStripeSdk.customers, 'list')
        .mockResolvedValueOnce({ data: [] });
      jest
        .spyOn(mockStripeSdk.customers, 'create')
        .mockResolvedValueOnce(mockCustomer);

      const customer = await stripeService.createCustomer('user@example.com');

      // Create payment intent
      jest
        .spyOn(mockStripeSdk.paymentIntents, 'create')
        .mockResolvedValueOnce(mockPaymentIntent);

      const paymentIntent = await stripeService.createPaymentIntent(
        500,
        'inr',
        customer.id,
      );

      expect(paymentIntent.customer).toBe(customer.id);
      expect(paymentIntent.status).toBe('succeeded');
    });
  });
});
