import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecoveryAction } from './entities/recovery-action.entity';

@Injectable()
export class RecoveryService {
  constructor(
    @InjectRepository(RecoveryAction)
    private repo: Repository<RecoveryAction>,
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

  findAll() {
    return this.repo.find();
  }

  async retry(id: string) {
    const action = await this.repo.findOneBy({ id });

    if (!action) return { message: 'Recovery not found' };
    if (action.strategy === 'payment_method_update') {
      action.status = 'action_required';
      return this.repo.save(action);
    }
    action.retryCount++;

    if (action.retryCount >= 3) {
      action.status = 'failed';
    } else {
      action.status = 'retrying';
      const delay =
        action.strategy === 'quick_retry'
          ? 2
          : action.strategy === 'delayed_retry'
            ? 15
            : 5;

      action.nextRetryAt = new Date(Date.now() + delay * 60 * 1000);
    }

    return this.repo.save(action);
  }

  findByPriority(priority: string) {
    return this.repo.find({ where: { priority } });
  }
}
