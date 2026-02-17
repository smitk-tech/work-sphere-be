import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from '../../stripe/service/stripe.service';
import { ApiError } from '../../../common/http/api-error';
import { ERROR_MESSAGES } from '../../../common/constants';
import Stripe from 'stripe';

export interface PaymentHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  description: string;
  type: 'one_time' | 'subscription';
  downloadUrl?: string;
  paymentIntentId: string;
  subscriptionId?: string;
}

/**
 * Extended Stripe types to handle expanded fields safely without 'any'
 */
interface StripeInvoice extends Stripe.Invoice {
  charge?: string | Stripe.Charge | null;
  subscription?: string | Stripe.Subscription | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
}

interface StripeSubscription extends Stripe.Subscription {
  latest_invoice: string | StripeInvoice | null;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        ERROR_MESSAGES.PAYMENT.USER_NOT_FOUND,
      );
    }

    if (user.customerId) {
      return user.customerId;
    }

    // Check if customer exists in Stripe by email
    const existingCustomer = await this.stripeService.getCustomerByEmail(
      user.email,
    );

    if (existingCustomer) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { customerId: existingCustomer.id },
      });
      return existingCustomer.id;
    }

    // Create new customer if not found
    const newCustomer = await this.stripeService.createCustomer(
      user.email,
      `${user.firstName} ${user.lastName}`,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { customerId: newCustomer.id },
    });

    return newCustomer.id;
  }

  async getPaymentHistoryByCustomerId(email: string) {
    if (!email) {
      return [];
    }

    const decodedEmail = decodeURIComponent(email);
    const user = await this.prisma.user.findUnique({
      where: { email: decodedEmail },
    });
    if (!user || (!user.id && !user.customerId)) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        ERROR_MESSAGES.PAYMENT.USER_NOT_FOUND,
      );
    }

    const [paymentIntents, invoices] = await Promise.all([
      this.stripeService.listPaymentIntents(user.customerId ?? ''),
      this.stripeService.listInvoices(user.customerId ?? ''),
    ]);

    const history: PaymentHistoryItem[] = [
      ...paymentIntents
        .filter(
          (pi: Stripe.PaymentIntent) => !(pi as { invoice?: unknown }).invoice,
        )
        .map((pi: Stripe.PaymentIntent) => {
          const latestCharge = pi.latest_charge as Stripe.Charge;
          const isRefunded = latestCharge?.refunded || false;
          return {
            id: pi.id,
            amount: pi.amount / 100,
            currency: pi.currency,
            status: isRefunded ? 'refunded' : pi.status,
            createdAt: new Date(pi.created * 1000).toISOString(),
            description: pi.description || 'Stripe Payment',
            type: 'one_time' as const,
            downloadUrl: latestCharge?.receipt_url || undefined,
            paymentIntentId: pi.id,
          };
        }),
      ...invoices.map((inv: Stripe.Invoice) => {
        const expandedInv = inv as StripeInvoice;
        const charge = expandedInv.charge as Stripe.Charge | string | null;
        const isRefunded =
          charge && typeof charge !== 'string' && charge.refunded;

        return {
          id: inv.id,
          amount: inv.total / 100,
          currency: inv.currency,
          status: isRefunded
            ? 'refunded'
            : inv.status === 'paid'
              ? 'succeeded'
              : inv.status || 'unknown',
          createdAt: new Date(inv.created * 1000).toISOString(),
          description: inv.number || 'Stripe Invoice',
          type: 'subscription' as const,
          downloadUrl: inv.invoice_pdf || undefined,
          paymentIntentId: '',
          subscriptionId:
            typeof expandedInv.subscription === 'string'
              ? expandedInv.subscription
              : (expandedInv.subscription as Stripe.Subscription | null)?.id,
        };
      }),
    ];

    // Sort by date descending
    return history.sort(
      (a: PaymentHistoryItem, b: PaymentHistoryItem) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async refundPayment(id: string) {
    if (!id) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'Payment ID is required for refund',
      );
    }

    let targetPiId = id;

    // If it's a subscription ID, we need to find its latest successful Payment Intent ID
    if (id.startsWith('sub_')) {
      this.logger.log(`Resolving Payment Intent for subscription: ${id}`);

      const subscriptionResult = await (
        this.stripeService as unknown as {
          getSubscriptionWithLatestInvoice: (
            id: string,
          ) => Promise<Stripe.Subscription>;
        }
      ).getSubscriptionWithLatestInvoice(id);

      const subscription = subscriptionResult as StripeSubscription;
      const latestInvoice = subscription.latest_invoice as StripeInvoice | null;
      const piId =
        typeof latestInvoice?.payment_intent === 'string'
          ? latestInvoice.payment_intent
          : (latestInvoice?.payment_intent as Stripe.PaymentIntent | null)?.id;

      if (!piId) {
        throw new ApiError(
          HttpStatus.NOT_FOUND,
          'Could not identify a payment for this subscription to refund',
        );
      }
      targetPiId = piId;
    }

    return this.stripeService.createRefund(targetPiId);
  }

  async updateCustomerId(userId: string, customerId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { customerId },
    });
  }

  async createSubscription(
    amount: number,
    currency: string,
    userEmail: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: userEmail },
    });
    if (!user) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        ERROR_MESSAGES.PAYMENT.USER_NOT_FOUND,
      );
    }

    const customerId = await this.getOrCreateStripeCustomer(user.id);

    const price = await this.stripeService.getOrCreatePrice(
      amount * 100,
      currency || 'inr',
      'month',
    );

    const subscription = await this.stripeService.createSubscription(
      customerId,
      price.id,
    );

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice & {
      payment_intent: Stripe.PaymentIntent;
    };
    const paymentIntent = latestInvoice.payment_intent;

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret,
    };
  }

  async updatePaymentStatus(paymentIntentId: string, status: string) {
    this.logger.log(
      `Updating payment status for intent ${paymentIntentId} to ${status}`,
    );

    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!transaction) {
      this.logger.error(
        `No transaction found for payment intent ${paymentIntentId}`,
      );
      return;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status },
    });

    if (status === 'succeeded') {
      await this.prisma.userPayment.update({
        where: { id: transaction.userPaymentId },
        data: { status: 'COMPLETED' },
      });
    }
  }
}
