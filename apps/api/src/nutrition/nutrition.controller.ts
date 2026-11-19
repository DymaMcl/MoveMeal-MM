import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { MealSlot } from '@movemeal/shared';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import {
  EatPlannedMealDto,
  LogEntryDto,
  NutritionPreferencesDto,
  RegenerateDto,
  ReplaceMealDto,
} from './nutrition.dto.js';
import { NutritionService } from './nutrition.service.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];

@Controller('me')
@UseGuards(AuthGuard)
export class NutritionController {
  constructor(private readonly nutrition: NutritionService) {}

  @Get('nutrition')
  get(@UserId() userId: string) {
    return this.nutrition.get(userId);
  }

  @Put('nutrition/preferences')
  save(@UserId() userId: string, @Body() body: NutritionPreferencesDto) {
    return this.nutrition.savePreferences(userId, body);
  }

  @Post('nutrition/regenerate')
  @HttpCode(200)
  regenerate(@UserId() userId: string, @Body() body: RegenerateDto) {
    return this.nutrition.regenerate(userId, body.weekday);
  }

  @Get('nutrition/alternatives')
  alternatives(
    @UserId() userId: string,
    @Query('weekday') weekday: string,
    @Query('slot') slot: string,
  ) {
    const wd = Number(weekday);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6 || !SLOTS.includes(slot as MealSlot)) {
      throw new BadRequestException('Parametri invalizi.');
    }
    return this.nutrition.alternatives(userId, wd, slot as MealSlot);
  }

  @Put('nutrition/meal')
  replace(@UserId() userId: string, @Body() body: ReplaceMealDto) {
    return this.nutrition.replace(userId, body.weekday, body.slot, body.recipeId);
  }

  @Get('nutrition/shopping-list')
  shopping(@UserId() userId: string) {
    return this.nutrition.shopping(userId);
  }

  @Get('food-log')
  log(@UserId() userId: string, @Query('day') day: string) {
    if (!DAY.test(day ?? '')) throw new BadRequestException('Data invalida.');
    return this.nutrition.log(userId, day);
  }

  @Post('food-log')
  add(@UserId() userId: string, @Body() body: LogEntryDto) {
    return this.nutrition.addLog(userId, body);
  }

  @Post('food-log/planned')
  eat(@UserId() userId: string, @Body() body: EatPlannedMealDto) {
    return this.nutrition.eatPlanned(userId, body.day, body.slot);
  }

  @Delete('food-log/:id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.nutrition.deleteLog(userId, id);
  }

  @Get('food-log/recent-foods')
  recent(@UserId() userId: string) {
    return this.nutrition.recentFoods(userId);
  }
}
