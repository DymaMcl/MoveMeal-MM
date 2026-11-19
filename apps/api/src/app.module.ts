import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EnergyModule } from './energy/energy.module.js';
import { HealthController } from './health/health.controller.js';
import { ProfileModule } from './profile/profile.module.js';
import { NutritionModule } from './nutrition/nutrition.module.js';
import { TrackingModule } from './tracking/tracking.module.js';
import { WorkoutModule } from './workout/workout.module.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    EnergyModule,
    ProfileModule,
    WorkoutModule,
    NutritionModule,
    TrackingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
