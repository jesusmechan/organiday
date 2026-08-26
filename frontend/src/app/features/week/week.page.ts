import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlannerStore } from '../../core/services/planner.store';
import { DayOfWeek, ExceptionKind, TimeBlock } from '../../core/models/planner.models';
import { BlockEditorComponent } from '../../shared/block-editor/block-editor.component';
import { BlockEditorSave } from '../../shared/block-editor/block-editor.model';
import { DisableAutocompleteDirective } from '../../core/directives/disable-autocomplete.directive';
import { downloadText, weekToIcs } from '../../core/utils/export';
import {
  addMonths,
  blockKindLabel,
  CATEGORY_LABELS,
  DAY_SHORT,
  dateForWeekDay,
  dateInRange,
  durationMinutes,
  EXCEPTION_LABELS,
  formatLongDate,
  formatMonthYear,
  hoursFromMinutes,
  isoDate,
  monthGrid,
  parseIsoDate,
  startOfWeek,
  TOPIC_LABELS,
  WEEK_ORDER
} from '../../core/utils/time';

@Component({
  selector: 'app-week-page',
  imports: [RouterLink, FormsModule, BlockEditorComponent, DisableAutocompleteDirective],
  templateUrl: './week.page.html',
  styleUrl: './week.page.scss'
})
export class WeekPage {
  private readonly store = inject(PlannerStore);

  readonly term = this.store.viewedTerm;
  readonly days = WEEK_ORDER;
  readonly short = DAY_SHORT;
  readonly labels = CATEGORY_LABELS;
  readonly kinds = EXCEPTION_LABELS;
  readonly topicLabels = TOPIC_LABELS;
  readonly kind = blockKindLabel;
  readonly today = isoDate();
  readonly selectedDate = signal(isoDate());
  readonly monthCursor = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly selected = computed(() => parseIsoDate(this.selectedDate()).getDay() as DayOfWeek);
  readonly weekStart = computed(() => startOfWeek(parseIsoDate(this.selectedDate())));
  readonly monthLabel = computed(() => formatMonthYear(this.monthCursor()));
  readonly cells = computed(() => {
    const cursor = this.monthCursor();
    return monthGrid(cursor.getFullYear(), cursor.getMonth());
  });
  readonly longDate = computed(() => formatLongDate(parseIsoDate(this.selectedDate())));
  readonly blocks = computed(() => this.store.blocksFor(this.selected(), this.selectedDate()));
  readonly routine = computed(() => this.store.termState().routines.find(r => r.dayOfWeek === this.selected()));
  readonly load = computed(() => this.store.dayLoad(this.selected(), this.selectedDate()));
  readonly free = computed(() => this.store.freeSlots(this.selected(), this.selectedDate()));
  readonly progress = computed(() => this.store.progressFor(this.selected(), this.selectedDate()));
  readonly exception = computed(() => this.store.exceptionOn(this.selectedDate()));
  readonly due = computed(() => this.store.deadlinesOn(this.selectedDate()));
  readonly editing = signal<TimeBlock | null>(null);
  readonly creating = signal(false);
  readonly showException = signal(false);

  exKind: ExceptionKind = 'holiday';
  exTitle = '';
  exStart = '';
  exEnd = '';

  dateOf(day: DayOfWeek): string {
    return isoDate(dateForWeekDay(day, this.weekStart()));
  }

  dateNum(day: DayOfWeek): number {
    return parseIsoDate(this.dateOf(day)).getDate();
  }

