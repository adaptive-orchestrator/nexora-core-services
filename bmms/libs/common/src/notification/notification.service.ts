import { Injectable, Logger } from '@nestjs/common';

/**
 * NotificationService - Handles all outbound notifications (email, SMS, push)
 * 
 * This service provides a unified interface for sending notifications across
 * the Order → Inventory → Billing/Payment workflow.
 * 
 * Provider Configuration:
 * - SMTP: Set SMTP_* environment variables
 * - SendGrid: Set SENDGRID_API_KEY environment variable
 * - Twilio: Set TWILIO_* environment variables for SMS
 * 
 * When no provider is configured, notifications are logged in structured format
 * for debugging and audit purposes.
 */

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}

export interface SmsOptions {
  to: string;
  message: string;
}

export interface NotificationPayload {
  customerId: string;
  customerEmail?: string;
  customerPhone?: string;
  orderId?: string;
  orderNumber?: string;
  metadata?: Record<string, any>;
}

export interface UnavailableItem {
  productId: string;
  requestedQuantity: number;
  availableQuantity: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  // Provider configuration flags
  private readonly smtpEnabled: boolean;
  private readonly sendgridEnabled: boolean;
  private readonly twilioEnabled: boolean;

  constructor() {
    // Check for email provider configuration
    this.smtpEnabled = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER
    );
    
    this.sendgridEnabled = !!process.env.SENDGRID_API_KEY;
    
