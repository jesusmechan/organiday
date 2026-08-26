import {
  BlockCategory,
  Course,
  CourseModality,
  DayOfWeek,
  DayRoutine,
  ExerciseSession,
  ExerciseType,
  PlannerState,
  Task,
  Term,
  TimeBlock
} from '../models/planner.models';
import { asDayOfWeek, fromMinutes, parseProtectedDays, toMinutes, uid, WEEK_ORDER } from '../utils/time';

export interface WorkDaySpec {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  start: string;
  end: string;
}

export interface ClassSpec {
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
  location: string;
}

export interface CourseSpec {
  name: string;
  shortName: string;
  modality: CourseModality;
  sessions: ClassSpec[];
}

export interface ExerciseSpec {
  enabled: boolean;
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
  title: string;
  type: ExerciseType;
  intensity: 'light' | 'moderate' | 'full';
}

export interface ScheduleDraft {
  name: string;
  startDate: string;
  endDate: string;
  mode: 'new' | 'replace';
  work: WorkDaySpec[];
  courses: CourseSpec[];
  exercises: ExerciseSpec[];
  deriveMeals: boolean;
  deriveCommute: boolean;
  deriveSleep: boolean;
  createCourseTasks: boolean;
  protectedDays: DayOfWeek[];
}

export interface GeneratedSchedule {
  term: { name: string; startDate: string; endDate: string };
  blocks: TimeBlock[];
  courses: Course[];
  exerciseSessions: ExerciseSession[];
  routines: DayRoutine[];
  tasks: Task[];
}

const COLORS = ['#7c3aff', '#ff2d7b', '#00c2a8', '#2f7cff', '#ffb020', '#ff6a3d'];

export function defaultDraft(): ScheduleDraft {
  return {
    name: '',
    startDate: '',
    endDate: '',
    mode: 'new',
    work: WEEK_ORDER.map(day => ({
      dayOfWeek: day,
      enabled: false,
      start: '08:00',
      end: '18:00'
    })),
    courses: [],
    exercises: WEEK_ORDER.map(day => ({
      enabled: false,
      dayOfWeek: day,
      start: '07:00',
      end: '08:00',
      title: 'Ejercicio',
      type: 'workout',
      intensity: 'moderate'
    })),
    deriveMeals: true,
    deriveCommute: true,
    deriveSleep: true,
    createCourseTasks: true,
    protectedDays: [4]
  };
}

export function draftFromTerm(state: PlannerState, term: Term): ScheduleDraft {
  const draft = defaultDraft();
  draft.name = term.name;
  draft.startDate = term.startDate;
  draft.endDate = term.endDate;
  draft.mode = 'replace';
  draft.protectedDays = parseProtectedDays(term.protectedDays);

  const blocks = state.blocks.filter(b => b.termId === term.id);
  for (const spec of draft.work) {
    const work = blocks.find(b => b.dayOfWeek === spec.dayOfWeek && b.category === 'work');
    if (!work) continue;
    spec.enabled = true;
    spec.start = work.start;
    spec.end = work.end;
  }

  draft.courses = state.courses
    .filter(course => course.termId === term.id)
    .map(course => {
      const sessions =
        course.modality === 'virtual-247'
          ? []
          : blocks
              .filter(
                b =>
                  (b.category === 'university' || b.category === 'virtual') &&
                  (b.title === course.name || b.title === course.shortName)
              )
              .map(b => ({
                dayOfWeek: b.dayOfWeek,
                start: b.start,
                end: b.end,
                location: b.location ?? ''
              }));
      return {
        name: course.name,
        shortName: course.shortName,
        modality: course.modality,
        sessions: course.modality === 'virtual-247' || sessions.length ? sessions : [{
          dayOfWeek: 1 as DayOfWeek,
          start: '18:30',
          end: '20:00',
          location: ''
        }]
      };
    });

  for (const spec of draft.exercises) {
    const session = state.exerciseSessions.find(
      item => item.termId === term.id && item.dayOfWeek === spec.dayOfWeek
    );
    if (!session) continue;
    spec.enabled = true;
    spec.start = session.start;
    spec.end = session.end;
    spec.title = session.title;
    spec.type = session.type;
    spec.intensity = session.intensity;
  }

  return draft;
}

