import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WorkoutController } from './workout.controller.js';
import { WorkoutService } from './workout.service.js';

@Module({
  imports: [AuthModule],
  controllers: [WorkoutController],
  providers: [WorkoutService],
})
export class WorkoutModule {}
