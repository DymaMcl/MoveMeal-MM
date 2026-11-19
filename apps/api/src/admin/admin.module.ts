import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthGuard, Roles, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { ROLES, type Role } from '../auth/auth.service.js';
import { AdminService } from './admin.service.js';

export class UsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;
}

export class RoleDto {
  @IsIn(ROLES)
  role!: Role;
}

export class BlockDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class SettingsDto {
  @IsInt()
  @Min(0)
  @Max(365)
  freeConsultationDays!: number;
}

export class PageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;
}

/** Panoul administratorului: doar conturile cu rolul „admin”. */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query() query: UsersQueryDto) {
    return this.admin.users(query);
  }

  @Put('users/:id/role')
  setRole(
    @UserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RoleDto,
  ) {
    return this.admin.setRole(adminId, id, body.role);
  }

  @Post('users/:id/block')
  block(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: BlockDto) {
    return this.admin.block(adminId, id, body.reason);
  }

  @Post('users/:id/unblock')
  unblock(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.unblock(adminId, id);
  }

  @Get('log')
  log(@Query() query: PageDto) {
    return this.admin.auditLog(query.page);
  }

  @Get('settings')
  settings() {
    return this.admin.settings();
  }

  @Put('settings')
  updateSettings(@UserId() adminId: string, @Body() body: SettingsDto) {
    return this.admin.updateSettings(adminId, body);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
