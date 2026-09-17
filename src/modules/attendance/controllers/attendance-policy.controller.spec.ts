import { Test, TestingModule } from '@nestjs/testing';
import { AttendancePolicyController } from './attendance-policy.controller';

describe('AttendancePolicyController', () => {
  let controller: AttendancePolicyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendancePolicyController],
    }).compile();

    controller = module.get<AttendancePolicyController>(AttendancePolicyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
