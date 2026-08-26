import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  BlockCategory,
  CourseTopic,
  DayException,
  DayOfWeek,
  DayProgress,
  ExceptionKind,
  ExerciseLog,
  ExerciseType,
  PlannerState,
  SkipReason,
  Task,
  Term,
  TimeBlock,
  TopicKind
} from '../models/planner.models';
import { InsightsEngine } from './insights.engine';
import { PlannerApiService } from './planner-api.service';
import { AuthService } from './auth.service';
import { dateForWeekDay, dateInRange, isoDate, serializeProtectedDays, timeHasStarted, todayDayOfWeek } from '../utils/time';
import { exceptionFor, visibleBlocks } from '../utils/day-view';
import { ScheduleDraft } from './schedule.generator';
import { createEmptyState } from '../data/seed';

@Injectable({ providedIn: 'root' })
export class PlannerStore {
  private readonly api = inject(PlannerApiService);
  private readonly auth = inject(AuthService);
  private readonly engine = new InsightsEngine();
  readonly state = signal<PlannerState>(createEmptyState());
  readonly loading = signal(true);
  readonly offline = signal(false);
  readonly clock = signal(Date.now());

  readonly today = computed(() => todayDayOfWeek());
  readonly viewedTerm = computed(() => this.resolveTerm(this.state()));
  readonly liveTerm = computed(() => {
    const today = isoDate();
    return this.state().terms.find(t => dateInRange(today, t.startDate, t.endDate)) ?? null;
  });
  readonly termState = computed(() => this.filterToTerm(this.state(), this.viewedTerm()?.id));
  readonly todayBlocks = computed(() => this.blocksFor(this.today(), isoDate()));
  readonly summary = computed(() => this.engine.weeklySummary(this.termState()));
  readonly suggestions = computed(() => this.engine.suggestStudy(this.termState()));
  readonly exerciseStats = computed(() => this.engine.exerciseStats(this.termState()));
  readonly historicalExercise = computed(() => this.engine.historicalExercise(this.termState()));
  readonly pendingTasks = computed(() =>
    this.termState().tasks.filter(t => !t.completed).sort((a, b) => this.rank(b.priority) - this.rank(a.priority))
  );
  readonly todayProgress = computed(() => this.progressFor(this.today(), isoDate()));
  readonly isViewingLiveTerm = computed(() => {
    const viewed = this.viewedTerm();
    const live = this.liveTerm();
    return !!viewed && !!live && viewed.id === live.id;
  });

  constructor() {
    effect(() => {
      if (this.auth.user()) {
        void this.refresh();
        return;
      }
      this.state.set(createEmptyState());
      this.offline.set(false);
      this.loading.set(false);
    });
    if (typeof window !== 'undefined') {
      window.setInterval(() => this.clock.set(Date.now()), 15_000);
    }
  }

