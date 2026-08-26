import { PlannerState } from '../models/planner.models';

function line(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function describeTermDeletion(state: PlannerState, termId: string): string[] {
  const blocks = state.blocks.filter(b => b.termId === termId);
  const courses = state.courses.filter(c => c.termId === termId);
  const tasks = state.tasks.filter(t => t.termId === termId);
  const exercises = state.exerciseSessions.filter(s => s.termId === termId);
  const blockIds = new Set(blocks.map(b => b.id));
  const checks = state.blockChecks.filter(c => blockIds.has(c.blockId)).length;
  return [
    'El ciclo y sus fechas',
    line(courses.length, 'curso', 'cursos'),
    line(blocks.length, 'bloque del horario', 'bloques del horario'),
    line(tasks.length, 'tarea', 'tareas'),
    line(exercises.length, 'sesión de ejercicio', 'sesiones de ejercicio'),
    line(checks, 'marca del checklist', 'marcas del checklist')
  ];
}

export function describeReplace(state: PlannerState, termId: string, termName: string): string[] {
  const blocks = state.blocks.filter(b => b.termId === termId);
  const courses = state.courses.filter(c => c.termId === termId);
  const tasks = state.tasks.filter(t => t.termId === termId);
  const exercises = state.exerciseSessions.filter(s => s.termId === termId);
  const routines = state.routines.filter(r => r.termId === termId);
  return [
    `El horario actual de ${termName}`,
    line(courses.length, 'curso', 'cursos'),
    line(blocks.length, 'bloque', 'bloques'),
    line(tasks.length, 'tarea', 'tareas'),
    line(exercises.length, 'sesión de ejercicio', 'sesiones de ejercicio'),
    line(routines.length, 'rutina diaria', 'rutinas diarias')
  ];
}

export function describeAllDeletion(state: PlannerState): string[] {
  return [
    line(state.terms.length, 'ciclo', 'ciclos'),
    line(state.courses.length, 'curso', 'cursos'),
    line(state.blocks.length, 'bloque del horario', 'bloques del horario'),
    line(state.tasks.length, 'tarea', 'tareas'),
    line(state.exerciseSessions.length, 'sesión de ejercicio', 'sesiones de ejercicio'),
    line(state.blockChecks.length, 'marca del checklist', 'marcas del checklist')
  ];
}
