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

  create(paymentId: string) {
    return this.repo.save({
      paymentId,
      status: 'pending',
      retryCount: 0,
    });
  }
  findAll() {
  return this.repo.find();
}

  async retry(id: string) {
  const action = await this.repo.findOneBy({ id });

  if (!action) return { message: 'Recovery not found' };

  action.retryCount++;

  if (action.retryCount >= 3) {
    action.status = 'failed';
  } else {
    action.status = 'retrying';
    action.nextRetryAt = new Date(Date.now() + action.retryCount * 5 * 60 * 1000);
  }

  return this.repo.save(action);
}
}