export function generateSchedule(draft: ScheduleDraft, termId: string): GeneratedSchedule {
  const blocks: TimeBlock[] = [];
  const courses: Course[] = [];
  const exerciseSessions: ExerciseSession[] = [];
  const tasks: Task[] = [];

  draft.courses.forEach((course, index) => {
    if (!course.name.trim()) return;
    const courseId = uid('course');
    courses.push({
      id: courseId,
      name: course.name.trim(),
      shortName: course.shortName.trim() || course.name.trim().slice(0, 18),
      modality: course.modality,
      color: COLORS[index % COLORS.length],
      termId
    });
    if (course.modality !== 'virtual-247') {
      for (const session of course.sessions) {
        if (!session.start || !session.end) continue;
        blocks.push(makeBlock(
          course.name.trim(),
          course.modality === 'presencial' ? 'university' : 'virtual',
          asDayOfWeek(session.dayOfWeek),
          session.start,
          session.end,
          termId,
          session.location,
          course.modality
        ));
      }
    }
    if (draft.createCourseTasks) {
      tasks.push({
        id: uid('task'),
        title: `Estudiar ${course.shortName.trim() || course.name.trim()}`,
        courseId,
        priority: index < 2 ? 'high' : 'medium',
        estimatedMinutes: 120,
        loggedMinutes: 0,
        completed: false,
        createdAt: new Date().toISOString(),
        termId
      });
    }
  });

  for (const day of WEEK_ORDER) {
    const work = draft.work.find(w => asDayOfWeek(w.dayOfWeek) === day);
    const exercise = draft.exercises.find(e => e.enabled && asDayOfWeek(e.dayOfWeek) === day);
    const classes = blocks.filter(b => asDayOfWeek(b.dayOfWeek) === day && (b.category === 'university' || b.category === 'virtual'));

    if (work?.enabled) {
      blocks.push(makeBlock('Trabajo', 'work', day, work.start, work.end, termId));
    }
    if (exercise) {
      blocks.push(makeBlock(exercise.title, 'exercise', day, exercise.start, exercise.end, termId));
      exerciseSessions.push({
        id: uid('exs'),
        dayOfWeek: day,
        start: exercise.start,
        end: exercise.end,
        type: exercise.type,
        title: exercise.title,
        intensity: exercise.intensity,
        termId
      });
    }

    const derived = deriveDay(day, work, exercise, classes, draft, termId);
    blocks.push(...derived.blocks);
  }

  const routines = WEEK_ORDER.map(day => {
    const dayBlocks = blocks.filter(b => b.dayOfWeek === day);
    const last = lastEnd(dayBlocks.filter(b => b.category !== 'sleep'));
    const first = firstStart(dayBlocks.filter(b => b.category !== 'sleep'));
    const overloaded = last >= 22 * 60;
    const protectedDay = draft.protectedDays.includes(day);
    return {
      dayOfWeek: day,
      wakeTime: first ? fromMinutes(Math.max(first - 30, 6 * 60)) : defaultWake(day),
      sleepTime: last >= 22 * 60 + 15 ? '23:30' : '23:00',
      overloaded,
      overloadReason: overloaded
        ? 'Este día termina muy tarde. No agregues más actividades.'
        : protectedDay
          ? 'Día protegido: sin estudio extra ni carga añadida.'
          : undefined,
      termId
    };
  });

  return {
    term: { name: draft.name.trim(), startDate: draft.startDate, endDate: draft.endDate },
    blocks,
    courses,
    exerciseSessions,
    routines,
    tasks
  };
}