  async refresh(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      return;
    }
    try {
      const state = this.api.normalize(await this.api.getPlanner());
      this.state.set(state);
      this.offline.set(false);
    } catch {
      if (this.auth.isLoggedIn()) this.offline.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  blocksFor(day: DayOfWeek, date = isoDate(dateForWeekDay(day))): TimeBlock[] {
    return this.engine.sortBlocks(visibleBlocks(this.termState(), day, date));
  }

  exceptionOn(date: string): DayException | undefined {
    return exceptionFor(this.termState(), date);
  }

  deadlinesOn(date: string) {
    const state = this.termState();
    return {
      tasks: state.tasks.filter(task => task.deadline === date && !task.completed),
      topics: state.topics.filter(topic => topic.dueDate === date)
    };
  }

  freeSlots(day: DayOfWeek, date = isoDate(dateForWeekDay(day))) {
    return this.engine.freeSlots(this.withBlocks(this.blocksFor(day, date)), day);
  }

  dayLoad(day: DayOfWeek, date = isoDate(dateForWeekDay(day))) {
    return this.engine.dayLoad(this.withBlocks(this.blocksFor(day, date)), day);
  }

  currentBlock() {
    const now = new Date();
    return this.engine.currentBlock(
      this.withBlocks(this.todayBlocks()),
      todayDayOfWeek(now),
      now.getHours() * 60 + now.getMinutes()
    );
  }

  nextBlock() {
    const now = new Date();
    return this.engine.nextBlock(
      this.withBlocks(this.todayBlocks()),
      todayDayOfWeek(now),
      now.getHours() * 60 + now.getMinutes()
    );
  }

  async selectTerm(id: string): Promise<void> {
    if (!this.state().terms.some(t => t.id === id)) return;
    this.state.update(state => ({ ...state, selectedTermId: id }));
    await this.guard(() => this.api.selectTerm(id));
  }

  async updateTerm(
    id: string,
    patch: Partial<Pick<Term, 'name' | 'startDate' | 'endDate' | 'protectedDays'>>
  ): Promise<void> {
    const term = this.state().terms.find(item => item.id === id);
    if (!term) return;
    await this.guard(async () => {
      await this.api.updateTerm(id, {
        name: patch.name ?? term.name,
        startDate: patch.startDate ?? term.startDate,
        endDate: patch.endDate ?? term.endDate,
        protectedDays: patch.protectedDays ?? term.protectedDays ?? serializeProtectedDays([4])
      });
      await this.refresh();
    });
  }

  async generateFromDraft(draft: ScheduleDraft): Promise<string> {
    const replaceTermId = draft.mode === 'replace' ? this.viewedTerm()?.id : undefined;
    const state = this.api.normalize(await this.api.generate(draft, replaceTermId));
    this.state.set(state);
    this.offline.set(false);
    return state.selectedTermId;
  }

  async deleteTerm(id: string): Promise<void> {
    await this.guard(async () => {
      await this.api.deleteTerm(id);
      await this.refresh();
    });
  }

  isChecked(blockId: string, date = isoDate()): boolean {
    return this.state().blockChecks.some(c => c.blockId === blockId && c.date === date && c.completed);
  }

  canCheck(block: TimeBlock, date = isoDate()): boolean {
    this.clock();
    return timeHasStarted(block.start, date);
  }

  canLogAt(start: string, date: string): boolean {
    this.clock();
    return timeHasStarted(start, date);
  }

  progressFor(day: DayOfWeek, date = isoDate(dateForWeekDay(day))): DayProgress {
    const blocks = this.blocksFor(day, date).filter(b => b.category !== 'sleep');
    const done = blocks.filter(b => this.isChecked(b.id, date)).length;
    const total = blocks.length;
    return {
      done,
      total,
      percent: total === 0 ? 0 : Math.round((done / total) * 100)
    };
  }

  async toggleBlock(block: TimeBlock, date = isoDate()): Promise<void> {
    const checked = this.isChecked(block.id, date);
    if (!checked && !this.canCheck(block, date)) return;
    await this.guard(async () => {
      if (checked) {
        const existing = this.state().blockChecks.find(c => c.blockId === block.id && c.date === date);
        if (existing) await this.api.deleteCheck(existing.id);
      } else {
        await this.api.addCheck({
          blockId: block.id,
          date,
          completed: true,
          completedAt: new Date().toISOString()
        });
      }

      if (block.category === 'exercise') {
        const session = this.state().exerciseSessions.find(s => s.dayOfWeek === block.dayOfWeek);
        if (session) {
          if (checked) {
            await this.clearExerciseLog(session.id, date);
          } else {
            await this.api.upsertExerciseLog({
              date,
              sessionId: session.id,
              completed: true,
              skipped: false,
              type: session.type
            });
          }
        }
      }

      await this.refresh();
    });
  }

  async addTask(input: Omit<Task, 'id' | 'createdAt' | 'loggedMinutes' | 'completed' | 'termId'>): Promise<void> {
    const termId = this.viewedTerm()?.id ?? this.state().selectedTermId;
    if (!termId) return;
    await this.guard(async () => {
      await this.api.addTask({
        ...input,
        loggedMinutes: 0,
        completed: false,
        termId
      });
      await this.refresh();
    });
  }

  async toggleTask(id: string): Promise<void> {
    const task = this.state().tasks.find(item => item.id === id);
    if (!task) return;
    await this.guard(async () => {
      await this.api.updateTask({ ...task, completed: !task.completed });
      await this.refresh();
    });
  }

  async logStudy(taskId: string, minutes: number): Promise<void> {
    const task = this.state().tasks.find(item => item.id === taskId);
    if (!task) return;
    await this.guard(async () => {
      await this.api.addStudyLog({
        taskId,
        courseId: task.courseId,
        date: isoDate(),
        minutes
      });
      await this.api.updateTask({ ...task, loggedMinutes: task.loggedMinutes + minutes });
      await this.refresh();
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.guard(async () => {
      await this.api.deleteTask(id);
      await this.refresh();
    });
  }

  todayExerciseSession() {
    const day = todayDayOfWeek();
    return this.termState().exerciseSessions.find(s => s.dayOfWeek === day) ?? null;
  }

  todayExerciseLog(): ExerciseLog | undefined {
    const session = this.todayExerciseSession();
    if (!session) return undefined;
    return this.state().exerciseLogs.find(l => l.date === isoDate() && l.sessionId === session.id);
  }

  async completeExercise(type?: ExerciseType): Promise<void> {
    const session = this.todayExerciseSession();
    if (!session || !this.canLogAt(session.start, isoDate())) return;
    await this.writeExercise(session.id, session.dayOfWeek, {
      date: isoDate(),
      sessionId: session.id,
      completed: true,
      skipped: false,
      type: type ?? session.type
    });
  }

  async skipExercise(reason: SkipReason): Promise<void> {
    const session = this.todayExerciseSession();
    if (!session) return;
    await this.writeExercise(session.id, session.dayOfWeek, {
      date: isoDate(),
      sessionId: session.id,
      completed: false,
      skipped: true,
      reason
    });
  }

  async completeExerciseFor(sessionId: string, day: DayOfWeek): Promise<void> {
    const session = this.termState().exerciseSessions.find(item => item.id === sessionId);
    const date = isoDate(dateForWeekDay(day));
    if (session && !this.canLogAt(session.start, date)) return;
    await this.writeExercise(sessionId, day, {
      date: isoDate(dateForWeekDay(day)),
      sessionId,
      completed: true,
      skipped: false
    });
  }

  async clearExerciseFor(sessionId: string, day: DayOfWeek): Promise<void> {
    const date = isoDate(dateForWeekDay(day));
    await this.guard(async () => {
      await this.clearExerciseLog(sessionId, date);
      await this.setBlockCheckedByCategory('exercise', day, date, false);
      await this.refresh();
    });
  }

  async skipExerciseFor(sessionId: string, day: DayOfWeek, reason: SkipReason): Promise<void> {
    await this.writeExercise(sessionId, day, {
      date: isoDate(dateForWeekDay(day)),
      sessionId,
      completed: false,
      skipped: true,
      reason
    });
  }

  async acceptSuggestion(suggestion: {
    taskId: string;
    dayOfWeek: DayOfWeek;
    start: string;
    end: string;
    taskTitle: string;
  }): Promise<void> {
    const termId = this.viewedTerm()?.id ?? this.state().selectedTermId;
    if (!termId) return;
    await this.guard(async () => {
      await this.api.addBlock({
        title: suggestion.taskTitle,
        category: 'study',
        dayOfWeek: suggestion.dayOfWeek,
        start: suggestion.start,
        end: suggestion.end,
        recurring: false,
        optional: true,
        termId
      });
      await this.refresh();
    });
  }

  async reset(): Promise<void> {
    await this.guard(async () => {
      this.state.set(this.api.normalize(await this.api.reset()));
    });
  }

  async importBackup(raw: PlannerState): Promise<void> {
    const state = this.api.normalize(await this.api.importPlanner(raw));
    this.state.set(state);
    this.offline.set(false);
  }

  async updateBlock(block: TimeBlock, patch: Partial<TimeBlock>): Promise<void> {
    const { id, ...payload } = { ...block, ...patch };
    await this.guard(async () => {
      await this.api.updateBlock(id, payload);
      await this.refresh();
    });
  }

  async addOneOff(input: {
    title: string;
    category: BlockCategory;
    dayOfWeek: DayOfWeek;
    start: string;
    end: string;
    date: string;
    location?: string;
    notes?: string;
  }): Promise<void> {
    const termId = this.viewedTerm()?.id ?? this.state().selectedTermId;
    if (!termId) return;
    await this.guard(async () => {
      await this.api.addBlock({
        title: input.title,
        category: input.category,
        dayOfWeek: input.dayOfWeek,
        start: input.start,
        end: input.end,
        location: input.location,
        notes: input.notes,
        date: input.date,
        recurring: false,
        optional: true,
        termId
      });
      await this.refresh();
    });
  }

  async skipBlockToday(block: TimeBlock, date: string): Promise<void> {
    await this.guard(async () => {
      await this.api.addSkip({ blockId: block.id, date });
      await this.refresh();
    });
  }

  async deleteBlock(id: string): Promise<void> {
    await this.guard(async () => {
      await this.api.deleteBlock(id);
      await this.refresh();
    });
  }

  async addException(input: {
    date: string;
    kind: ExceptionKind;
    title: string;
    start?: string;
    end?: string;
  }): Promise<void> {
    const termId = this.viewedTerm()?.id ?? this.state().selectedTermId;
    if (!termId) return;
    await this.guard(async () => {
      await this.api.addException({ ...input, termId });
      if (input.start && input.end) {
        const day = new Date(`${input.date}T00:00:00`).getDay() as DayOfWeek;
        await this.api.addBlock({
          title: input.title,
          category: input.kind === 'exam' ? 'university' : 'personal',
          dayOfWeek: day,
          start: input.start,
          end: input.end,
          date: input.date,
          recurring: false,
          optional: true,
          termId
        });
      }
      await this.refresh();
    });
  }

  async deleteException(id: string): Promise<void> {
    await this.guard(async () => {
      await this.api.deleteException(id);
      await this.refresh();
    });
  }

  async addTopic(input: { courseId: string; title: string; kind: TopicKind; dueDate: string }): Promise<void> {
    const termId = this.viewedTerm()?.id ?? this.state().selectedTermId;
    if (!termId) return;
    await this.guard(async () => {
      await this.api.addTopic({ ...input, done: false, termId });
      await this.refresh();
    });
  }

  async toggleTopic(topic: CourseTopic): Promise<void> {
    await this.guard(async () => {
      await this.api.updateTopic({ ...topic, done: !topic.done });
      await this.refresh();
    });
  }

  async deleteTopic(id: string): Promise<void> {
    await this.guard(async () => {
      await this.api.deleteTopic(id);
      await this.refresh();
    });
  }

  private async writeExercise(sessionId: string, day: DayOfWeek, log: Omit<ExerciseLog, 'id'>): Promise<void> {
    await this.guard(async () => {
      await this.api.upsertExerciseLog(log);
      await this.setBlockCheckedByCategory('exercise', day, log.date, log.completed);
      await this.refresh();
    });
  }

  private resolveTerm(state: PlannerState): Term | null {
    const selected = state.terms.find(t => t.id === state.selectedTermId);
    if (selected) return selected;
    const today = isoDate();
    return (
      state.terms.find(t => dateInRange(today, t.startDate, t.endDate)) ??
      [...state.terms].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ??
      null
    );
  }

  private filterToTerm(state: PlannerState, termId?: string): PlannerState {
    if (!termId) {
      return {
        ...state,
        blocks: [],
        courses: [],
        tasks: [],
        exerciseSessions: [],
        routines: [],
        exceptions: [],
        topics: [],
        blockSkips: []
      };
    }
    return {
      ...state,
      blocks: state.blocks.filter(b => b.termId === termId),
      courses: state.courses.filter(c => c.termId === termId),
      tasks: state.tasks.filter(t => t.termId === termId),
      exerciseSessions: state.exerciseSessions.filter(s => s.termId === termId),
      routines: state.routines.filter(r => r.termId === termId),
      exceptions: state.exceptions.filter(item => item.termId === termId),
      topics: state.topics.filter(item => item.termId === termId)
    };
  }

  private withBlocks(blocks: TimeBlock[]): PlannerState {
    return { ...this.termState(), blocks };
  }

  private async setBlockCheckedByCategory(
    category: TimeBlock['category'],
    day: DayOfWeek,
    date: string,
    completed: boolean
  ): Promise<void> {
    const block = this.termState().blocks.find(b => b.dayOfWeek === day && b.category === category);
    if (!block) return;
    const existing = this.state().blockChecks.find(c => c.blockId === block.id && c.date === date);
    const already = !!existing?.completed;
    if (completed === already) return;
    if (!completed) {
      if (existing) await this.api.deleteCheck(existing.id);
      return;
    }
    await this.api.addCheck({
      blockId: block.id,
      date,
      completed: true,
      completedAt: new Date().toISOString()
    });
  }

  private async clearExerciseLog(sessionId: string, date: string): Promise<void> {
    const log = this.state().exerciseLogs.find(item => item.date === date && item.sessionId === sessionId);
    if (log) await this.api.deleteExerciseLog(log.id);
  }

  private async guard(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      this.offline.set(false);
    } catch {
      this.offline.set(true);
      await this.refresh();
    }
  }

  private rank(priority: Task['priority']): number {
    return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
  }
}
