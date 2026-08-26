import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'hoy' },
  {
    path: 'entrar',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'hoy',
    canActivate: [authGuard],
    loadComponent: () => import('./features/today/today.page').then(m => m.TodayPage)
  },
  {
    path: 'semana',
    canActivate: [authGuard],
    loadComponent: () => import('./features/week/week.page').then(m => m.WeekPage)
  },
  {
    path: 'tareas',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tasks/tasks.page').then(m => m.TasksPage)
  },
  {
    path: 'ejercicio',
    canActivate: [authGuard],
    loadComponent: () => import('./features/exercise/exercise.page').then(m => m.ExercisePage)
  },
  {
    path: 'semana-analisis',
    canActivate: [authGuard],
    loadComponent: () => import('./features/insights/insights.page').then(m => m.InsightsPage)
  },
  {
    path: 'ciclo',
    canActivate: [authGuard],
    loadComponent: () => import('./features/ciclo/ciclo.page').then(m => m.CicloPage)
  },
  {
    path: 'nuevo-horario',
    canActivate: [authGuard],
    loadComponent: () => import('./features/schedule-builder/schedule-builder.page').then(m => m.ScheduleBuilderPage)
  },
  { path: '**', redirectTo: 'hoy' }
];
