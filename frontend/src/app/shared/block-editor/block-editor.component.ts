import { Component, HostListener, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeBlock } from '../../core/models/planner.models';
import { DisableAutocompleteDirective } from '../../core/directives/disable-autocomplete.directive';
import { BlockEditorSave } from './block-editor.model';

@Component({
  selector: 'app-block-editor',
  imports: [FormsModule, DisableAutocompleteDirective],
  templateUrl: './block-editor.component.html',
  styleUrl: './block-editor.component.scss'
})
export class BlockEditorComponent implements OnInit {
  readonly block = input<TimeBlock | null>(null);
  readonly creating = input(false);
  readonly dateLabel = input('');
  readonly saved = output<BlockEditorSave>();
  readonly skipped = output<void>();
  readonly deleted = output<void>();
  readonly cancelled = output<void>();

  title = '';
  start = '18:00';
  end = '19:00';
  location = '';
  notes = '';
  scope: 'once' | 'always' = 'once';
  readonly ready = signal(false);

  ngOnInit(): void {
    this.hydrate();
  }

  hydrate(): void {
    const block = this.block();
    if (block) {
      this.title = block.title;
      this.start = block.start;
      this.end = block.end;
      this.location = block.location ?? '';
      this.notes = block.notes ?? '';
      this.scope = block.date || !block.recurring ? 'once' : 'always';
    }
    this.ready.set(true);
  }

  save(): void {
    if (!this.title.trim() || !this.start || !this.end) return;
    this.saved.emit({
      title: this.title.trim(),
      start: this.start,
      end: this.end,
      location: this.location.trim(),
      notes: this.notes.trim(),
      scope: this.scope
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancelled.emit();
  }
}
