import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { EnergyProfileDto } from './dto/energy-profile.dto.js';
import { EnergyService, type EnergyPlanResult } from './energy.service.js';

@Controller('energy')
export class EnergyController {
  constructor(private readonly energy: EnergyService) {}

  /** Calculeaza necesarul zilnic de calorii si macronutrienti. */
  @Post('plan')
  @HttpCode(200)
  plan(@Body() profile: EnergyProfileDto): EnergyPlanResult {
    return this.energy.calculate(profile);
  }
}
