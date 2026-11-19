import { Module } from '@nestjs/common';
import { EnergyModule } from './energy/energy.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [EnergyModule],
  controllers: [HealthController],
})
export class AppModule {}
