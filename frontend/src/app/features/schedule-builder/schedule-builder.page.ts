import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlannerStore } from '../../core/services/planner.store';
import {
  ClassSpec,
  CourseSpec,
  defaultDraft,
  draftFromTerm,
  ExerciseSpec,
  ScheduleDraft,
  WorkDaySpec
} from '../../core/services/schedule.generator';
import { DisableAutocompleteDirective } from '../../core/directives/disable-autocomplete.directive';
import { findScheduleConflicts } from '../../core/utils/schedule-conflicts';
import { asDayOfWeek, DAY_LABELS, DAY_SHORT, EXERCISE_TYPE_LABELS, MODALITY_LABELS, WEEK_ORDER } from '../../core/utils/time';
import { DayOfWeek } from '../../core/models/planner.models';

@Component({
  selector: 'app-schedule-builder-page',
  imports: [FormsModule, RouterLink, DisableAutocompleteDirective],
  templateUrl: './schedule-builder.page.html',
  styleUrl: './schedule-builder.page.scss'
})
export class ScheduleBuilderPage {
  private readonly store = inject(PlannerStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly days = WEEK_ORDER;
  readonly labels = DAY_LABELS;
  readonly asDay = asDayOfWeek;
  readonly shorts = DAY_SHORT;
  readonly modality = MODALITY_LABELS;
  readonly exerciseTypes = EXERCISE_TYPE_LABELS;
  readonly draft: ScheduleDraft = defaultDraft();
  readonly viewed = this.store.viewedTerm;
  readonly saving = signal(false);
  readonly openCourse = signal(0);

  constructor() {
    const current = this.viewed();
    const replace = this.route.snapshot.queryParamMap.get('modo') === 'reemplazar';
    const copy = this.route.snapshot.queryParamMap.get('copiar') === '1';
    if (current && replace) {
      Object.assign(this.draft, draftFromTerm(this.store.state(), current));
      return;
    }
    if (current && copy) {
      this.copyFrom(current.id);
      return;
    }
    if (current) {
      const end = new Date(`${current.endDate}T00:00:00`);
      end.setMonth(end.getMonth() + 5);
      const start = new Date(`${current.endDate}T00:00:00`);
      start.setDate(start.getDate() + 1);
      this.draft.startDate = this.iso(start);
      this.draft.endDate = this.iso(end);
      this.draft.name = this.suggestName(this.draft.startDate);
    }
  }

  addCourse(): void {
    this.draft.courses.push({
      name: '',
      shortName: '',
      modality: 'presencial',
      sessions: [this.emptyClass()]
    });
    this.openCourse.set(this.draft.courses.length - 1);
  }

  removeCourse(index: number): void {
    this.draft.courses.splice(index, 1);
    const open = this.openCourse();
    if (open === index) this.openCourse.set(Math.max(this.draft.courses.length - 1, -1));
    else if (open > index) this.openCourse.set(open - 1);
  }

  toggleCourse(index: number): void {
    this.openCourse.update(current => (current === index ? -1 : index));
  }

  courseSummary(course: CourseSpec): string {
    if (course.modality === 'virtual-247') return this.modality['virtual-247'];
    if (!course.sessions.length) return 'Sin sesiones';
    return course.sessions.map(session => `${DAY_SHORT[session.dayOfWeek]} ${session.start}`).join(' · ');
  }

  addClass(course: CourseSpec): void {
    course.sessions.push(this.emptyClass());
  }

  removeClass(course: CourseSpec, index: number): void {
    course.sessions.splice(index, 1);
  }

  suggest(): void {
    this.draft.name = this.suggestName(this.draft.startDate);
  }

  conflicts(): string[] {
    return findScheduleConflicts(this.draft);
  }

  requestGenerate(): void {
    if (!this.draft.name.trim() || !this.draft.startDate || !this.draft.endDate) return;
    if (this.draft.endDate < this.draft.startDate) return;
    if (this.conflicts().length) return;
    void this.generate();
  }

  async generate(): Promise<void> {
    this.saving.set(true);
    try {
      await this.store.generateFromDraft(this.draft);
      await this.router.navigateByUrl('/semana');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        const detail = error.error?.detail;
        alert(Array.isArray(detail) ? detail.join('\n') : 'Hay cruces de horario.');
        return;
      }
      alert('No se pudo guardar el horario. Revisa que el servidor esté encendido.');
    } finally {
      this.saving.set(false);
    }
  }

  workDays(): number {
    return this.draft.work.filter(w => w.enabled).length;
  }

