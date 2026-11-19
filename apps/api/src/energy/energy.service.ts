import { Injectable } from '@nestjs/common';
import {
  calculateEnergyPlan,
  checkWeightGoal,
  type EnergyPlan,
  type EnergyProfile,
  type GoalCheck,
} from '@movemeal/shared';

export interface EnergyPlanResult {
  plan: EnergyPlan;
  /** Prezent doar pentru obiectivele cu greutate-tinta. */
  goalCheck: GoalCheck | null;
}

@Injectable()
export class EnergyService {
  calculate(profile: EnergyProfile): EnergyPlanResult {
    const { goal, targetWeightKg, weeks } = profile;
    const hasTarget = (goal === 'lose' || goal === 'gain') && targetWeightKg !== undefined;

    const goalCheck =
      hasTarget && weeks !== undefined
        ? checkWeightGoal({
            goal,
            weightKg: profile.weightKg,
            heightCm: profile.heightCm,
            targetWeightKg,
            weeks,
          })
        : null;

    // Daca perioada propusa nu este sanatoasa, planul se calculeaza pentru perioada recomandata.
    const safeProfile: EnergyProfile =
      goalCheck && goalCheck.status === 'too_fast'
        ? { ...profile, weeks: goalCheck.recommendedWeeks }
        : profile;

    return { plan: calculateEnergyPlan(safeProfile), goalCheck };
  }
}
