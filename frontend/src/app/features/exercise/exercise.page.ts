import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlannerStore } from '../../core/services/planner.store';
import { DAY_LABELS, SKIP_REASONS, isoDate, dateForWeekDay } from '../../core/utils/time';
import { DayOfWeek, SkipReason } from '../../core/models/planner.models';

@Component({
  selector: 'app-exercise-page',
  imports: [RouterLink],
  templateUrl: './exercise.page.html',
  styleUrl: './exercise.page.scss'
})
export class ExercisePage {
  private readonly store = inject(PlannerStore);

  readonly term = this.store.viewedTerm;
  readonly sessions = computed(() => this.store.termState().exerciseSessions);
  readonly stats = this.store.exerciseStats;
  readonly history = this.store.historicalExercise;
  readonly days = DAY_LABELS;
  readonly reasons = SKIP_REASONS;
  readonly skipFor = signal<string | null>(null);

  logFor(sessionId: string, day: DayOfWeek) {
    const date = isoDate(dateForWeekDay(day));
    return this.store.state().exerciseLogs.find(l => l.date === date && l.sessionId === sessionId);
  }

  canLog(sessionId: string, day: DayOfWeek): boolean {
    const session = this.sessions().find(item => item.id === sessionId);
    if (!session) return false;
    if (this.logFor(sessionId, day)?.completed) return true;
    return this.store.canLogAt(session.start, isoDate(dateForWeekDay(day)));
  }

  done(sessionId: string, day: DayOfWeek): void {
    if (!this.canLog(sessionId, day)) return;
    if (this.logFor(sessionId, day)?.completed) {
      this.store.clearExerciseFor(sessionId, day);
    } else {
      this.store.completeExerciseFor(sessionId, day);
    }
    this.skipFor.set(null);
  }

  skip(sessionId: string, day: DayOfWeek, reason: SkipReason): void {
    this.store.skipExerciseFor(sessionId, day, reason);
    this.skipFor.set(null);
  }

  intensity(value: string): string {
    if (value === 'full') return 'Sesión completa';
    if (value === 'light') return 'Recuperación';
    return 'Entrenamiento';
  }
}
