import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { EngagementModule } from '../engagement/engagement.module.js';
import { ProfileModule } from '../profile/profile.module.js';
import { ActivityDto, FastingStartDto } from './activity.dto.js';
import { ActivityService } from './activity.service.js';

/** Activitatile fizice (calorii arse) si postul intermitent. */
@Controller('me')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('activity')
  day(@UserId() userId: string, @Query('day') day?: string) {
    if (day !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new BadRequestException('Data invalida.');
    }
    return this.activity.day(userId, day);
  }

  @Post('activity')
  add(@UserId() userId: string, @Body() body: ActivityDto) {
    return this.activity.add(userId, body);
  }

  @Delete('activity/:id')
  @HttpCode(204)
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.activity.remove(userId, id);
  }

  @Get('fasting')
  fasting(@UserId() userId: string) {
    return this.activity.fasting(userId);
  }

  @Post('fasting/start')
  start(@UserId() userId: string, @Body() body: FastingStartDto) {
    return this.activity.startFast(userId, body);
  }

  @Post('fasting/stop')
  @HttpCode(200)
  stop(@UserId() userId: string) {
    return this.activity.stopFast(userId);
  }

  @Delete('fasting/:id')
  @HttpCode(204)
  removeFast(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.activity.removeFast(userId, id);
  }
}

@Module({
  imports: [AuthModule, ProfileModule, EngagementModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
