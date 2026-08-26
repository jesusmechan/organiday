import { Injectable, signal } from '@angular/core';
import { TimeBlock } from '../models/planner.models';
import { toMinutes } from '../utils/time';

const KEY = 'mpp.reminders';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  readonly enabled = signal(localStorage.getItem(KEY) === '1');
  private timers: number[] = [];

  async toggle(on: boolean, blocks: TimeBlock[] = []): Promise<void> {
    if (!on) {
      this.enabled.set(false);
      localStorage.setItem(KEY, '0');
      this.clear();
      return;
    }
    if (!('Notification' in window)) return;
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return;
    this.enabled.set(true);
    localStorage.setItem(KEY, '1');
    this.schedule(blocks);
  }

  schedule(blocks: TimeBlock[]): void {
    this.clear();
    if (!this.enabled() || Notification.permission !== 'granted') return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const block of blocks) {
      if (block.category === 'sleep') continue;
      const fire = toMinutes(block.start) - 10;
      const delay = (fire - nowMin) * 60_000;
      if (delay < 5_000) continue;
      const id = window.setTimeout(() => {
        new Notification(block.title, {
          body: `Empieza a las ${block.start}`,
          tag: block.id
        });
      }, delay);
      this.timers.push(id);
    }
  }

  private clear(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
  }
}
