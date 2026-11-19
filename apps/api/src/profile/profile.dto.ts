import { IsString, Length } from 'class-validator';
import { EnergyProfileDto } from '../energy/dto/energy-profile.dto.js';

export class ProfileDto extends EnergyProfileDto {
  @IsString()
  @Length(2, 60)
  name!: string;
}
