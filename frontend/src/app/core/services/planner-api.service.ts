import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  BlockCheck,
  BlockSkip,
  CourseTopic,
  DayException,
  ExerciseLog,
  PlannerState,
  Task,
  Term,
  TimeBlock
} from '../models/planner.models';
import { createEmptyState } from '../data/seed';
import { ScheduleDraft } from './schedule.generator';
import { API_BASE_URL } from './api.config';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string };
}

@Injectable({ providedIn: 'root' })
export class PlannerApiService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_URL;

  getPlanner(): Promise<PlannerState> {
    return this.get<PlannerState>('/planner');
  }

  generate(draft: ScheduleDraft, replaceTermId?: string): Promise<PlannerState> {
    return this.post<PlannerState>('/planner/generate', {
      ...draft,
      replaceTermId: draft.mode === 'replace' ? replaceTermId : undefined
    });
  }

  reset(): Promise<PlannerState> {
    return this.delete<PlannerState>('/planner');
  }

  selectTerm(id: string): Promise<Term> {
    return this.post<Term>(`/terms/${id}/select`, {});
  }

  updateTerm(id: string, payload: Pick<Term, 'name' | 'startDate' | 'endDate' | 'protectedDays'>): Promise<Term> {
    return this.put<Term>(`/terms/${id}`, payload);
  }

  deleteTerm(id: string): Promise<void> {
    return this.delete<void>(`/terms/${id}`);
  }

  addTask(payload: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    return this.post<Task>('/tasks', payload);
  }

  updateTask(task: Task): Promise<Task> {
    const { id, createdAt, ...payload } = task;
    return this.put<Task>(`/tasks/${id}`, payload);
  }

  deleteTask(id: string): Promise<void> {
    return this.delete<void>(`/tasks/${id}`);
  }

  addStudyLog(payload: { taskId?: string; courseId?: string; date: string; minutes: number }): Promise<unknown> {
    return this.post('/study-logs', payload);
  }

  addBlock(payload: Omit<TimeBlock, 'id'>): Promise<TimeBlock> {
    return this.post<TimeBlock>('/blocks', payload);
  }

  updateBlock(id: string, payload: Omit<TimeBlock, 'id'>): Promise<TimeBlock> {
    return this.put<TimeBlock>(`/blocks/${id}`, payload);
  }

  deleteBlock(id: string): Promise<void> {
    return this.delete<void>(`/blocks/${id}`);
  }

  addException(payload: Omit<DayException, 'id'>): Promise<DayException> {
    return this.post<DayException>('/exceptions', payload);
  }

  deleteException(id: string): Promise<void> {
    return this.delete<void>(`/exceptions/${id}`);
  }

  addTopic(payload: Omit<CourseTopic, 'id'>): Promise<CourseTopic> {
    return this.post<CourseTopic>('/topics', payload);
  }

  updateTopic(topic: CourseTopic): Promise<CourseTopic> {
    const { id, ...payload } = topic;
    return this.put<CourseTopic>(`/topics/${id}`, payload);
  }

  deleteTopic(id: string): Promise<void> {
    return this.delete<void>(`/topics/${id}`);
  }

  addSkip(payload: Omit<BlockSkip, 'id'>): Promise<BlockSkip> {
    return this.post<BlockSkip>('/skips', payload);
  }

  deleteSkip(id: string): Promise<void> {
    return this.delete<void>(`/skips/${id}`);
  }

  importPlanner(state: PlannerState): Promise<PlannerState> {
    return this.post<PlannerState>('/planner/import', state);
  }

  register(name: string, email: string, password: string): Promise<AuthSession> {
    return this.post('/auth/register', { name, email, password });
  }

  login(email: string, password: string): Promise<AuthSession> {
    return this.post('/auth/login', { email, password });
  }

  refresh(refreshToken: string): Promise<AuthSession> {
    return this.post('/auth/refresh', { refreshToken });
  }

  logout(refreshToken: string): Promise<{ ok: boolean }> {
    return this.post('/auth/logout', { refreshToken });
  }

  me(): Promise<{ id: string; name: string; email: string }> {
    return this.get('/auth/me');
  }

  addCheck(payload: Omit<BlockCheck, 'id'>): Promise<BlockCheck> {
    return this.post<BlockCheck>('/checks', payload);
  }

  deleteCheck(id: string): Promise<void> {
    return this.delete<void>(`/checks/${id}`);
  }

  upsertExerciseLog(payload: Omit<ExerciseLog, 'id'>): Promise<ExerciseLog> {
    return this.post<ExerciseLog>('/exercise-logs', payload);
  }

  deleteExerciseLog(id: string): Promise<void> {
    return this.delete<void>(`/exercise-logs/${id}`);
  }

  normalize(raw: PlannerState | null | undefined): PlannerState {
    const empty = createEmptyState();
    if (!raw) return empty;
    return {
      ...empty,
      ...raw,
      version: raw.version ?? 4,
      terms: raw.terms ?? [],
      selectedTermId: raw.selectedTermId ?? '',
      blocks: raw.blocks ?? [],
      courses: raw.courses ?? [],
      tasks: raw.tasks ?? [],
      studyLogs: raw.studyLogs ?? [],
      exerciseSessions: raw.exerciseSessions ?? [],
      exerciseLogs: raw.exerciseLogs ?? [],
      routines: raw.routines ?? [],
      blockChecks: raw.blockChecks ?? [],
      exceptions: raw.exceptions ?? [],
      topics: raw.topics ?? [],
      blockSkips: raw.blockSkips ?? []
    };
  }

  private get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.base}${path}`));
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.base}${path}`, body));
  }

  private put<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.base}${path}`, body));
  }

  private delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.base}${path}`));
  }
}
