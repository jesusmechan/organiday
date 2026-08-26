import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

@Directive({
  selector: 'input:not(.autofill-bait):not(.allow-autofill), textarea, select',
  host: {
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'none',
    spellcheck: 'false',
    '(pointerdown)': 'unlock()',
    '(focus)': 'unlock()'
  }
})
export class DisableAutocompleteDirective {
  private readonly el = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>(ElementRef);

  constructor() {
    afterNextRender(() => this.lock());
  }

  unlock(): void {
    this.el.nativeElement.removeAttribute('readonly');
  }

  private lock(): void {
    const node = this.el.nativeElement;
    const name = node.getAttribute('name') || node.tagName.toLowerCase();
    node.setAttribute('autocomplete', `off-${name}`);
    node.setAttribute('autocorrect', 'off');
    node.setAttribute('autocapitalize', 'none');
    node.setAttribute('spellcheck', 'false');

    if (!(node instanceof HTMLInputElement)) return;
    if (node.type === 'checkbox' || node.type === 'radio' || node.type === 'hidden') return;
    node.setAttribute('readonly', 'readonly');
  }
}
