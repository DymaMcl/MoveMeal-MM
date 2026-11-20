import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthGuard, Roles, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { ROLES, type Role } from '../auth/auth.service.js';
import { SocialModule } from '../social/social.module.js';
import { AdminService, type Audience, type ModerationFilter } from './admin.service.js';

export class UsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @IsOptional()
  @IsIn(['active', 'blocked'])
  status?: 'active' | 'blocked';

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

export class ReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class SettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  freeConsultationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  aiChatDaily?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  aiPhotoDaily?: number;

  @IsOptional()
  @IsBoolean()
  communityEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  communityPremoderation?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  postsDaily?: number;
}

export class LogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  action?: string;
}

export class ModerationQueryDto {
  @IsOptional()
  @IsIn(['pending', 'reported', 'removed', 'all'])
  filter?: ModerationFilter;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cursor?: string;
}

export class ArticleChangeDto {
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';
}

export class AnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  body!: string;

  @IsIn(['all', 'user', 'nutritionist'])
  audience!: Audience;
}

/** Panoul administratorului: doar conturile cu rolul „admin” (verificat la fiecare cerere). */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  // ------------------------------------------------------------- conturi

  @Get('users')
  users(@Query() query: UsersQueryDto) {
    return this.admin.users(query);
  }

  @Get('users/:id')
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.userDetail(id);
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
  block(
    @UserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReasonDto,
  ) {
    return this.admin.block(adminId, id, body.reason);
  }

  @Post('users/:id/unblock')
  unblock(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.unblock(adminId, id);
  }

  @Post('users/:id/logout')
  logout(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.logoutEverywhere(adminId, id);
  }

  @Post('users/:id/unlock')
  unlock(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.unlockLogin(adminId, id);
  }

  // ------------------------------------------------------------- moderare

  @Get('moderation')
  moderation(@Query() query: ModerationQueryDto) {
    return this.admin.moderationQueue(query.filter ?? 'pending', query.cursor);
  }

  @Post('posts/:id/approve')
  @HttpCode(204)
  async approve(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.admin.approvePost(adminId, id);
  }

  @Post('posts/:id/remove')
  @HttpCode(204)
  async removePost(
    @UserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReasonDto,
  ) {
    await this.admin.removePost(adminId, id, body.reason);
  }

  @Post('posts/:id/dismiss')
  @HttpCode(204)
  async dismiss(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.admin.dismissReports(adminId, id);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async deletePost(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.admin.deletePost(adminId, id);
  }

  // ------------------------------------------------------------- blog

  @Get('articles')
  articles(@UserId() adminId: string, @Query() query: ModerationQueryDto) {
    return this.admin.articles(adminId, query.cursor);
  }

  @Put('articles/:id')
  @HttpCode(204)
  async article(
    @UserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ArticleChangeDto,
  ) {
    await this.admin.moderateArticle(adminId, id, body);
  }

  @Delete('articles/:id')
  @HttpCode(204)
  async deleteArticle(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.admin.deleteArticle(adminId, id);
  }

  // ------------------------------------------------------------- anunturi, jurnal, parametri

  @Post('announcements')
  announce(@UserId() adminId: string, @Body() body: AnnouncementDto) {
    return this.admin.announce(adminId, body.title, body.body, body.audience);
  }

  @Get('log')
  log(@Query() query: LogQueryDto) {
    return this.admin.auditLog(query.page, query.action);
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
  imports: [AuthModule, SocialModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
