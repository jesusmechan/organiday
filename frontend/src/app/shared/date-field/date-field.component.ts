import { Component, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-date-field',
  templateUrl: './date-field.component.html',
  styleUrl: './date-field.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: DateFieldComponent,
      multi: true
    }
  ]
})
export class DateFieldComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly required = input(false);

  value = '';
  disabled = false;

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  get display(): string {
    if (!this.value) return '';
    const [year, month, day] = this.value.split('-');
    if (!year || !month || !day) return this.value;
    return `${day}/${month}/${year}`;
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
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

  setValue(value: string): void {
    this.value = value;
    this.onChange(value);
    this.onTouched();
  }
}
