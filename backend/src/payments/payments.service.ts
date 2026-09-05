import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { RecoveryService } from '../recovery/recovery.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private repo: Repository<Payment>,

    private recovery: RecoveryService,
  ) {}

  async create(data: Partial<Payment>) {
    const payment = await this.repo.save(data);

    if (payment.status === 'failed') {
      await this.recovery.create(
        payment.id,
        payment.failureReason,
        payment.amount,
      );
    }

    return payment;
  }

  findAll() {
    return this.repo.find();
  }

  findFailed() {
    return this.repo.find({
      where: { status: 'failed' },
    });
  }

  async markSuccessful(paymentId: string) {
  const payment = await this.repo.findOneBy({
    id: paymentId,
  });

  if (!payment) {
    return { message: 'Payment not found' };
  }

  payment.status = 'success';

  await this.repo.save(payment);

  await this.recovery.recoverForPayment(paymentId);
  return payment;
}
}