  hours(day: DayOfWeek, category: 'work' | 'university' | 'exercise'): number {
    const minutes = this.store
      .blocksFor(day, this.dateOf(day))
      .filter(b => b.category === category)
      .reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0);
    return hoursFromMinutes(minutes);
  }

  isHeavy(day: DayOfWeek): boolean {
    return this.store.dayLoad(day, this.dateOf(day)) === 'heavy';
  }

  select(day: DayOfWeek): void {
    this.selectDate(this.dateOf(day));
  }

  selectDate(date: string): void {
    this.selectedDate.set(date);
    const parsed = parseIsoDate(date);
    this.monthCursor.set(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    this.showException.set(false);
  }

  goToday(): void {
    this.selectDate(this.today);
  }

  shiftMonth(delta: number): void {
    this.monthCursor.update(current => addMonths(current, delta));
  }

  inTerm(date: string): boolean {
    const term = this.term();
    return !!term && dateInRange(date, term.startDate, term.endDate);
  }

  inWeek(date: string): boolean {
    const start = isoDate(this.weekStart());
    const end = this.dateOf(0);
    return date >= start && date <= end;
  }

  hasDue(date: string): boolean {
    const due = this.store.deadlinesOn(date);
    return due.tasks.length + due.topics.length > 0;
  }

  hasException(date: string): boolean {
    return !!this.store.exceptionOn(date);
  }

  dayProgress(day: DayOfWeek) {
    return this.store.progressFor(day, this.dateOf(day));
  }

  dueCount(day: DayOfWeek): number {
    const due = this.store.deadlinesOn(this.dateOf(day));
    return due.tasks.length + due.topics.length;
  }

  done(block: TimeBlock): boolean {
    return this.store.isChecked(block.id, this.selectedDate());
  }

  canCheck(block: TimeBlock): boolean {
    return this.done(block) || this.store.canCheck(block, this.selectedDate());
  }

  toggle(block: TimeBlock): void {
    if (!this.canCheck(block)) return;
    this.store.toggleBlock(block, this.selectedDate());
  }

  edit(block: TimeBlock): void {
    this.creating.set(false);
    this.editing.set(block);
  }

  startCreate(): void {
    this.creating.set(true);
    this.editing.set(null);
  }

  closeEditor(): void {
    this.editing.set(null);
    this.creating.set(false);
  }

  async saveEditor(payload: BlockEditorSave): Promise<void> {
    const date = this.selectedDate();
    const day = this.selected();
    const block = this.editing();
    if (this.creating() || !block) {
      await this.store.addOneOff({
        title: payload.title,
        category: 'personal',
        dayOfWeek: day,
        start: payload.start,
        end: payload.end,
        date,
        location: payload.location,
        notes: payload.notes
      });
    } else if (payload.scope === 'always' || block.date) {
      await this.store.updateBlock(block, {
        title: payload.title,
        start: payload.start,
        end: payload.end,
        location: payload.location || undefined,
        notes: payload.notes || undefined
      });
    } else {
      await this.store.skipBlockToday(block, date);
      await this.store.addOneOff({
        title: payload.title,
        category: block.category,
        dayOfWeek: day,
        start: payload.start,
        end: payload.end,
        date,
        location: payload.location,
        notes: payload.notes
      });
    }
    this.closeEditor();
  }

  async skipToday(): Promise<void> {
    const block = this.editing();
    if (block) await this.store.skipBlockToday(block, this.selectedDate());
    this.closeEditor();
  }

  async removeBlock(): Promise<void> {
    const block = this.editing();
    if (block) await this.store.deleteBlock(block.id);
    this.closeEditor();
  }

  async addException(): Promise<void> {
    if (!this.exTitle.trim()) return;
    await this.store.addException({
      date: this.selectedDate(),
      kind: this.exKind,
      title: this.exTitle.trim(),
      start: this.exStart || undefined,
      end: this.exEnd || undefined
    });
    this.exTitle = '';
    this.exStart = '';
    this.exEnd = '';
    this.showException.set(false);
  }

  removeException(): void {
    const item = this.exception();
    if (item) void this.store.deleteException(item.id);
  }

  exportWeek(): void {
    const start = this.weekStart();
    const blocks = WEEK_ORDER.flatMap(day => this.store.blocksFor(day, isoDate(dateForWeekDay(day, start))));
    downloadText(`semana-${isoDate(start)}.ics`, weekToIcs(blocks, start), 'text/calendar');
  }
}