export function deriveDay(
  day: DayOfWeek,
  work: WorkDaySpec | undefined,
  exercise: ExerciseSpec | undefined,
  classes: TimeBlock[],
  draft: ScheduleDraft,
  termId: string
): { blocks: TimeBlock[] } {
  const out: TimeBlock[] = [];
  const classStart = firstStart(classes);
  const classEnd = classes.length ? lastEnd(classes) : null;
  const workStart = work?.enabled ? toMinutes(work.start) : null;
  const workEnd = work?.enabled ? toMinutes(work.end) : null;

  if (draft.deriveMeals) {
    const morningEx = exercise && toMinutes(exercise.start) < 12 * 60 ? exercise : null;
    if (morningEx && workStart !== null && toMinutes(morningEx.end) < workStart && work) {
      timed(out, 'Ducha, desayuno y preparación', 'meal', day, morningEx.end, work.start, termId);
    } else if (workStart !== null && work) {
      const breakfastStart = workStart - 45;
      if (!(morningEx && toMinutes(morningEx.end) > breakfastStart)) {
        timed(out, 'Desayuno y preparación', 'meal', day, fromMinutes(breakfastStart), work.start, termId);
      }
    } else if (exercise) {
      timed(out, 'Desayuno', 'meal', day, fromMinutes(toMinutes(exercise.start) - 60), exercise.start, termId);
    }
  }

  if (draft.deriveCommute && workEnd !== null && work) {
    if (classStart !== null && classStart > workEnd) {
      timed(out, 'Traslado a la universidad', 'commute', day, work.end, fromMinutes(classStart), termId);
    } else if (classStart === null) {
      timed(out, 'Regreso a casa', 'commute', day, work.end, fromMinutes(workEnd + 30), termId);
    }
  }

  const sortedClasses = [...classes].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 0; i < sortedClasses.length - 1; i++) {
    const gap = toMinutes(sortedClasses[i + 1].start) - toMinutes(sortedClasses[i].end);
    if (gap > 0 && gap <= 20) {
      timed(out, 'Receso', 'personal', day, sortedClasses[i].end, sortedClasses[i + 1].start, termId);
    }
  }

  let cursor = classEnd ?? workEnd;

  if (draft.deriveCommute && workEnd !== null && classEnd !== null) {
    const homeEnd = classEnd + 30;
    timed(out, 'Regreso a casa', 'commute', day, fromMinutes(classEnd), fromMinutes(homeEnd), termId);
    cursor = homeEnd;
  } else if (draft.deriveCommute && workEnd !== null && classStart === null) {
    cursor = workEnd + 30;
  }

  if (draft.deriveMeals && cursor !== null && cursor < 23 * 60) {
    const dinnerEnd = Math.min(cursor + 45, 23 * 60);
    if (dinnerEnd - cursor >= 20) {
      timed(
        out,
        cursor >= 21 * 60 ? 'Cena rápida' : 'Cena y desconexión',
        'meal',
        day,
        fromMinutes(cursor),
        fromMinutes(dinnerEnd),
        termId
      );
      cursor = dinnerEnd;
    }
  }

  if (draft.deriveSleep) {
    let sleepStart = 23 * 60;
    if (cursor !== null) sleepStart = Math.max(sleepStart, cursor);
    if (sleepStart >= 24 * 60) sleepStart = 23 * 60 + 30;
    const wake =
      exercise && toMinutes(exercise.start) < 12 * 60
        ? fromMinutes(toMinutes(exercise.start) - 30)
        : workStart !== null
          ? fromMinutes(workStart - 60)
          : defaultWake(day);
    out.push(makeBlock('Sueño', 'sleep', day, fromMinutes(sleepStart), wake, termId));
  }

  return { blocks: out };
}

function timed(
  out: TimeBlock[],
  title: string,
  category: BlockCategory,
  day: DayOfWeek,
  start: string,
  end: string,
  termId: string
): void {
  if (!start || !end) return;
  if (toMinutes(end) <= toMinutes(start)) return;
  out.push(makeBlock(title, category, day, start, end, termId));
}

function makeBlock(
  title: string,
  category: BlockCategory,
  day: DayOfWeek,
  start: string,
  end: string,
  termId: string,
  location?: string,
  modality?: CourseModality
): TimeBlock {
  return {
    id: uid('blk'),
    title,
    category,
    dayOfWeek: day,
    start,
    end,
    location: location || undefined,
    recurring: true,
    termId,
    modality,
    notes: modality === 'virtual-live' ? 'Sesión en vivo' : modality === 'virtual-247' ? 'Flexible 24/7' : undefined
  };
}

function firstStart(blocks: TimeBlock[]): number | null {
  if (!blocks.length) return null;
  return Math.min(...blocks.map(b => toMinutes(b.start)));
}

function lastEnd(blocks: TimeBlock[]): number {
  if (!blocks.length) return 0;
  return Math.max(...blocks.map(b => toMinutes(b.end)));
}

function defaultWake(day: DayOfWeek): string {
  if (day === 6) return '08:30';
  if (day === 0) return '09:00';
  return '07:00';
}
