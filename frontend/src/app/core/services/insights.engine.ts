import {
  DayOfWeek,
  ExerciseLog,
  ExerciseStats,
  FreeSlot,
  PlannerState,
  SkipReason,
  StudySuggestion,
  Task,
  TimeBlock,
  WeeklySummary
} from '../models/planner.models';
import {
  DAY_LABELS,
  durationMinutes,
  hoursFromMinutes,
  isoDate,
  mondayFirst,
  parseProtectedDays,
  startOfWeek,
  toMinutes,
  WEEK_ORDER
} from '../utils/time';

const MIN_SLOT = 45;

export class InsightsEngine {
  weeklySummary(state: PlannerState): WeeklySummary {
    const totals: Record<string, number> = {
      work: 0,
      university: 0,
      exercise: 0,
      study: 0,
      sleep: 0,
      personal: 0,
      commute: 0,
      meal: 0,
      virtual: 0
    };

    for (const block of state.blocks) {
      totals[block.category] = (totals[block.category] ?? 0) + durationMinutes(block.start, block.end);
    }

    const loggedStudy = state.studyLogs
      .filter(log => this.isThisWeek(log.date))
      .reduce((sum, log) => sum + log.minutes, 0);

    const studyHours = hoursFromMinutes(totals['study'] + loggedStudy);
    const workHours = hoursFromMinutes(totals['work']);
    const universityHours = hoursFromMinutes(totals['university']);
    const exerciseHours = hoursFromMinutes(totals['exercise']);
    const sleepHours = hoursFromMinutes(totals['sleep']);
    const commuteHours = hoursFromMinutes(totals['commute']);
    const mealHours = hoursFromMinutes(totals['meal']);
    const personalHours = hoursFromMinutes(totals['personal']);

    const occupied =
      workHours + universityHours + studyHours + exerciseHours + sleepHours + commuteHours + mealHours + personalHours;
    const freeHours = Math.max(0, Math.round((24 * 7 - occupied) * 10) / 10);

    const overloadedDays = state.routines.filter(r => r.overloaded).map(r => r.dayOfWeek);
    const recommendations = this.buildRecommendations(state, { workHours, universityHours, studyHours, exerciseHours, freeHours });

    return {
      workHours,
      universityHours,
      studyHours,
      exerciseHours,
      sleepHours,
      freeHours,
      commuteHours,
      mealHours,
      personalHours,
      overloadedDays,
      recommendations,
      exercisePlan: state.exerciseSessions
        .slice()
        .sort((a, b) => mondayFirst(a.dayOfWeek) - mondayFirst(b.dayOfWeek))
        .map(session => ({
          day: session.dayOfWeek,
          start: session.start,
          label: session.title
        }))
    };
  }

  freeSlots(state: PlannerState, day: DayOfWeek): FreeSlot[] {
    const routine = state.routines.find(r => r.dayOfWeek === day);
    const wake = routine?.wakeTime ?? '07:00';
    const sleep = routine?.sleepTime ?? '23:00';
    const blocks = state.blocks
      .filter(b => b.dayOfWeek === day && b.category !== 'sleep')
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    const slots: FreeSlot[] = [];
    let cursor = toMinutes(wake);

    for (const block of blocks) {
      const start = toMinutes(block.start);
      if (start - cursor >= MIN_SLOT) {
        slots.push({
          dayOfWeek: day,
          start: this.pad(cursor),
          end: this.pad(start),
          minutes: start - cursor
        });
      }
      cursor = Math.max(cursor, toMinutes(block.end));
    }

    const sleepStart = toMinutes(sleep);
    if (sleepStart > cursor && sleepStart - cursor >= MIN_SLOT) {
      slots.push({
        dayOfWeek: day,
        start: this.pad(cursor),
        end: sleep,
        minutes: sleepStart - cursor
      });
    }

    return slots.filter(slot => !this.isSleepWindow(slot.start, slot.end));
  }

