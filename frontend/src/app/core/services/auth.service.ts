import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession, PlannerApiService } from './planner-api.service';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

const KEY = 'organi.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(PlannerApiService);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly refreshToken = signal<string | null>(null);
  readonly user = signal<AuthUser | null>(null);
  readonly isLoggedIn = computed(() => Boolean(this.refreshToken() && this.user()));

  private refreshInFlight: Promise<void> | null = null;

  constructor() {
    const saved = this.read();
    if (saved) {
      this.token.set(saved.accessToken);
      this.refreshToken.set(saved.refreshToken);
      this.user.set(saved.user);
      void this.hydrate();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => this.onStorage(event));
    }
  }

  async login(email: string, password: string): Promise<void> {
    this.apply(await this.api.login(email, password));
  }

  async register(name: string, email: string, password: string): Promise<void> {
    this.apply(await this.api.register(name, email, password));
  }

  async refreshSession(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.doRefresh().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  logout(): void {
    const refresh = this.refreshToken();
    this.clearSession();
    void this.router.navigateByUrl('/entrar');
    if (refresh) {
      void this.api.logout(refresh).catch(() => undefined);
    }
  }

  clearSession(): void {
    this.token.set(null);
    this.refreshToken.set(null);
    this.user.set(null);
    localStorage.removeItem(KEY);
  }

  private async doRefresh(): Promise<void> {
    const refresh = this.refreshToken();
    if (!refresh) {
      this.logout();
      throw new Error('Sesión vencida.');
    }
    try {
      this.apply(await this.api.refresh(refresh));
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  private async hydrate(): Promise<void> {
    try {
      const user = await this.api.me();
      this.user.set(user);
      this.persist();
    } catch {
      // Si /me falla (Render dormido, red, 502), no borres la sesión local.
      // Un 401 real ya lo resuelve el interceptor (refresh o logout).
    }
  }

  private apply(payload: AuthSession | Record<string, unknown>): void {
    const session = this.normalize(payload);
    if (!session) {
      throw new Error('La sesión no se pudo guardar.');
    }
    this.token.set(session.accessToken);
    this.refreshToken.set(session.refreshToken);
    this.user.set(session.user);
    this.persist();
  }

  private persist(): void {
    const accessToken = this.token();
    const refreshToken = this.refreshToken();
    const user = this.user();
    if (!accessToken || !refreshToken || !user) return;
    localStorage.setItem(KEY, JSON.stringify({ accessToken, refreshToken, user }));
  }

  private read(): AuthSession | null {
    try {
      return this.parse(localStorage.getItem(KEY));
    } catch {
      return null;
    }
  }

  private parse(raw: string | null): AuthSession | null {
    if (!raw) return null;
    try {
      return this.normalize(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  private normalize(raw: unknown): AuthSession | null {
    if (!raw || typeof raw !== 'object') return null;
    const data = raw as Record<string, unknown>;
    const accessToken = String(data['accessToken'] ?? data['access_token'] ?? '');
    const refreshToken = String(data['refreshToken'] ?? data['refresh_token'] ?? '');
    const user = data['user'] as AuthUser | undefined;
    if (!accessToken || !refreshToken || !user?.id) return null;
    return { accessToken, refreshToken, user };
  }

  private onStorage(event: StorageEvent): void {
    if (event.key !== KEY) return;
    if (!event.newValue) {
      if (!this.refreshToken()) return;
      this.token.set(null);
      this.refreshToken.set(null);
      this.user.set(null);
      void this.router.navigateByUrl('/entrar');
      return;
    }
    const parsed = this.parse(event.newValue);
    if (!parsed) return;
    this.token.set(parsed.accessToken);
    this.refreshToken.set(parsed.refreshToken);
    this.user.set(parsed.user);
  }
}
