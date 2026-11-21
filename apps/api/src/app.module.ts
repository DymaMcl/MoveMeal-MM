import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConsultationsModule } from './consultations/consultations.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EnergyModule } from './energy/energy.module.js';
import { FoodPhotoModule } from './food-photo/food-photo.module.js';
import { HealthController } from './health/health.controller.js';
import { ProfileModule } from './profile/profile.module.js';
import { QuickLogModule } from './quick-log/quick-log.module.js';
import { EngagementModule } from './engagement/engagement.module.js';
import { SettingsModule } from './settings/settings.service.js';
import { SocialModule } from './social/social.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { NutritionModule } from './nutrition/nutrition.module.js';
import { NutritionistModule } from './nutritionist/nutritionist.module.js';
import { TrackingModule } from './tracking/tracking.module.js';
import { WorkoutModule } from './workout/workout.module.js';

@Module({
  imports: [
    DatabaseModule,
    SettingsModule,
    AuthModule,
    EnergyModule,
    ProfileModule,
    WorkoutModule,
    NutritionModule,
    TrackingModule,
    NotificationsModule,
    ConsultationsModule,
    NutritionistModule,
    AdminModule,
    AssistantModule,
    FoodPhotoModule,
    QuickLogModule,
    EngagementModule,
    SocialModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
