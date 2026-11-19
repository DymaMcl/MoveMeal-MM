import { Body, Controller, Get, HttpCode, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { WorkoutLogDto, WorkoutPreferencesDto } from './workout.dto.js';
import { WorkoutService } from './workout.service.js';

@Controller('me/workout')
@UseGuards(AuthGuard)
export class WorkoutController {
  constructor(private readonly workouts: WorkoutService) {}

  @Get()
  get(@UserId() userId: string) {
    return this.workouts.get(userId);
  }

  @Put()
  save(@UserId() userId: string, @Body() body: WorkoutPreferencesDto) {
    return this.workouts.save(userId, body);
  }

  @Get('log')
  logs(@UserId() userId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.workouts.logs(userId, from, to);
  }

  @Put('log')
  @HttpCode(204)
  async setLog(@UserId() userId: string, @Body() body: WorkoutLogDto): Promise<void> {
    await this.workouts.setLog(userId, body.day, body.exerciseId, body.done);
  }
}
