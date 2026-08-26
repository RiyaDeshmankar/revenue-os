import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecoveryAction } from './entities/recovery-action.entity';
import { Payment } from '../payments/entities/payment.entity';

@Injectable()
export class RecoveryService {
  constructor(
    @InjectRepository(RecoveryAction)
    private repo: Repository<RecoveryAction>,

    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
  ) {}

  create(paymentId: string, reason?: string, amount?: number) {
    const priority =
      (amount ?? 0) >= 10000
        ? 'high'
        : (amount ?? 0) >= 5000
          ? 'medium'
          : 'low';

    const strategy =
      reason === 'insufficient_funds'
        ? 'delayed_retry'
        : reason === 'bank_failure'
          ? 'quick_retry'
          : reason === 'expired_card'
            ? 'payment_method_update'
            : 'standard_retry';

    return this.repo.save({
      paymentId,
      status: 'pending',
      retryCount: 0,
      strategy,
      priority,
    });
  }

  async findAll() {
    const recoveries = await this.repo.find();

    return Promise.all(
      recoveries.map(async (recovery) => {
        const payment = await this.paymentRepo.findOneBy({
          id: recovery.paymentId,
        });

        return {
          ...recovery,
          orderId: payment?.orderId ?? 'Unknown',
          amount: payment?.amount ?? 0,
          failureReason: payment?.failureReason ?? 'Unknown',
        };
      }),
    );
  }

  async retry(id: string) {
  const action = await this.repo.findOneBy({ id });

  if (!action) {
    return { message: 'Recovery not found' };
  }

  // Expired card → user must update payment method
  if (action.strategy === 'payment_method_update') {
    action.status = 'action_required';
    return this.repo.save(action);
  }

  action.retryCount++;

  // Simulate successful recovery on the 2nd quick retry
  if (
    action.strategy === 'quick_retry' &&
    action.retryCount === 2
  ) {
    const payment = await this.paymentRepo.findOneBy({
      id: action.paymentId,
    });

    if (payment) {
      payment.status = 'success';
      await this.paymentRepo.save(payment);
    }

    action.status = 'recovered';
    action.nextRetryAt = null;

    return this.repo.save(action);
  }

  // Maximum retry limit
  if (action.retryCount >= 3) {
    action.status = 'failed';
    action.nextRetryAt = null;
  } else {
    action.status = 'retrying';

    const delay =
      action.strategy === 'quick_retry'
        ? 2
        : action.strategy === 'delayed_retry'
          ? 15
          : 5;

    action.nextRetryAt = new Date(
      Date.now() + delay * 60 * 1000,
    );
  }

  return this.repo.save(action);
}

  findByPriority(priority: string) {
    return this.repo.find({
      where: { priority },
    });
  }

  async cancelForPayment(paymentId: string) {
    const actions = await this.repo.find({
      where: { paymentId },
    });

    for (const action of actions) {
      if (
        action.status === 'pending' ||
        action.status === 'retrying'
      ) {
        action.status = 'cancelled';
        action.nextRetryAt = null;

        await this.repo.save(action);
      }
    }

    return { message: 'Recovery cancelled' };
  }
}