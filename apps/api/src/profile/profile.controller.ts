import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { LossApproachDto, ProfileDto } from './profile.dto.js';
import { ProfileService } from './profile.service.js';

@Controller('me/profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  get(@UserId() userId: string) {
    return this.profiles.get(userId);
  }

  @Put()
  save(@UserId() userId: string, @Body() body: ProfileDto) {
    return this.profiles.save(userId, body);
  }

  /** Schimba doar abordarea slabirii; tinta stabilita de nutritionist ramane. */
  @Put('loss-approach')
  lossApproach(@UserId() userId: string, @Body() body: LossApproachDto) {
    return this.profiles.setLossApproach(userId, body.lossApproach);
  }
}
