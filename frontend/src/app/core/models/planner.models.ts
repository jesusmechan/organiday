export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type BlockCategory =
  | 'work'
  | 'university'
  | 'exercise'
  | 'study'
  | 'meal'
  | 'commute'
  | 'personal'
  | 'sleep'
  | 'virtual';

export type CourseModality = 'presencial' | 'virtual-live' | 'virtual-247';

export type Priority = 'high' | 'medium' | 'low';

export type ExerciseType = 'walk' | 'run' | 'workout' | 'recovery';

export type SkipReason = 'tired' | 'work' | 'university' | 'personal' | 'no-motivation';

export interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  protectedDays?: string;
}

export interface TimeBlock {
  id: string;
  title: string;
  category: BlockCategory;
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
  location?: string;
  notes?: string;
  recurring: boolean;
  optional?: boolean;
  termId: string;
  modality?: CourseModality;
  date?: string;
}

export interface Course {
  id: string;
  name: string;
  shortName: string;
  modality: CourseModality;
  color: string;
  termId: string;
}

export interface Task {
  id: string;
  title: string;
  courseId?: string;
  priority: Priority;
  deadline?: string;
  estimatedMinutes: number;
  loggedMinutes: number;
  completed: boolean;
  createdAt: string;
  notes?: string;
  termId: string;
}

export interface StudyLog {
  id: string;
  taskId?: string;
  courseId?: string;
  date: string;
  minutes: number;
  note?: string;
}

export interface ExerciseSession {
  id: string;
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
  type: ExerciseType;
  title: string;
  intensity: 'light' | 'moderate' | 'full';
  termId: string;
}

export interface ExerciseLog {
  id: string;
  date: string;
  sessionId: string;
  completed: boolean;
  skipped: boolean;
  reason?: SkipReason;
  type?: ExerciseType;
  note?: string;
}

export interface DayRoutine {
  dayOfWeek: DayOfWeek;
  wakeTime: string;
  sleepTime: string;
  overloaded: boolean;
  overloadReason?: string;
  termId: string;
}

export interface FreeSlot {
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
  minutes: number;
  date?: string;
}

export interface StudySuggestion {
  taskId: string;
  taskTitle: string;
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
  minutes: number;
  reason: string;
}

export interface WeeklySummary {
  workHours: number;
  universityHours: number;
  studyHours: number;
  exerciseHours: number;
  sleepHours: number;
  freeHours: number;
  commuteHours: number;
  mealHours: number;
  personalHours: number;
  overloadedDays: DayOfWeek[];
  recommendations: string[];
  exercisePlan: { day: DayOfWeek; start: string; label: string }[];
}

export interface ExerciseStats {
  plannedHours: number;
  completedHours: number;
  compliance: number;
  bestDay: DayOfWeek | null;
  worstDay: DayOfWeek | null;
  byDay: Record<DayOfWeek, { planned: number; completed: number }>;
  reasonCounts: Record<SkipReason, number>;
}

export interface BlockCheck {
  id: string;
  blockId: string;
  date: string;
  completed: boolean;
  completedAt: string;
}

export type ExceptionKind = 'holiday' | 'off-work' | 'meeting' | 'exam' | 'custom';

export interface DayException {
  id: string;
  date: string;
  kind: ExceptionKind;
  title: string;
  start?: string;
  end?: string;
  termId: string;
}

export type TopicKind = 'exam' | 'assignment' | 'topic';

export interface CourseTopic {
  id: string;
  courseId: string;
  title: string;
  kind: TopicKind;
  dueDate: string;
  done: boolean;
  termId: string;
}

export interface BlockSkip {
  id: string;
  blockId: string;
  date: string;
}

export interface DayProgress {
  done: number;
  total: number;
  percent: number;
}

export interface PlannerState {
  version: number;
  terms: Term[];
  selectedTermId: string;
  blocks: TimeBlock[];
  courses: Course[];
  tasks: Task[];
  studyLogs: StudyLog[];
  exerciseSessions: ExerciseSession[];
  exerciseLogs: ExerciseLog[];
  routines: DayRoutine[];
  blockChecks: BlockCheck[];
  exceptions: DayException[];
  topics: CourseTopic[];
  blockSkips: BlockSkip[];
}
