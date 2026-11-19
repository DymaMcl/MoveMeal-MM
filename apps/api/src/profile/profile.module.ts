import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EnergyModule } from '../energy/energy.module.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({
  imports: [AuthModule, EnergyModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
