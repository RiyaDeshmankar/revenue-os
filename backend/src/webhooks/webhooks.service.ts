import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from '../payments/payments.service';
import { WebhookEvent } from './entities/webhook-event.entity';

@Injectable()
export class WebhooksService {
  constructor(
    private payments: PaymentsService,
    @InjectRepository(WebhookEvent)
    private events: Repository<WebhookEvent>,
  ) {}

  async handle(event: any) {
    const existing = await this.events.findOneBy({
      eventId: event.eventId,
    });

    if (existing) {
      return {
        message: 'Webhook already processed',
        eventId: event.eventId,
      };
    }

    let result;

    if (event.event === 'payment.failed') {
      result = await this.payments.create({
        orderId: event.orderId,
        amount: event.amount,
        status: 'failed',
        failureReason: event.reason,
      });
    } else if (event.event === 'payment.succeeded') {
      result = await this.payments.markSuccessful(event.paymentId);
    } else {
      return { message: 'Event ignored' };
    }

    await this.events.save({
      eventId: event.eventId,
      event: event.event,
      processedAt: new Date(),
    });

    return result;
  }
}