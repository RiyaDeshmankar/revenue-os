import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../payments/entities/payment.entity';
import { RecoveryAction } from '../recovery/entities/recovery-action.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,

    @InjectRepository(RecoveryAction)
    private recoveryRepo: Repository<RecoveryAction>,
  ) {}

  async getSummary() {
  const payments = await this.paymentRepo.find();
  const recoveries = await this.recoveryRepo.find();

  // Failed payments
  const failedPayments = payments.filter(
    (payment) => payment.status === 'failed',
  );

  // Payments currently undergoing recovery
  const activeRecoveryIds = new Set(
    recoveries
      .filter(
        (recovery) =>
          recovery.status === 'pending' ||
          recovery.status === 'retrying' ||
          recovery.status === 'action_required',
      )
      .map((recovery) => recovery.paymentId),
  );

  const revenueAtRisk = failedPayments
    .filter((payment) => activeRecoveryIds.has(payment.id))
    .reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );

  // Successfully recovered payments
  const recoveredPaymentIds = new Set(
    recoveries
      .filter((recovery) => recovery.status === 'recovered')
      .map((recovery) => recovery.paymentId),
  );

  const recovered = payments
    .filter((payment) => recoveredPaymentIds.has(payment.id))
    .reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );

  // Failed recovery attempts
  const failedRecoveryIds = new Set(
    recoveries
      .filter((recovery) => recovery.status === 'failed')
      .map((recovery) => recovery.paymentId),
  );

  const failedRecoveryAmount = failedPayments
    .filter((payment) => failedRecoveryIds.has(payment.id))
    .reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );

  // Recovery rate
  const totalRecoveryPool =
    recovered +
    revenueAtRisk +
    failedRecoveryAmount;

  const recoveryRate =
    totalRecoveryPool > 0
      ? Number(
          (
            (recovered / totalRecoveryPool) *
            100
          ).toFixed(2),
        )
      : 0;

  return {
    revenueAtRisk,
    recovered,
    failedPayments: failedPayments.length,
    recoveryRate,
    failedRecoveryAmount,
  };

  }
}