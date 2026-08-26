import { CourseModality, DayOfWeek, ExerciseType } from '../models/planner.models';

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado'
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb'
};

export const CATEGORY_LABELS: Record<string, string> = {
  work: 'Trabajo',
  university: 'Universidad',
  exercise: 'Ejercicio',
  study: 'Estudio',
  meal: 'Comida',
  commute: 'Traslado',
  personal: 'Personal',
  sleep: 'Sueño',
  virtual: 'Virtual'
};

export const MODALITY_LABELS: Record<CourseModality, string> = {
  presencial: 'Presencial',
  'virtual-live': 'Virtual en vivo',
  'virtual-247': 'Virtual 24/7'
};

export function blockKindLabel(block: { category: string; modality?: CourseModality }): string {
  if (block.modality) return MODALITY_LABELS[block.modality];
  return CATEGORY_LABELS[block.category] ?? block.category;
}

export const PRIORITY_LABELS = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja'
} as const;

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  workout: 'Gym',
  walk: 'Caminata',
  run: 'Trote',
  recovery: 'Recuperación'
};

export const EXCEPTION_LABELS: Record<string, string> = {
  holiday: 'Feriado',
  'off-work': 'Sin trabajo',
  meeting: 'Junta',
  exam: 'Examen',
  custom: 'Otro'
};

export const TOPIC_LABELS: Record<string, string> = {
  exam: 'Examen',
  assignment: 'Práctica / entrega',
  topic: 'Tema'
};

export function parseProtectedDays(value?: string | null): DayOfWeek[] {
  if (!value) return [4];
  const days = value
    .split(',')
    .map(item => Number(item.trim()))
    .filter((day): day is DayOfWeek => day >= 0 && day <= 6);
  return days.length ? days : [4];
}

export function serializeProtectedDays(days: DayOfWeek[]): string {
  return (days.length ? days : [4]).join(',');
}

export const SKIP_REASONS = [
  { id: 'tired' as const, label: 'Estaba cansado', icon: '😴' },
  { id: 'work' as const, label: 'Trabajo', icon: '💼' },
  { id: 'university' as const, label: 'Universidad', icon: '🎓' },
  { id: 'personal' as const, label: 'Asuntos personales', icon: '🏠' },
  { id: 'no-motivation' as const, label: 'No tenía ganas', icon: '❌' }
];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function durationMinutes(start: string, end: string): number {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (e <= s) {
    return 24 * 60 - s + e;
  }
  return e - s;
}

export function hoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function formatHours(hours: number): string {
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  if (mins === 0) return `${whole} h`;
  if (whole === 0) return `${mins} min`;
  return `${whole} h ${mins} min`;
}

export function todayDayOfWeek(date = new Date()): DayOfWeek {
  return date.getDay() as DayOfWeek;
}

export function asDayOfWeek(value: number | string): DayOfWeek {
  const day = Number(value);
  return (day >= 0 && day <= 6 ? day : 0) as DayOfWeek;
}

export function isoDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dateForWeekDay(dayOfWeek: DayOfWeek, weekStart = startOfWeek()): Date {
  const d = new Date(weekStart);
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() + offset);
  return d;
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

export function nowMinutes(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function timeHasStarted(start: string, date: string, at = new Date()): boolean {
  const today = isoDate(at);
  if (date < today) return true;
  if (date > today) return false;
  return nowMinutes(at) >= toMinutes(start);
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function mondayFirst(day: DayOfWeek): number {
  return day === 0 ? 6 : day - 1;
}

export const WEEK_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function formatDateRange(start: string, end: string): string {
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  const sameYear = from.getFullYear() === to.getFullYear();
  const left = from.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric'
  });
  const right = to.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  return `${left} – ${right}`;
}

export function termStatus(start: string, end: string, today = isoDate()): 'current' | 'upcoming' | 'past' {
  if (dateInRange(today, start, end)) return 'current';
  if (today < start) return 'upcoming';
  return 'past';
}

export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  return next;
}

export function formatMonthYear(date: Date): string {
  const raw = date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export interface CalendarCell {
  date: string;
  day: number;
  dayOfWeek: DayOfWeek;
  inMonth: boolean;
}

export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const current = addDays(start, i);
    cells.push({
      date: isoDate(current),
      day: current.getDate(),
      dayOfWeek: current.getDay() as DayOfWeek,
      inMonth: current.getMonth() === month
    });
  }
  while (cells.length > 28) {
    const tail = cells.slice(-7);
    if (tail.every(cell => !cell.inMonth)) cells.splice(-7);
    else break;
  }
  return cells;
}
