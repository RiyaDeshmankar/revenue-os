import { Test, TestingModule } from '@nestjs/testing';
import { RetryWorkerService } from './retry-worker.service';

describe('RetryWorkerService', () => {
  let service: RetryWorkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetryWorkerService],
    }).compile();

    service = module.get<RetryWorkerService>(RetryWorkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