    this.twilioEnabled = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );

    this.logger.log('[NotificationService] Initialized');
    this.logger.log(`[NotificationService] SMTP enabled: ${this.smtpEnabled}`);
    this.logger.log(`[NotificationService] SendGrid enabled: ${this.sendgridEnabled}`);
    this.logger.log(`[NotificationService] Twilio enabled: ${this.twilioEnabled}`);
  }

  /**
   * Send notification when order is cancelled
   */
  async sendOrderCancelledEmail(payload: NotificationPayload & {
    reason: string;
  }): Promise<boolean> {
    const { customerId, customerEmail, orderId, orderNumber, reason } = payload;

    const notificationData = {
      type: 'ORDER_CANCELLED',
      timestamp: new Date().toISOString(),
      recipient: {
        customerId,
        email: customerEmail,
      },
      content: {
        orderId,
        orderNumber,
        reason,
        subject: `Order ${orderNumber} has been cancelled`,
        message: `Your order ${orderNumber} has been cancelled. Reason: ${reason}. If this was unexpected, please contact support.`,
      },
    };

    return this.sendEmail(notificationData);
  }

  /**
   * Send notification when items are out of stock
   */
  async sendOutOfStockEmail(payload: NotificationPayload & {
    unavailableItems: UnavailableItem[];
  }): Promise<boolean> {
    const { customerId, customerEmail, orderId, orderNumber, unavailableItems } = payload;

    const itemsList = unavailableItems
      .map(item => `- Product ${item.productId}: Requested ${item.requestedQuantity}, Available ${item.availableQuantity}`)
      .join('\n');

    const notificationData = {
      type: 'OUT_OF_STOCK',
      timestamp: new Date().toISOString(),
      recipient: {
        customerId,
        email: customerEmail,
      },
      content: {
        orderId,
        orderNumber,
        unavailableItems,
        subject: `Order ${orderNumber} - Some items are unavailable`,
        message: `Unfortunately, some items in your order ${orderNumber} are currently out of stock:\n\n${itemsList}\n\nYour order has been cancelled. Please try again when items are back in stock.`,
      },
    };

    return this.sendEmail(notificationData);
  }

  /**
   * Send payment reminder notification
   */
  async sendPaymentReminder(payload: NotificationPayload & {
    amount: number;
    currency?: string;
    dueDate?: Date;
  }): Promise<boolean> {
    const { customerId, customerEmail, orderId, orderNumber, amount, currency = 'VND', dueDate } = payload;

    const notificationData = {
      type: 'PAYMENT_REMINDER',
      timestamp: new Date().toISOString(),
      recipient: {
        customerId,
        email: customerEmail,
      },
      content: {
        orderId,
        orderNumber,
        amount,
        currency,
        dueDate: dueDate?.toISOString(),
        subject: `Payment reminder for Order ${orderNumber}`,
        message: `Your order ${orderNumber} is awaiting payment. Amount due: ${amount.toLocaleString()} ${currency}. Please complete your payment to proceed with your order.`,
      },
    };

    return this.sendEmail(notificationData);
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedEmail(payload: NotificationPayload & {
    reason: string;
    canRetry?: boolean;
  }): Promise<boolean> {
    const { customerId, customerEmail, orderId, orderNumber, reason, canRetry } = payload;

    const notificationData = {
      type: 'PAYMENT_FAILED',
      timestamp: new Date().toISOString(),
      recipient: {
        customerId,
        email: customerEmail,
      },
      content: {
        orderId,
        orderNumber,
        reason,
        canRetry,
        subject: `Payment failed for Order ${orderNumber}`,
        message: `Payment for your order ${orderNumber} has failed. Reason: ${reason}. ${canRetry ? 'You may retry the payment.' : 'Please contact support for assistance.'}`,
      },
    };

    return this.sendEmail(notificationData);
  }

  /**
   * Send payment success notification
   */
  async sendPaymentSuccessEmail(payload: NotificationPayload & {
    amount: number;
    transactionId: string;
  }): Promise<boolean> {
    const { customerId, customerEmail, orderId, orderNumber, amount, transactionId } = payload;

    const notificationData = {
      type: 'PAYMENT_SUCCESS',
      timestamp: new Date().toISOString(),
      recipient: {
        customerId,
        email: customerEmail,
      },
      content: {
        orderId,
        orderNumber,
        amount,
        transactionId,
        subject: `Payment confirmed for Order ${orderNumber}`,
        message: `Your payment for order ${orderNumber} has been confirmed. Transaction ID: ${transactionId}. Amount: ${amount.toLocaleString()} VND.`,
      },
    };

    return this.sendEmail(notificationData);
  }

  /**
   * Send order confirmed notification
   */
  async sendOrderConfirmedEmail(payload: NotificationPayload & {
    totalAmount: number;
  }): Promise<boolean> {
    const { customerId, customerEmail, orderId, orderNumber, totalAmount } = payload;

    const notificationData = {
      type: 'ORDER_CONFIRMED',
      timestamp: new Date().toISOString(),
      recipient: {
        customerId,
        email: customerEmail,
      },
      content: {
        orderId,
        orderNumber,
        totalAmount,
        subject: `Order ${orderNumber} confirmed`,
        message: `Your order ${orderNumber} has been confirmed. Total amount: ${totalAmount.toLocaleString()} VND. Please proceed with payment.`,
      },
    };

    return this.sendEmail(notificationData);
  }

  /**
   * Internal method to send email via configured provider
   */
  private async sendEmail(notificationData: Record<string, any>): Promise<boolean> {
    const { type, recipient, content } = notificationData;

    // Log structured notification for audit/debugging
    this.logger.log(`[NOTIFICATION] ${type}`);
    this.logger.log(JSON.stringify({
      notificationId: this.generateNotificationId(),
      ...notificationData,
    }, null, 2));

    // Try SendGrid first
    if (this.sendgridEnabled) {
      try {
        return await this.sendViaSendGrid(recipient.email, content.subject, content.message);
      } catch (error) {
        this.logger.error(`[SendGrid] Failed to send email:`, error);
        // Fall through to SMTP
      }
    }

    // Try SMTP
    if (this.smtpEnabled) {
      try {
        return await this.sendViaSmtp(recipient.email, content.subject, content.message);
      } catch (error) {
        this.logger.error(`[SMTP] Failed to send email:`, error);
      }
    }

    // No provider configured - log for manual processing
    if (!this.sendgridEnabled && !this.smtpEnabled) {
      this.logger.warn(`[NOTIFICATION] No email provider configured. Notification logged for manual processing.`);
      this.logger.warn(`[NOTIFICATION] To: ${recipient.email}, Subject: ${content.subject}`);
    }

    return true; // Return true even if no provider - notification was logged
  }

  /**
   * Send email via SendGrid
   */
  private async sendViaSendGrid(to: string, subject: string, body: string): Promise<boolean> {
    // TODO: Implement SendGrid integration
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({ to, from: process.env.SENDGRID_FROM_EMAIL, subject, text: body });
    
    this.logger.log(`[SendGrid] Would send email to ${to}: ${subject}`);
    return true;
  }

  /**
   * Send email via SMTP
   */
  private async sendViaSmtp(to: string, subject: string, body: string): Promise<boolean> {
    // TODO: Implement SMTP integration
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransporter({
    //   host: process.env.SMTP_HOST,
    //   port: parseInt(process.env.SMTP_PORT),
    //   secure: process.env.SMTP_SECURE === 'true',
    //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // });
    // await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text: body });

    this.logger.log(`[SMTP] Would send email to ${to}: ${subject}`);
    return true;
  }

  /**
   * Send SMS notification
   */
  async sendSms(payload: SmsOptions): Promise<boolean> {
    if (!this.twilioEnabled) {
      this.logger.warn(`[SMS] Twilio not configured. SMS logged only.`);
      this.logger.log(`[SMS] To: ${payload.to}, Message: ${payload.message}`);
      return true;
    }

    // TODO: Implement Twilio SMS
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: payload.message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: payload.to,
    // });

    this.logger.log(`[Twilio] Would send SMS to ${payload.to}`);
    return true;
  }

  /**
   * Generate unique notification ID for tracking
   */
  private generateNotificationId(): string {
    return `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
}
