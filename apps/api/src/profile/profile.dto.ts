import { IsIn, IsString, Length } from 'class-validator';
import type { LossApproach } from '@movemeal/shared';
import { EnergyProfileDto } from '../energy/dto/energy-profile.dto.js';

export class ProfileDto extends EnergyProfileDto {
  @IsString()
  @Length(2, 60)
  name!: string;
}

export class LossApproachDto {
  @IsIn(['diet', 'exercise', 'mixed'])
  lossApproach!: LossApproach;
}
