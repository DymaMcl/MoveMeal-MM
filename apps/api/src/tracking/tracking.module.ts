import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProfileModule } from '../profile/profile.module.js';
import { TrackingController } from './tracking.controller.js';
import { TrackingService } from './tracking.service.js';

@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}
