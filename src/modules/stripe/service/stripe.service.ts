import { Injectable, Logger, OnModuleInit, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { ApiError } from '../../../common/http/api-error';
import { ERROR_MESSAGES } from '../../../common/constants';

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not defined in environment variables.',
      );
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
    } as unknown as Stripe.StripeConfig);
    this.logger.log('Stripe Service Initialized');
  }

  async getCustomerByEmail(email: string) {
    try {
      const customers = await this.stripe.customers.list({
        email,
        limit: 1,
      });
      return customers.data.length > 0 ? customers.data[0] : null;
    } catch (error) {
      this.logger.error(`Error fetching customer by email: ${email}`, error);
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.STRIPE.CUSTOMER_NOT_FOUND,
      );
    }
  }

  async createCustomer(email: string, name?: string) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
      });
      this.logger.log(`Stripe customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      this.logger.error(`Error creating customer: ${email}`, error);
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.STRIPE.CUSTOMER_CREATE_FAILED,
      );
    }
  }

  async listPaymentIntents(customerId: string) {
    try {
      const paymentIntents = await this.stripe.paymentIntents.list({
        customer: customerId,
        limit: 100,
        expand: ['data.latest_charge'],
      });
      return paymentIntents.data;
    } catch (error) {
      this.logger.error(
        `Error listing payment intents for customer: ${customerId}`,
        error,
      );
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.STRIPE.PAYMENT_INTENT_CREATE_FAILED,
      );
    }
  }

  async createPaymentIntent(
    amount: number,
    currency: string = 'inr',
    customerId?: string,
  ) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to smallest currency unit
        currency: currency.toLowerCase(),
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
      });
      this.logger.log(`Stripe payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating Payment Intent: ${message}`);
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.STRIPE.PAYMENT_INTENT_CREATE_FAILED,
      );
    }
  }

  async confirmPayment(paymentIntentId: string, paymentMethodId: string) {
    try {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173';
      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
          return_url: `${frontendUrl}/dashboard?payment=success`,
        },
      );
      this.logger.log(
        `Explicitly confirmed Stripe payment intent: ${paymentIntent.id} - ${paymentIntent.status}`,
      );
      return paymentIntent;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error during explicit payment confirmation: ${message}`,
      );
      throw error;
    }
  }

  async createSubscription(customerId: string, priceId: string) {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      this.logger.log(`Stripe subscription created: ${subscription.id}`);
      return subscription;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating Subscription: ${message}`);
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.STRIPE.SUBSCRIPTION_CREATE_FAILED,
      );
    }
  }

  async getOrCreatePrice(
    unitAmount: number,
    currency: string = 'inr',
    interval: 'month' | 'year' = 'month',
    productName: string = 'Membership Installment',
  ) {
    try {
      // First, find or create the product
      const products = await this.stripe.products.list({ limit: 100 });
      let product = products.data.find((p) => p.name === productName);

      if (!product) {
        product = await this.stripe.products.create({
          name: productName,
        });
        this.logger.log(`Created new Stripe product: ${product.id}`);
      }

      // Then, find or create the price
      const prices = await this.stripe.prices.list({
        product: product.id,
        active: true,
      });

      let price = prices.data.find(
        (p) =>
          p.unit_amount === unitAmount &&
          p.currency === currency.toLowerCase() &&
          p.recurring?.interval === interval,
      );

      if (!price) {
        price = await this.stripe.prices.create({
          unit_amount: unitAmount,
          currency: currency.toLowerCase(),
          recurring: { interval },
          product: product.id,
        });
        this.logger.log(`Created new Stripe price: ${price.id}`);
      }

      return price;
    } catch (error) {
      this.logger.error(`Error in getOrCreatePrice: ${error}`);
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to setup product price in Stripe',
      );
    }
  }

  async listInvoices(customerId: string) {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit: 100,
      });
      return invoices.data;
    } catch (error) {
      this.logger.error(
        `Error listing invoices for customer: ${customerId}`,
        error,
      );
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to list invoices',
      );
    }
  }
}
