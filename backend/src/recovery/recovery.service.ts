import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RecoveryAction } from './entities/recovery-action.entity';
import { Payment } from '../payments/entities/payment.entity';

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    @InjectRepository(RecoveryAction)
    private repo: Repository<RecoveryAction>,

    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
  ) {}

  // =========================================================
  // CREATE RECOVERY ACTION
  // =========================================================

  create(paymentId: string, reason?: string, amount?: number) {
    const paymentAmount = amount ?? 0;

    // -------------------------
    // Priority
    // -------------------------

    let priority = 'low';

    if (paymentAmount >= 10000) {
      priority = 'high';
    } else if (paymentAmount >= 5000) {
      priority = 'medium';
    }

    // -------------------------
    // Recovery intelligence
    // -------------------------

    let strategy = 'standard_retry';
    let recoveryScore = 50;
    let confidence = 60;

    let decisionReason =
      'Failure reason is unknown, so the standard recovery flow is recommended.';

    switch (reason) {
      case 'bank_failure':
        strategy = 'quick_retry';
        recoveryScore = 85;
        confidence = 90;

        decisionReason =
          'Bank failure is usually temporary, so a quick retry has a high recovery probability.';
        break;

      case 'insufficient_funds':
        strategy = 'delayed_retry';
        recoveryScore = 65;
        confidence = 82;

        decisionReason =
          'Insufficient funds may be temporary, so retrying later gives the customer time to restore their balance.';
        break;

      case 'expired_card':
        strategy = 'payment_method_update';
        recoveryScore = 35;
        confidence = 95;

        decisionReason =
          'The payment method is expired, so another automatic retry is unlikely to succeed.';
        break;

      default:
        strategy = 'standard_retry';
        recoveryScore = 50;
        confidence = 60;

        decisionReason =
          'The failure reason is unknown, so the standard recovery flow is recommended.';
    }

    // High-value payments get extra attention.
    if (paymentAmount >= 10000) {
      recoveryScore = Math.min(recoveryScore + 10, 100);
    }

    return this.repo.save({
      paymentId,
      status: 'pending',
      retryCount: 0,
      strategy,
      priority,
      recoveryScore,
      confidence,
      reason: decisionReason,
    });
  }

  // =========================================================
  // GET ALL RECOVERIES
  // =========================================================

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

  // =========================================================
  // RETRY RECOVERY
  // =========================================================

  async retry(id: string) {
    const action = await this.repo.findOneBy({ id });

    if (!action) {
      this.logger.warn(`Recovery not found: ${id}`);

      return {
        message: 'Recovery not found',
      };
    }

    this.logger.log(
      `Retry requested | id=${id} | strategy=${action.strategy} | currentRetries=${action.retryCount}`,
    );

    // ---------------------------------------------------------
    // EXPIRED CARD
    // ---------------------------------------------------------

    if (action.strategy === 'payment_method_update') {
      action.status = 'action_required';
      action.nextRetryAt = null;

      this.logger.log(
        `Payment method update required | id=${id}`,
      );

      return this.repo.save(action);
    }

    // ---------------------------------------------------------
    // INCREMENT RETRY COUNT
    // ---------------------------------------------------------

    action.retryCount++;

    this.logger.log(
      `Retry attempt ${action.retryCount} | id=${id}`,
    );

    // ---------------------------------------------------------
    // QUICK RETRY SUCCESS
    // ---------------------------------------------------------

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

        this.logger.log(
          `Payment recovered successfully | paymentId=${payment.id} | amount=${payment.amount}`,
        );
      }

      action.status = 'recovered';
      action.nextRetryAt = null;

      return this.repo.save(action);
    }

    // ---------------------------------------------------------
    // MAXIMUM RETRIES
    // ---------------------------------------------------------

    if (action.retryCount >= 3) {
      action.status = 'failed';
      action.nextRetryAt = null;

      this.logger.warn(
        `Maximum retries reached | id=${id}`,
      );

      return this.repo.save(action);
    }

    // ---------------------------------------------------------
    // SCHEDULE NEXT RETRY
    // ---------------------------------------------------------

    action.status = 'retrying';

    // TESTING:
    // Every strategy waits 1 minute.
    //
    // Later we'll make this intelligent:
    // quick_retry -> 2 minutes
    // delayed_retry -> 15 minutes
    // standard_retry -> 5 minutes

    const delayMinutes = 1;

    action.nextRetryAt = new Date(
      Date.now() + delayMinutes * 60 * 1000,
    );

    this.logger.log(
      `Retry scheduled | id=${id} | retry=${action.retryCount} | nextRetryAt=${action.nextRetryAt.toISOString()}`,
    );

    return this.repo.save(action);
  }

  // =========================================================
  // FIND BY PRIORITY
  // =========================================================

  findByPriority(priority: string) {
    return this.repo.find({
      where: { priority },
    });
  }

  // =========================================================
  // CANCEL RECOVERY
  // =========================================================

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

    return {
      message: 'Recovery cancelled',
    };
  }

  // =========================================================
  // 🤖 AUTOMATIC RECOVERY WORKER
  // =========================================================

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processScheduledRecoveries() {
    const now = new Date();

    this.logger.log(
      `🤖 Recovery worker running | ${now.toISOString()}`,
    );

    const actions = await this.repo
      .createQueryBuilder('action')
      .where('action.status = :status', {
        status: 'retrying',
      })
      .andWhere('action.nextRetryAt IS NOT NULL')
      .andWhere('action.nextRetryAt <= :now', {
        now,
      })
      .getMany();

    this.logger.log(
      `📋 Scheduled recoveries found: ${actions.length}`,
    );

    for (const action of actions) {
      this.logger.log(
        `⚡ Automatically retrying recovery ${action.id} | attempt=${action.retryCount + 1}`,
      );

      try {
        await this.retry(action.id);
      } catch (error) {
        this.logger.error(
          `Automatic retry failed | id=${action.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}