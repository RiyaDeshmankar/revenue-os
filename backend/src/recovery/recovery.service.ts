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

  private async addHistory(
  action: RecoveryAction,
  event: string,
  result?: string,
) {
  action.history = [
    ...(action.history ?? []),
    {
      action: event,
      timestamp: new Date().toISOString(),
      ...(result ? { result } : {}),
    },
  ];

  await this.repo.save(action);
}

  private async calculateIntelligence(
  payment: Payment,
  currentRetryCount = 0,
) {
  const amount = Number(payment.amount);
  const reason = payment.failureReason;

  // Learn from previous recoveries with the same failure reason
  const historicalActions = await this.repo
  .createQueryBuilder('action')
  .innerJoin(
    Payment,
    'payment',
    'payment.id::text = action.paymentId',
  )
  .where('payment.failureReason = :reason', {
    reason,
  })
  .andWhere('action.paymentId != :paymentId', {
    paymentId: payment.id,
  })
  .getMany();


  const historicalAttempts = historicalActions.length;

  const historicalRecovered = historicalActions.filter(
    (action) => action.status === 'recovered',
  ).length;

  const historicalRecoveryRate =
    historicalAttempts > 0
      ? historicalRecovered / historicalAttempts
      : 0.5;

  // -----------------------------------------
  // Base strategy
  // -----------------------------------------

  let strategy = 'standard_retry';
  let recoveryScore = 50;
  let confidence = 60;

  let decisionReason =
    'The failure reason is unknown, so the standard recovery flow is recommended.';

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
  }

  // -----------------------------------------
  // Historical learning
  // -----------------------------------------

  const historyAdjustment =
    (historicalRecoveryRate - 0.5) * 20;

  recoveryScore = Math.round(
    recoveryScore + historyAdjustment,
  );

  confidence = Math.round(
    confidence + Math.min(historicalAttempts * 2, 10),
  );

  // -----------------------------------------
  // Retry penalty
  // -----------------------------------------

  if (currentRetryCount > 0) {
    recoveryScore -= currentRetryCount * 10;
    confidence -= currentRetryCount * 3;
  }

  // -----------------------------------------
  // High-value payment
  // -----------------------------------------

  if (amount >= 10000) {
    recoveryScore += 10;
  }

  // -----------------------------------------
  // Safety bounds
  // -----------------------------------------

  recoveryScore = Math.max(
    0,
    Math.min(recoveryScore, 100),
  );

  confidence = Math.max(
    0,
    Math.min(confidence, 100),
  );

  // -----------------------------------------
  // Stop automatic retry when probability
  // becomes too low
  // -----------------------------------------

  if (
    currentRetryCount >= 2 &&
    recoveryScore < 50 &&
    strategy !== 'payment_method_update'
  ) {
    strategy = 'payment_method_update';

    decisionReason =
      'Multiple retry attempts have reduced the recovery probability, so manual customer action is recommended.';
  }

  return {
    strategy,
    recoveryScore,
    confidence,
    reason: decisionReason,
  };
}
  // =========================================================
  // CREATE RECOVERY ACTION
  // =========================================================

  async create(paymentId: string, reason?: string, amount?: number) {
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

    const intelligence = await this.calculateIntelligence(
  {
    id: paymentId,
    amount: paymentAmount,
    failureReason: reason ?? null,
  } as Payment,
);

const {
  strategy,
  recoveryScore,
  confidence,
  reason: decisionReason,
} = intelligence;


    const action = await this.repo.save({
  paymentId,
  status: 'pending',
  retryCount: 0,
  strategy,
  priority,
  recoveryScore,
  confidence,
  reason: decisionReason,
  history: [
    {
      action: 'recovery_created',
      timestamp: new Date().toISOString(),
      result: 'Recovery strategy generated',
    },
  ],
});

return action;
  }

  // =========================================================
  // GET ALL RECOVERIES
  // =========================================================

  async findAll() {
  const recoveries = await this.repo.find();

  const result = await Promise.all(
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

  // Prioritize recoveries intelligently:
  // 1. Active recoveries first
  // 2. Higher recovery score first
  // 3. Higher-value payments next
  return result.sort((a, b) => {
    const activeStatuses = [
      'pending',
      'retrying',
      'action_required',
    ];

    const aActive = activeStatuses.includes(a.status) ? 1 : 0;
    const bActive = activeStatuses.includes(b.status) ? 1 : 0;

    if (aActive !== bActive) {
      return bActive - aActive;
    }

    if (b.recoveryScore !== a.recoveryScore) {
      return b.recoveryScore - a.recoveryScore;
    }

    return Number(b.amount) - Number(a.amount);
  });
}
  // =========================================================
  // RETRY RECOVERY
  // =========================================================

  async retry(id: string) {
  const action = await this.repo.findOneBy({ id });

  if (!action) {
    this.logger.warn(`Recovery not found: ${id}`);
    return { message: 'Recovery not found' };
  }

  const payment = await this.paymentRepo.findOneBy({
    id: action.paymentId,
  });

  if (!payment) {
    return { message: 'Payment not found' };
  }

  this.logger.log(
    `Retry requested | id=${id} | strategy=${action.strategy} | currentRetries=${action.retryCount}`,
  );

  // Payment method update requires manual customer action
  if (action.strategy === 'payment_method_update') {
    action.status = 'action_required';
    action.nextRetryAt = null;

    return this.repo.save(action);
  }

  // Increment retry count
  action.retryCount++;

  await this.addHistory(
    action,
    'retry_attempted',
    `Retry attempt ${action.retryCount}`,
  );

  // Recalculate intelligence
  const intelligence = await this.calculateIntelligence(
    payment,
    action.retryCount,
  );

  action.strategy = intelligence.strategy;
  action.recoveryScore = intelligence.recoveryScore;
  action.confidence = intelligence.confidence;
  action.reason = intelligence.reason;

  // Successful quick retry on attempt 2
  if (
    intelligence.strategy === 'quick_retry' &&
    action.retryCount === 2
  ) {
    payment.status = 'success';
    await this.paymentRepo.save(payment);

    action.status = 'recovered';
    action.nextRetryAt = null;

    await this.addHistory(
      action,
      'payment_recovered',
      'Payment successfully recovered',
    );

    return this.repo.save(action);
  }

  // Maximum retries
  if (action.retryCount >= 3) {
    action.status = 'failed';
    action.nextRetryAt = null;

    return this.repo.save(action);
  }

  // Intelligence says manual action is now better
  if (intelligence.strategy === 'payment_method_update') {
    action.status = 'action_required';
    action.nextRetryAt = null;

    return this.repo.save(action);
  }

  // Schedule next automatic retry
  action.status = 'retrying';

  const delayMinutes = 1;

  action.nextRetryAt = new Date(
    Date.now() + delayMinutes * 60 * 1000,
  );

  this.logger.log(
    `Retry scheduled | id=${id} | retry=${action.retryCount} | nextRetryAt=${action.nextRetryAt.toISOString()}`,
  );

  return this.repo.save(action);
}


async getIntelligenceSummary() {
  const payments = await this.paymentRepo.find();
  const actions = await this.repo.find();

  const groups: Record<string, {
    attempts: number;
    recovered: number;
  }> = {};

  for (const payment of payments) {
  if (!payment.failureReason) continue;

  const reason = payment.failureReason;
  
    if (!groups[reason]) {
      groups[reason] = {
        attempts: 0,
        recovered: 0,
      };
    }

    groups[reason].attempts++;

    const paymentRecovered =
  payment.status === 'success';

if (paymentRecovered) {
  groups[reason].recovered++;
}
  }

  return Object.entries(groups).map(
    ([reason, data]) => ({
      reason,
      attempts: data.attempts,
      recovered: data.recovered,
      recoveryRate:
        data.attempts > 0
          ? Math.round(
              (data.recovered / data.attempts) * 100,
            )
          : 0,
    }),
  );
}


  async refreshIntelligence() {
 const actions = await this.repo.find();

for (const action of actions) {
  if (
    action.status === 'recovered' ||
    action.status === 'failed' ||
    action.status === 'dismissed' ||
    action.status === 'cancelled'
  ) {
    continue;
  }
    const payment = await this.paymentRepo.findOneBy({
      id: action.paymentId,
    });

    if (!payment) continue;

    const intelligence = await this.calculateIntelligence(
      payment,
      action.retryCount,
    );

    action.strategy = intelligence.strategy;
    action.recoveryScore = intelligence.recoveryScore;
    action.confidence = intelligence.confidence;
    action.reason = intelligence.reason;

    await this.repo.save(action);
  }

  return {
    message: 'Recovery intelligence refreshed',
  };
}


async resolveAction(id: string) {
  const action = await this.repo.findOneBy({ id });

  if (!action) {
    return { message: 'Recovery not found' };
  }

  if (action.status !== 'action_required') {
    return {
      message: 'This recovery does not require manual resolution',
    };
  }

  const payment = await this.paymentRepo.findOneBy({
    id: action.paymentId,
  });

  if (!payment) {
    return { message: 'Payment not found' };
  }

  payment.status = 'success';
  await this.paymentRepo.save(payment);

  action.status = 'recovered';
  action.nextRetryAt = null;
  action.strategy = 'recovery_completed';
action.recoveryScore = 100;
action.confidence = 100;
action.reason =
  'Payment was successfully recovered through manual customer action.';
  await this.addHistory(
    action,
    'payment_recovered',
    'Payment manually recovered',
  );

  return this.repo.save(action);
}

async resetDemoData() {
  const payments = await this.paymentRepo.find();

  // Remove all old recovery actions
  await this.repo.clear();

  let recoveryCount = 0;

  for (const payment of payments) {
    // Keep these payments successful
    if (payment.orderId === 'order_456') {
      payment.status = 'success';
      await this.paymentRepo.save(payment);
      continue;
    }

    // Reset remaining demo payments to failed
    payment.status = 'failed';

    await this.paymentRepo.save(payment);

    // Recreate recovery intelligence
    await this.create(
      payment.id,
      payment.failureReason ?? undefined,
      Number(payment.amount),
    );

    recoveryCount++;
  }

  return {
    message: 'Demo data reset successfully',
    recoveriesCreated: recoveryCount,
  };
}
  // =========================================================
  // FIND BY PRIORITY
  // =========================================================

  findByPriority(priority: string) {
    return this.repo.find({
      where: { priority },
    });
  }

  async sendReminder(id: string) {
  const action = await this.repo.findOneBy({ id });

  if (!action) return { message: 'Recovery not found' };

  action.status = 'action_required';

  await this.addHistory(
    action,
    'reminder_sent',
    'Customer reminder sent',
  );

  return action;
}

async createPaymentLink(id: string) {
  const action = await this.repo.findOneBy({ id });

  if (!action) return { message: 'Recovery not found' };

  const paymentLink = `http://localhost:5173/pay/${action.paymentId}`;
  action.status = 'action_required';

  await this.addHistory(
    action,
    'payment_link_created',
    'Recovery payment link generated',
  );

  return {
    ...action,
    paymentLink,
  };
}

async dismiss(id: string) {
  const action = await this.repo.findOneBy({ id });

  if (!action) return { message: 'Recovery not found' };

  action.status = 'dismissed';

  await this.addHistory(
    action,
    'dismissed',
    'Recovery dismissed',
  );

  return action;
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
      action.status === 'retrying' ||
      action.status === 'action_required'
    ) {
      action.status = 'recovered';
      action.nextRetryAt = null;

      await this.addHistory(
        action,
        'payment_recovered',
        'Payment successfully recovered',
      );

      await this.repo.save(action);
    }
  }

  return {
    message: 'Payment recovered',
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
  async recoverForPayment(paymentId: string) {
  const action = await this.repo.findOneBy({ paymentId });

  if (!action) {
    return { message: 'Recovery not found' };
  }

  action.status = 'recovered';
  action.nextRetryAt = null;
  action.strategy = 'recovery_completed';
action.recoveryScore = 100;
action.confidence = 100;
action.reason =
  'Payment was successfully recovered through the recovery payment link.';
  await this.addHistory(
    action,
    'payment_recovered',
    'Payment completed through recovery payment link',
  );

  return this.repo.save(action);
}
}