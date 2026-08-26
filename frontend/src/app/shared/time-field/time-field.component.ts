import { Component, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-time-field',
  templateUrl: './time-field.component.html',
  styleUrl: './time-field.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: TimeFieldComponent,
      multi: true
    }
  ]
})
export class TimeFieldComponent implements ControlValueAccessor {
  readonly label = input('');

  readonly hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  readonly minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  hour = '';
  minute = '';
  disabled = false;

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    const raw = (value ?? '').trim();
    if (!raw) {
      this.hour = '';
      this.minute = '';
      return;
    }
    const [h = '', m = ''] = raw.split(':');
    this.hour = h.padStart(2, '0').slice(0, 2);
    this.minute = m.padStart(2, '0').slice(0, 2);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  setHour(value: string): void {
    this.hour = value;
    this.emit();
  }

  setMinute(value: string): void {
    this.minute = value;
    this.emit();
  }

  private emit(): void {
    this.onTouched();
    if (!this.hour && !this.minute) {
      this.onChange('');
      return;
    }
    this.onChange(`${this.hour || '00'}:${this.minute || '00'}`);
  }
}
