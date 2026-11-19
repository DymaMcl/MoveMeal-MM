import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, Roles, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConsultationsModule } from '../consultations/consultations.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { NutritionModule } from '../nutrition/nutrition.module.js';
import { ProfileModule } from '../profile/profile.module.js';
import {
  AdjustClientDto,
  DayOffDto,
  DecisionDto,
  HoursDto,
  NutritionistProfileDto,
  RescheduleDto,
} from './nutritionist.dto.js';
import { NutritionistService } from './nutritionist.service.js';

/** Panoul nutritionistului: doar conturile cu rolul „nutritionist”. */
@Controller('nutritionist')
@UseGuards(AuthGuard)
@Roles('nutritionist')
export class NutritionistController {
  constructor(private readonly service: NutritionistService) {}

  @Get('profile')
  profile(@UserId() id: string) {
    return this.service.profile(id);
  }

  @Put('profile')
  updateProfile(@UserId() id: string, @Body() body: NutritionistProfileDto) {
    return this.service.updateProfile(id, body);
  }

  @Get('schedule')
  schedule(@UserId() id: string) {
    return this.service.schedule(id);
  }

  @Put('schedule/hours')
  setHours(@UserId() id: string, @Body() body: HoursDto) {
    return this.service.setHours(id, body.hours);
  }

  @Put('schedule/day-off')
  setDayOff(@UserId() id: string, @Body() body: DayOffDto) {
    return this.service.setDayOff(id, body.day, body.off);
  }

  @Get('slots')
  slots(@UserId() id: string) {
    return this.service.freeSlots(id);
  }

  @Get('appointments')
  appointments(@UserId() id: string) {
    return this.service.appointments(id);
  }

  @Post('appointments/:id/confirm')
  confirm(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DecisionDto,
  ) {
    return this.service.decide(userId, id, 'confirm', body.note);
  }

  @Post('appointments/:id/reject')
  reject(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DecisionDto,
  ) {
    return this.service.decide(userId, id, 'reject', body.note);
  }

  @Post('appointments/:id/reschedule')
  reschedule(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleDto,
  ) {
    return this.service.reschedule(userId, id, body.startsAt, body.note);
  }

  @Get('clients')
  clients(@UserId() id: string) {
    return this.service.clients(id);
  }

  @Get('clients/:id')
  client(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.client(userId, id);
  }

  @Put('clients/:id/adjustment')
  adjust(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdjustClientDto,
  ) {
    return this.service.adjustClient(userId, id, {
      calorieTarget: body.calorieTarget ?? null,
      note: body.note,
    });
  }
}

@Module({
  imports: [AuthModule, ConsultationsModule, NotificationsModule, ProfileModule, NutritionModule],
  controllers: [NutritionistController],
  providers: [NutritionistService],
})
export class NutritionistModule {}
