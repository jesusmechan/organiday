import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlannerStore } from './core/services/planner.store';
import { AuthService } from './core/services/auth.service';
import { ReminderService } from './core/services/reminder.service';
import { formatDateRange } from './core/utils/time';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly store = inject(PlannerStore);
  private readonly reminders = inject(ReminderService);
  readonly auth = inject(AuthService);
  readonly term = this.store.viewedTerm;
  readonly offline = this.store.offline;
  readonly formatRange = formatDateRange;
  deferredPrompt = signal<{ prompt: () => Promise<void> } | null>(null);
  showInstall = signal(false);

  constructor() {
    effect(() => {
      const blocks = this.store.todayBlocks();
      this.reminders.schedule(blocks);
    });
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstall(event: Event): void {
    event.preventDefault();
    this.deferredPrompt.set(event as unknown as { prompt: () => Promise<void> });
    this.showInstall.set(true);
  }

  async install(): Promise<void> {
    const promptEvent = this.deferredPrompt();
    if (!promptEvent) return;
    await promptEvent.prompt();
    this.showInstall.set(false);
    this.deferredPrompt.set(null);
  }

  dismissInstall(): void {
    this.showInstall.set(false);
  }

  retry(): void {
    void this.store.refresh();
  }

  logout(): void {
    this.auth.logout();
  }
}
