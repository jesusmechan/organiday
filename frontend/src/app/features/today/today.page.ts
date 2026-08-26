import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlannerStore } from '../../core/services/planner.store';
import {
  blockKindLabel,
  CATEGORY_LABELS,
  DAY_LABELS,
  EXCEPTION_LABELS,
  formatDateRange,
  formatLongDate,
  isoDate,
  SKIP_REASONS,
  toMinutes,
  TOPIC_LABELS,
  todayDayOfWeek
} from '../../core/utils/time';
import { SkipReason, TimeBlock } from '../../core/models/planner.models';
import { BlockEditorComponent } from '../../shared/block-editor/block-editor.component';
import { BlockEditorSave } from '../../shared/block-editor/block-editor.model';

@Component({
  selector: 'app-today-page',
  imports: [RouterLink, BlockEditorComponent],
  templateUrl: './today.page.html',
  styleUrl: './today.page.scss'
})
export class TodayPage {
  private readonly store = inject(PlannerStore);

  readonly now = new Date();
  readonly day = this.store.today;
  readonly date = isoDate();
  readonly blocks = this.store.todayBlocks;
  readonly current = computed(() => this.store.currentBlock());
  readonly next = computed(() => this.store.nextBlock());
  readonly gap = computed(() => {
    const nowMin = this.now.getHours() * 60 + this.now.getMinutes();
    return this.store.freeSlots(this.day()).find(slot => toMinutes(slot.end) > nowMin) ?? null;
  });
  readonly load = computed(() => this.store.dayLoad(this.day()));
  readonly routine = computed(() => this.store.termState().routines.find(r => r.dayOfWeek === this.day()));
  readonly term = this.store.viewedTerm;
  readonly live = this.store.isViewingLiveTerm;
  readonly session = computed(() => this.store.todayExerciseSession());
  readonly exerciseLog = computed(() => this.store.todayExerciseLog());
  readonly progress = this.store.todayProgress;
  readonly exception = computed(() => this.store.exceptionOn(this.date));
  readonly due = computed(() => this.store.deadlinesOn(this.date));
  readonly showReasons = signal(false);
  readonly reasons = SKIP_REASONS;
  readonly labels = CATEGORY_LABELS;
  readonly kinds = EXCEPTION_LABELS;
  readonly topicLabels = TOPIC_LABELS;
  readonly kind = blockKindLabel;
  readonly dayName = computed(() => DAY_LABELS[this.day()]);
  readonly longDate = formatLongDate(this.now);
  readonly formatRange = formatDateRange;
  readonly todaySuggestions = computed(() =>
    this.store.suggestions().filter(s => s.dayOfWeek === this.day())
  );
  readonly editing = signal<TimeBlock | null>(null);

  loadLabel(): string {
    const load = this.load();
    if (load === 'heavy') return 'Día sobrecargado';
    if (load === 'balanced') return 'Día equilibrado';
    return 'Día ligero';
  }

  done(block: TimeBlock): boolean {
    return this.store.isChecked(block.id);
  }

  canCheck(block: TimeBlock): boolean {
    return this.done(block) || this.store.canCheck(block, this.date);
  }

  canLogExercise(): boolean {
    const session = this.session();
    return !!session && this.store.canLogAt(session.start, this.date);
  }

  toggle(block: TimeBlock): void {
    if (!this.canCheck(block)) return;
    this.store.toggleBlock(block);
  }

  completeExercise(): void {
    if (!this.canLogExercise()) return;
    this.store.completeExercise();
    this.showReasons.set(false);
  }

  skipExercise(reason: SkipReason): void {
    this.store.skipExercise(reason);
    this.showReasons.set(false);
  }

  edit(block: TimeBlock): void {
    this.editing.set(block);
  }

  closeEditor(): void {
    this.editing.set(null);
  }

  async saveEditor(payload: BlockEditorSave): Promise<void> {
    const block = this.editing();
    if (!block) return;
    const day = todayDayOfWeek();
    if (payload.scope === 'always' || block.date) {
      await this.store.updateBlock(block, {
        title: payload.title,
        start: payload.start,
        end: payload.end,
        location: payload.location || undefined,
        notes: payload.notes || undefined
      });
    } else {
      await this.store.skipBlockToday(block, this.date);
      await this.store.addOneOff({
        title: payload.title,
        category: block.category,
        dayOfWeek: day,
        start: payload.start,
        end: payload.end,
        date: this.date,
        location: payload.location,
        notes: payload.notes
      });
    }
    this.closeEditor();
  }

  async skipToday(): Promise<void> {
    const block = this.editing();
    if (block) await this.store.skipBlockToday(block, this.date);
    this.closeEditor();
  }

  async removeBlock(): Promise<void> {
    const block = this.editing();
    if (block) await this.store.deleteBlock(block.id);
    this.closeEditor();
  }
}
