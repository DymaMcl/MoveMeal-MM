import type { Goal } from '@movemeal/shared';

/** Pasii chestionarului; pasul „target” apare doar pentru slabire si crestere in greutate. */
export function onboardingSteps(goal?: Goal) {
  const withTarget = goal === 'lose' || goal === 'gain';
  const steps = ['personal', 'body', 'goal', ...(withTarget ? ['target'] : []), 'activity'];
  return {
    total: steps.length,
    index: (step: string) => steps.indexOf(step) + 1,
  };
}

export function needsTarget(goal?: Goal): goal is 'lose' | 'gain' {
  return goal === 'lose' || goal === 'gain';
}
