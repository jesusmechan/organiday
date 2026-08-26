import { DayOfWeek, DayException, PlannerState, TimeBlock } from '../models/planner.models';
import { parseProtectedDays } from './time';

const HIDE_ON_OFF: TimeBlock['category'][] = ['work', 'commute'];

export function hidesWork(exception?: DayException | null): boolean {
  return exception?.kind === 'holiday' || exception?.kind === 'off-work';
}

export function visibleBlocks(state: PlannerState, day: DayOfWeek, date: string): TimeBlock[] {
  const skips = new Set(state.blockSkips.filter(item => item.date === date).map(item => item.blockId));
  const exception = state.exceptions.find(item => item.date === date);
  const hideWork = hidesWork(exception);

  return state.blocks.filter(block => {
    if (skips.has(block.id)) return false;
    if (block.date) return block.date === date;
    if (block.dayOfWeek !== day) return false;
    if (hideWork && HIDE_ON_OFF.includes(block.category)) return false;
    return true;
  });
}

export function exceptionFor(state: PlannerState, date: string): DayException | undefined {
  return state.exceptions.find(item => item.date === date);
}

export function protectedDaysOf(state: PlannerState, termId?: string): DayOfWeek[] {
  const term = state.terms.find(item => item.id === termId) ?? state.terms.find(item => item.id === state.selectedTermId);
  return parseProtectedDays(term?.protectedDays);
}
