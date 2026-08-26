import { Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.scss'
})
export class ConfirmModalComponent {
  readonly kicker = input('Confirmar');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly items = input<string[]>([]);
  readonly confirmLabel = input('Continuar');
  readonly danger = input(false);
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.busy()) this.cancelled.emit();
  }
}