  suggestStudy(state: PlannerState): StudySuggestion[] {
    const pending = state.tasks
      .filter(t => !t.completed && t.estimatedMinutes > t.loggedMinutes)
      .sort((a, b) => this.priorityScore(b.priority) - this.priorityScore(a.priority));

    const suggestions: StudySuggestion[] = [];
    const remaining = new Map(pending.map(t => [t.id, t.estimatedMinutes - t.loggedMinutes]));
    const preferred = [6, 0, 5, 2, 3, 1, 4] as DayOfWeek[];
    const termId = state.blocks[0]?.termId ?? state.selectedTermId;
    const protectedDays = new Set(parseProtectedDays(state.terms.find(t => t.id === termId)?.protectedDays));

    for (const day of preferred) {
      if (protectedDays.has(day)) continue;
      const slots = this.freeSlots(state, day)
        .filter(s => s.minutes >= 45)
        .sort((a, b) => b.minutes - a.minutes);

      for (const slot of slots) {
        const task = pending.find(t => (remaining.get(t.id) ?? 0) > 0);
        if (!task) break;
        const need = remaining.get(task.id) ?? 0;
        const chunk = Math.min(need, Math.min(slot.minutes, 90));
        if (chunk < 45) continue;

        const startMin = toMinutes(slot.start);
        suggestions.push({
          taskId: task.id,
          taskTitle: task.title,
          dayOfWeek: day,
          start: this.pad(startMin),
          end: this.pad(startMin + chunk),
          minutes: chunk,
          reason: this.suggestionReason(day, task, chunk)
        });
        remaining.set(task.id, need - chunk);
      }
    }

    return suggestions.slice(0, 8);
  }

  exerciseStats(state: PlannerState): ExerciseStats {
    const weekStart = startOfWeek();
    const logs = state.exerciseLogs.filter(log => this.isThisWeek(log.date, weekStart));
    const byDay: ExerciseStats['byDay'] = {
      0: { planned: 0, completed: 0 },
      1: { planned: 0, completed: 0 },
      2: { planned: 0, completed: 0 },
      3: { planned: 0, completed: 0 },
      4: { planned: 0, completed: 0 },
      5: { planned: 0, completed: 0 },
      6: { planned: 0, completed: 0 }
    };

    let plannedHours = 0;
    for (const session of state.exerciseSessions) {
      const hours = durationMinutes(session.start, session.end) / 60;
      plannedHours += hours;
      byDay[session.dayOfWeek].planned += hours;
    }

    let completedHours = 0;
    for (const log of logs) {
      if (!log.completed) continue;
      const session = state.exerciseSessions.find(s => s.id === log.sessionId);
      const hours = session ? durationMinutes(session.start, session.end) / 60 : 1;
      completedHours += hours;
      if (session) byDay[session.dayOfWeek].completed += hours;
    }

    const compliance = plannedHours === 0 ? 0 : Math.round((completedHours / plannedHours) * 100);
    let bestDay: DayOfWeek | null = null;
    let worstDay: DayOfWeek | null = null;
    let bestRatio = -1;
    let worstRatio = 2;

    for (const day of WEEK_ORDER) {
      if (byDay[day].planned === 0) continue;
      const ratio = byDay[day].completed / byDay[day].planned;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestDay = day;
      }
      if (ratio < worstRatio) {
        worstRatio = ratio;
        worstDay = day;
      }
    }

    const reasonCounts: Record<SkipReason, number> = {
      tired: 0,
      work: 0,
      university: 0,
      personal: 0,
      'no-motivation': 0
    };
    for (const log of state.exerciseLogs) {
      if (log.reason) reasonCounts[log.reason] += 1;
    }

