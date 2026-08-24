import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecoveryAction } from './entities/recovery-action.entity';

@Injectable()
export class RetryWorkerService {
  constructor(
    @InjectRepository(RecoveryAction)
    private repo: Repository<RecoveryAction>,
  ) {}

  @Cron('* * * * *')
  async processRetries() {
    console.log('Retry worker running');

    const actions = await this.repo.find({
      where: { status: 'retrying' },
    });

    for (const action of actions) {
      if (action.nextRetryAt && action.nextRetryAt <= new Date()) {
        action.retryCount++;

        if (action.retryCount >= 3) {
          action.status = 'failed';
          action.nextRetryAt = null;
        } else {
          action.nextRetryAt = new Date(
            Date.now() + action.retryCount * 5 * 60 * 1000,
          );
        }

        await this.repo.save(action);
      }
    }
  }
}