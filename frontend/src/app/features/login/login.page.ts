import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DisableAutocompleteDirective } from '../../core/directives/disable-autocomplete.directive';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, DisableAutocompleteDirective],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<'login' | 'register'>('login');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);

  name = '';
  email = '';
  password = '';

  switchMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.error.set('');
    this.showPassword.set(false);
  }

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.email.trim() || !this.password) {
      this.error.set('Completa correo y contraseña.');
      return;
    }
    if (this.mode() === 'register' && !this.name.trim()) {
      this.error.set('Escribe tu nombre.');
      return;
    }
    this.busy.set(true);
    try {
      if (this.mode() === 'register') {
        await this.auth.register(this.name.trim(), this.email.trim(), this.password);
      } else {
        await this.auth.login(this.email.trim(), this.password);
      }
      await this.router.navigateByUrl('/hoy');
    } catch (error) {
      this.error.set(this.messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  private messageOf(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail = error.error?.detail;
      if (typeof detail === 'string') return detail;
    }
    return 'No se pudo entrar. Revisa el servidor y tus datos.';
  }
}
