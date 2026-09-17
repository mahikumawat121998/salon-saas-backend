import { Test, TestingModule } from '@nestjs/testing';
import { AttendancePolicyService } from './attendance-policy.service';

describe('AttendancePolicyService', () => {
  let service: AttendancePolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttendancePolicyService],
    }).compile();

    service = module.get<AttendancePolicyService>(AttendancePolicyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
