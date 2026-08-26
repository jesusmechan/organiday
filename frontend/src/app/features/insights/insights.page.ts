import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlannerStore } from '../../core/services/planner.store';
import { DAY_LABELS, dateForWeekDay, formatHours, isoDate, WEEK_ORDER } from '../../core/utils/time';

@Component({
  selector: 'app-insights-page',
  imports: [RouterLink],
  templateUrl: './insights.page.html',
  styleUrl: './insights.page.scss'
})
export class InsightsPage {
  private readonly store = inject(PlannerStore);

  readonly term = this.store.viewedTerm;
  readonly summary = this.store.summary;
  readonly suggestions = this.store.suggestions;
  readonly days = DAY_LABELS;
  readonly formatHours = formatHours;
  readonly weekChecks = computed(() =>
    WEEK_ORDER.map(day => ({
      day,
      ...this.store.progressFor(day, isoDate(dateForWeekDay(day)))
    }))
  );
  readonly weekTotal = computed(() => {
    const rows = this.weekChecks();
    const done = rows.reduce((sum, r) => sum + r.done, 0);
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  });

  accept(taskId: string, dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6, start: string, end: string, taskTitle: string): void {
    this.store.acceptSuggestion({ taskId, dayOfWeek, start, end, taskTitle });
  }

  reset(): void {
    if (confirm('Esto borra ciclos, horarios, tareas y registros. La app queda vacía.')) {
      this.store.reset();
    }
  }
}
