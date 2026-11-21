import {
  MAX_FOCUS_GROUPS,
  type Equipment,
  type Limitation,
  type MuscleGroup,
  type Sport,
  type Weekday,
  type WorkoutLevel,
  type WorkoutLocation,
  type WorkoutPreferences,
} from '@movemeal/shared';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const LOCATIONS: WorkoutLocation[] = ['home', 'gym', 'mixed'];
const LEVELS: WorkoutLevel[] = ['light', 'moderate', 'intense'];
const EQUIPMENT: Equipment[] = ['dumbbells', 'kettlebell', 'bands', 'pullup_bar', 'bench'];
const SPORTS: Sport[] = ['running', 'cycling', 'swimming', 'football', 'other'];
const LIMITATIONS: Limitation[] = ['knees', 'lower_back', 'shoulders', 'wrists'];
const GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes'];

export class WorkoutPreferencesDto implements WorkoutPreferences {
  @IsIn(LOCATIONS)
  location!: WorkoutLocation;

  @IsIn(LEVELS)
  level!: WorkoutLevel;

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days!: Weekday[];

  /** Antrenamentul mixt: zilele de acasa (celelalte zile sunt la sala). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  homeDays?: Weekday[];

  @IsArray()
  @ArrayUnique()
  @IsIn(EQUIPMENT, { each: true })
  equipment!: Equipment[];

  @IsArray()
  @ArrayUnique()
  @IsIn(SPORTS, { each: true })
  sports!: Sport[];

  @IsArray()
  @ArrayUnique()
  @IsIn(LIMITATIONS, { each: true })
  limitations!: Limitation[];

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_FOCUS_GROUPS)
  @IsIn(GROUPS, { each: true })
  focus!: MuscleGroup[];
}

export class WorkoutLogDto {
  /** Data in formatul AAAA-LL-ZZ. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;

  @IsString()
  @MaxLength(64)
  exerciseId!: string;

  @IsBoolean()
  done!: boolean;
}
