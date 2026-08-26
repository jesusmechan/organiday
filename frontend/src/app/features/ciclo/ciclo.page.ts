import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DisableAutocompleteDirective } from '../../core/directives/disable-autocomplete.directive';
import { PlannerStore } from '../../core/services/planner.store';
import { ReminderService } from '../../core/services/reminder.service';
import { describeAllDeletion, describeTermDeletion } from '../../core/utils/impact';
import { downloadText } from '../../core/utils/export';
import { formatDateRange, isoDate, termStatus } from '../../core/utils/time';
import { Term } from '../../core/models/planner.models';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { DateFieldComponent } from '../../shared/date-field/date-field.component';

type ModalKind = 'delete-term' | 'delete-all' | null;

@Component({
  selector: 'app-ciclo-page',
  imports: [FormsModule, RouterLink, DisableAutocompleteDirective, ConfirmModalComponent, DateFieldComponent],
  templateUrl: './ciclo.page.html',
  styleUrl: './ciclo.page.scss'
})
export class CicloPage {
  private readonly store = inject(PlannerStore);
  private readonly router = inject(Router);
  private readonly reminders = inject(ReminderService);

  readonly terms = computed(() => this.store.state().terms);
  readonly viewed = this.store.viewedTerm;
  readonly live = this.store.liveTerm;
  readonly formatRange = formatDateRange;
  readonly busy = signal(false);
  readonly modal = signal<ModalKind>(null);
  readonly pendingTerm = signal<Term | null>(null);
  readonly remindersOn = this.reminders.enabled;
  readonly counts = computed(() => {
    const state = this.store.termState();
    return {
      blocks: state.blocks.length,
      courses: state.courses.length,
      tasks: state.tasks.filter(task => !task.completed).length
    };
  });

  readonly modalTitle = computed(() => {
    const kind = this.modal();
    if (kind === 'delete-term') return `¿Eliminar ${this.pendingTerm()?.name || 'este ciclo'}?`;
    if (kind === 'delete-all') return '¿Eliminar todo el horario?';
    return '';
  });

  readonly modalMessage = computed(() => {
    const kind = this.modal();
    if (kind === 'delete-term') return 'Esta acción no se puede deshacer.';
    if (kind === 'delete-all') return 'Se vacía el planificador por completo. Esta acción no se puede deshacer.';
    return '';
  });

  readonly modalItems = computed(() => {
    const state = this.store.state();
    const kind = this.modal();
    if (kind === 'delete-term' && this.pendingTerm()) {
      return describeTermDeletion(state, this.pendingTerm()!.id);
    }
    if (kind === 'delete-all') return describeAllDeletion(state);
    return [];
  });

  readonly modalConfirm = computed(() => {
    const kind = this.modal();
    if (kind === 'delete-term') return 'Eliminar ciclo';
    if (kind === 'delete-all') return 'Eliminar todo';
    return 'Continuar';
  });

  editName = '';
  editStart = '';
  editEnd = '';

  constructor() {
    effect(() => this.syncEdit(this.viewed()));
  }

  statusLabel(term: Term): string {
    const status = termStatus(term.startDate, term.endDate);
    if (status === 'current') return 'Vigente';
    if (status === 'upcoming') return 'Próximo';
    return 'Cerrado';
  }

  statusKind(term: Term): 'current' | 'upcoming' | 'past' {
    return termStatus(term.startDate, term.endDate);
  }

  prettyDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  progressOf(term: Term): number {
    const today = isoDate();
    if (today <= term.startDate) return 0;
    if (today >= term.endDate) return 100;
    const total = this.diffDays(term.startDate, term.endDate);
    const done = this.diffDays(term.startDate, today);
    return Math.round((done / Math.max(total, 1)) * 100);
  }

  remainingLabel(term: Term): string {
    const today = isoDate();
    const status = termStatus(term.startDate, term.endDate, today);
    if (status === 'upcoming') {
      const days = this.diffDays(today, term.startDate);
      return days === 1 ? 'Empieza mañana' : `Empieza en ${days} días`;
    }
    if (status === 'past') return 'Este ciclo ya cerró';
    const left = this.diffDays(today, term.endDate);
    if (left === 0) return 'Último día';
    return left === 1 ? 'Queda 1 día' : `Quedan ${left} días`;
  }

  select(id: string): void {
    void this.store.selectTerm(id);
  }

  saveDates(): void {
    const term = this.viewed();
    if (!term || !this.editName.trim() || !this.editStart || !this.editEnd) return;
    void this.store.updateTerm(term.id, {
      name: this.editName.trim(),
      startDate: this.editStart,
      endDate: this.editEnd
    });
  }

  askUpdate(): void {
    if (!this.viewed()) return;
    void this.router.navigate(['/nuevo-horario'], { queryParams: { modo: 'reemplazar' } });
  }

  copyCycle(): void {
    if (!this.viewed()) return;
    void this.router.navigate(['/nuevo-horario'], { queryParams: { copiar: '1' } });
  }

  exportBackup(): void {
    downloadText(`organi-day-${isoDate()}.json`, JSON.stringify(this.store.state(), null, 2), 'application/json');
  }

  importBackup(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        void this.store.importBackup(raw);
      } catch {
        alert('El archivo no es un respaldo válido.');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  toggleReminders(): void {
    void this.reminders.toggle(!this.reminders.enabled(), this.store.todayBlocks());
  }

  askRemove(term: Term): void {
    this.pendingTerm.set(term);
    this.modal.set('delete-term');
  }

  askClearAll(): void {
    this.modal.set('delete-all');
  }

  closeModal(): void {
    if (this.busy()) return;
    this.modal.set(null);
    this.pendingTerm.set(null);
  }

  async confirmModal(): Promise<void> {
    const kind = this.modal();
    this.busy.set(true);
    try {
      if (kind === 'delete-term' && this.pendingTerm()) {
        await this.store.deleteTerm(this.pendingTerm()!.id);
      }
      if (kind === 'delete-all') {
        await this.store.reset();
      }
      this.modal.set(null);
      this.pendingTerm.set(null);
    } catch {
      alert('No se pudo completar la acción. Revisa que el servidor esté encendido.');
    } finally {
      this.busy.set(false);
    }
  }

  private diffDays(from: string, to: string): number {
    const start = Date.parse(`${from}T00:00:00`);
    const end = Date.parse(`${to}T00:00:00`);
    return Math.max(0, Math.round((end - start) / 86_400_000));
  }

  private syncEdit(term: Term | null): void {
    this.editName = term?.name ?? '';
    this.editStart = term?.startDate ?? '';
    this.editEnd = term?.endDate ?? '';
  }
}
