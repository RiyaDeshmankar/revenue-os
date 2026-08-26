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

    const failedPayments = payments.filter(
      (payment) => payment.status === 'failed',
    );

    const recoveredPayments = payments.filter(
      (payment) => payment.status === 'success',
    );

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
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const recovered = recoveredPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );

    const recoveryRate =
      recovered + revenueAtRisk > 0
        ? Number(
            ((recovered / (recovered + revenueAtRisk)) * 100).toFixed(2),
          )
        : 0;

    return {
      revenueAtRisk,
      recovered,
      failedPayments: failedPayments.length,
      recoveryRate,
    };
  }
}