  workRange(): string | null {
    const days = this.draft.work.filter(w => w.enabled);
    if (!days.length) return null;
    const same = days.every(d => d.start === days[0].start && d.end === days[0].end);
    return same ? `${days[0].start}–${days[0].end}` : 'horarios distintos';
  }

  workHoursDiffer(): boolean {
    return this.workRange() === 'horarios distintos';
  }

  firstWorkDay() {
    return this.draft.work.find(day => day.enabled);
  }

  toggleWork(day: WorkDaySpec): void {
    day.enabled = !day.enabled;
    if (!day.enabled) return;
    const source = this.draft.work.find(item => item.enabled && item !== day);
    if (source) {
      day.start = source.start;
      day.end = source.end;
    }
  }

  setWorkWeekdays(): void {
    const source = this.draft.work.find(item => item.enabled);
    for (const day of this.draft.work) {
      const weekday = day.dayOfWeek >= 1 && day.dayOfWeek <= 5;
      if (weekday && source && !day.enabled) {
        day.start = source.start;
        day.end = source.end;
      }
      day.enabled = weekday;
    }
  }

  clearWork(): void {
    for (const day of this.draft.work) day.enabled = false;
  }

  applyWorkHours(from: WorkDaySpec): void {
    for (const day of this.draft.work) {
      if (!day.enabled || day === from) continue;
      day.start = from.start;
      day.end = from.end;
    }
  }

  applyFirstWorkHours(): void {
    const source = this.firstWorkDay();
    if (source) this.applyWorkHours(source);
  }

  isProtected(day: DayOfWeek): boolean {
    return this.draft.protectedDays.includes(day);
  }

  toggleProtected(day: DayOfWeek): void {
    const current = this.draft.protectedDays;
    this.draft.protectedDays = current.includes(day)
      ? current.filter(item => item !== day)
      : [...current, day].sort((a, b) => a - b);
  }

  copyFromViewed(): void {
    const term = this.viewed();
    if (term) this.copyFrom(term.id);
  }

  private copyFrom(termId: string): void {
    const term = this.store.state().terms.find(item => item.id === termId);
    if (!term) return;
    const copied = draftFromTerm(this.store.state(), term);
    copied.mode = 'new';
    const start = new Date(`${term.endDate}T00:00:00`);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 5);
    copied.startDate = this.iso(start);
    copied.endDate = this.iso(end);
    copied.name = this.suggestName(copied.startDate);
    Object.assign(this.draft, copied);
  }

  classCount(): number {
    return this.draft.courses.reduce(
      (sum, course) => sum + (course.modality === 'virtual-247' ? 0 : course.sessions.length),
      0
    );
  }

  exerciseCount(): number {
    return this.draft.exercises.filter(e => e.enabled).length;
  }

  exerciseRange(): string | null {
    const days = this.draft.exercises.filter(item => item.enabled);
    if (!days.length) return null;
    const same = days.every(item => item.start === days[0].start && item.end === days[0].end);
    return same ? `${days[0].start}–${days[0].end}` : 'horarios distintos';
  }

  firstExercise() {
    return this.draft.exercises.find(item => item.enabled);
  }

  exerciseDetailsDiffer(): boolean {
    const days = this.draft.exercises.filter(item => item.enabled);
    if (days.length < 2) return false;
    const first = days[0];
    return days.some(item =>
      item.start !== first.start ||
      item.end !== first.end ||
      item.title !== first.title ||
      item.type !== first.type ||
      item.intensity !== first.intensity
    );
  }

  toggleExercise(item: ExerciseSpec): void {
    item.enabled = !item.enabled;
    if (!item.enabled) return;
    const source = this.draft.exercises.find(ex => ex.enabled && ex !== item);
    if (!source) return;
    item.start = source.start;
    item.end = source.end;
    item.title = source.title;
    item.type = source.type;
    item.intensity = source.intensity;
  }

  clearExercise(): void {
    for (const item of this.draft.exercises) item.enabled = false;
  }

  applyFirstExercise(): void {
    const source = this.firstExercise();
    if (!source) return;
    for (const item of this.draft.exercises) {
      if (!item.enabled || item === source) continue;
      item.start = source.start;
      item.end = source.end;
      item.title = source.title;
      item.type = source.type;
      item.intensity = source.intensity;
    }
  }

  courseIndex(course: CourseSpec): number {
    return this.draft.courses.indexOf(course);
  }

  private emptyClass(): ClassSpec {
    return { dayOfWeek: 1, start: '18:30', end: '20:00', location: '' };
  }

  private suggestName(start: string): string {
    const date = new Date(`${start}T00:00:00`);
    const year = date.getFullYear();
    const half = date.getMonth() >= 6 ? 'II' : 'I';
    return `Ciclo ${year}-${half}`;
  }

  private iso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