    return { plannedHours, completedHours, compliance, bestDay, worstDay, byDay, reasonCounts };
  }

  historicalExercise(state: PlannerState): {
    plannedHours: number;
    completedHours: number;
    compliance: number;
  } {
    const weeks = this.countLoggedWeeks(state.exerciseLogs);
    const plannedPerWeek = state.exerciseSessions.reduce(
      (sum, s) => sum + durationMinutes(s.start, s.end) / 60,
      0
    );
    const plannedHours = Math.max(plannedPerWeek, weeks * plannedPerWeek);
    const completedHours = state.exerciseLogs
      .filter(l => l.completed)
      .reduce((sum, log) => {
        const session = state.exerciseSessions.find(s => s.id === log.sessionId);
        return sum + (session ? durationMinutes(session.start, session.end) / 60 : 1);
      }, 0);
    const compliance = plannedHours === 0 ? 0 : Math.round((completedHours / plannedHours) * 100);
    return { plannedHours, completedHours, compliance };
  }

  dayLoad(state: PlannerState, day: DayOfWeek): 'light' | 'balanced' | 'heavy' {
    const minutes = state.blocks
      .filter(b => b.dayOfWeek === day && (b.category === 'work' || b.category === 'university' || b.category === 'commute'))
      .reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0);
    if (minutes >= 12 * 60) return 'heavy';
    if (minutes >= 9 * 60) return 'balanced';
    return 'light';
  }

  nextBlock(state: PlannerState, day: DayOfWeek, currentMinutes: number): TimeBlock | null {
    return (
      state.blocks
        .filter(b => b.dayOfWeek === day && toMinutes(b.start) >= currentMinutes && b.category !== 'sleep')
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0] ?? null
    );
  }

  currentBlock(state: PlannerState, day: DayOfWeek, currentMinutes: number): TimeBlock | null {
    return (
      state.blocks.find(b => {
        if (b.dayOfWeek !== day) return false;
        const start = toMinutes(b.start);
        const end = toMinutes(b.end);
        if (b.category === 'sleep' && end < start) {
          return currentMinutes >= start || currentMinutes < end;
        }
        return currentMinutes >= start && currentMinutes < end;
      }) ?? null
    );
  }

  private buildRecommendations(
    state: PlannerState,
    hours: { workHours: number; universityHours: number; studyHours: number; exerciseHours: number; freeHours: number }
  ): string[] {
    if (!state.blocks.length) {
      return ['Aún no hay horario. Genera un ciclo para ver recomendaciones.'];
    }

    const recs: string[] = [];
    const overloaded = state.routines.filter(r => r.overloaded);
    for (const routine of overloaded) {
      recs.push(
        `No agregues actividades extra el ${DAY_LABELS[routine.dayOfWeek]}. Ese día ya está al límite.`
      );
    }

    const pending = state.tasks.filter(t => !t.completed);
    if (pending.length) {
      recs.push('Hay tareas pendientes. Usa los huecos de 45 minutos o más para estudio, no para llenar el día por inercia.');
    }
    if (hours.studyHours < 4 && pending.length) {
      recs.push('Esta semana tienes poco estudio personal registrado. Prioriza las tareas de alta prioridad.');
    }
    if (hours.exerciseHours >= 3) {
      recs.push('3–4 sesiones semanales son suficientes. No hace falta entrenar los 7 días.');
    }
    const termId = state.blocks[0]?.termId ?? state.selectedTermId;
    const protectedDays = parseProtectedDays(state.terms.find(t => t.id === termId)?.protectedDays);
    if (protectedDays.length) {
      recs.push(
        `Días protegidos: ${protectedDays.map(day => DAY_LABELS[day]).join(', ')}. Ahí no se sugiere estudio extra.`
      );
    }
    if (!recs.length) {
      recs.push('El horario está cargado. Marca lo que hagas para que el análisis refleje tu semana real.');
    }
    return recs;
  }

  private suggestionReason(day: DayOfWeek, task: Task, minutes: number): string {
    const when = DAY_LABELS[day];
    return `${when}: ${minutes} min sugeridos para “${task.title}”.`;
  }

  private priorityScore(priority: Task['priority']): number {
    return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
  }

  private isThisWeek(date: string, weekStart = startOfWeek()): boolean {
    const d = new Date(`${date}T00:00:00`);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return d >= weekStart && d < end;
  }

  private countLoggedWeeks(logs: ExerciseLog[]): number {
    if (!logs.length) return 1;
    const weeks = new Set(logs.map(l => isoDate(startOfWeek(new Date(`${l.date}T00:00:00`)))));
    return Math.max(1, weeks.size);
  }

  private isSleepWindow(start: string, end: string): boolean {
    const s = toMinutes(start);
    return s >= 23 * 60 || s < 6 * 60 || toMinutes(end) <= 7 * 60 && s >= 22 * 60;
  }

  private pad(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  sortBlocks(blocks: TimeBlock[]): TimeBlock[] {
    const rank = (block: TimeBlock) => {
      if (block.category === 'sleep') return 9;
      if (block.category === 'commute') return 1;
      if (block.category === 'meal') return 2;
      return 0;
    };
    return [...blocks].sort((a, b) => {
      const dayDiff = mondayFirst(a.dayOfWeek) - mondayFirst(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      const startDiff = toMinutes(a.start) - toMinutes(b.start);
      if (startDiff !== 0) return startDiff;
      const endDiff = toMinutes(a.end) - toMinutes(b.end);
      if (endDiff !== 0) return endDiff;
      return rank(a) - rank(b);
    });
  }
}
