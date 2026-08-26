import { DayOfWeek, TimeBlock } from '../models/planner.models';
import { CourseSpec, deriveDay, ExerciseSpec, ScheduleDraft, WorkDaySpec } from '../services/schedule.generator';
import { asDayOfWeek, DAY_LABELS, toMinutes, WEEK_ORDER } from './time';

interface Slot {
  day: DayOfWeek;
  start: number;
  end: number;
  label: string;
  wrap: boolean;
  source: 'user' | 'derived';
}

function segments(start: number, end: number, wrap: boolean): Array<[number, number]> {
  if (start === end) return [];
  if (wrap || end < start) return [[start, 24 * 60], [0, end]];
  return [[start, end]];
}

function overlaps(a: Slot, b: Slot): boolean {
  for (const [startA, endA] of segments(a.start, a.end, a.wrap)) {
    for (const [startB, endB] of segments(b.start, b.end, b.wrap)) {
      if (startA < endB && startB < endA) return true;
    }
  }
  return false;
}

function invalidRange(start: string, end: string): boolean {
  return !start || !end || toMinutes(end) <= toMinutes(start);
}

function pushSlot(
  slots: Slot[],
  errors: string[],
  day: DayOfWeek,
  start: string,
  end: string,
  label: string,
  source: 'user' | 'derived',
  options?: { wrap?: boolean; allowOvernight?: boolean }
): void {
  if (!start || !end) return;
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === endMin) return;
  const wrap = !!options?.wrap || endMin < startMin;
  if (endMin <= startMin && !options?.allowOvernight) {
    errors.push(`${DAY_LABELS[day]}: ${label} termina antes de empezar.`);
    return;
  }
  slots.push({
    day,
    start: startMin,
    end: endMin,
    label: `${label} (${start}–${end})`,
    wrap,
    source
  });
}

function courseLabel(course: CourseSpec, index: number): string {
  return course.shortName.trim() || course.name.trim() || `Curso ${index + 1}`;
}

function classBlocksForDay(draft: ScheduleDraft, day: DayOfWeek): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  for (const course of draft.courses) {
    if (course.modality === 'virtual-247') continue;
    for (const session of course.sessions) {
      if (invalidRange(session.start, session.end)) continue;
      if (asDayOfWeek(session.dayOfWeek) !== day) continue;
      blocks.push({
        id: 'preview',
        title: course.name.trim() || 'Curso',
        category: course.modality === 'presencial' ? 'university' : 'virtual',
        dayOfWeek: day,
        start: session.start,
        end: session.end,
        recurring: true,
        termId: 'preview',
        modality: course.modality
      });
    }
  }
  return blocks;
}

function workForDay(draft: ScheduleDraft, day: DayOfWeek): WorkDaySpec | undefined {
  return draft.work.find(item => asDayOfWeek(item.dayOfWeek) === day);
}

function exerciseForDay(draft: ScheduleDraft, day: DayOfWeek): ExerciseSpec | undefined {
  return draft.exercises.find(item => item.enabled && asDayOfWeek(item.dayOfWeek) === day);
}

export function findScheduleConflicts(draft: ScheduleDraft): string[] {
  const slots: Slot[] = [];
  const errors: string[] = [];

  for (const work of draft.work) {
    if (!work.enabled) continue;
    pushSlot(slots, errors, asDayOfWeek(work.dayOfWeek), work.start, work.end, 'Trabajo', 'user');
  }

  draft.courses.forEach((course, index) => {
    if (course.modality === 'virtual-247') return;
    const name = courseLabel(course, index);
    for (const session of course.sessions) {
      pushSlot(slots, errors, asDayOfWeek(session.dayOfWeek), session.start, session.end, name, 'user');
    }
  });

  for (const exercise of draft.exercises) {
    if (!exercise.enabled) continue;
    const name = exercise.title.trim() || 'Ejercicio';
    pushSlot(slots, errors, asDayOfWeek(exercise.dayOfWeek), exercise.start, exercise.end, name, 'user');
  }

  for (const day of WEEK_ORDER) {
    const derived = deriveDay(
      day,
      workForDay(draft, day),
      exerciseForDay(draft, day),
      classBlocksForDay(draft, day),
      draft,
      'preview'
    );
    for (const block of derived.blocks) {
      if (block.category === 'sleep') continue;
      pushSlot(slots, errors, day, block.start, block.end, block.title, 'derived');
    }
  }

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slots[i].day !== slots[j].day) continue;
      if (slots[i].source === 'derived' && slots[j].source === 'derived') continue;
      if (!overlaps(slots[i], slots[j])) continue;
      errors.push(`${DAY_LABELS[slots[i].day]}: cruce entre ${slots[i].label} y ${slots[j].label}.`);
    }
  }

  return [...new Set(errors)];
}
