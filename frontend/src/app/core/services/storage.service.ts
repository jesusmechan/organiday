import { Injectable } from '@angular/core';
import { PlannerState } from '../models/planner.models';
import { createEmptyState } from '../data/seed';

const STORAGE_KEY = 'mpp.planner.v3';

@Injectable({ providedIn: 'root' })
export class StorageService {
  load(): PlannerState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const empty = createEmptyState();
        this.save(empty);
        return empty;
      }
      const parsed = JSON.parse(raw) as PlannerState;
      if (!parsed.version || !Array.isArray(parsed.blocks) || !Array.isArray(parsed.terms)) {
        const empty = createEmptyState();
        this.save(empty);
        return empty;
      }
      return {
        ...createEmptyState(),
        ...parsed,
        version: 3,
        terms: parsed.terms ?? [],
        selectedTermId: parsed.selectedTermId ?? '',
        blocks: parsed.blocks ?? [],
        courses: this.migrateCourses(parsed.courses ?? []),
        tasks: parsed.tasks ?? [],
        studyLogs: parsed.studyLogs ?? [],
        exerciseSessions: parsed.exerciseSessions ?? [],
        exerciseLogs: parsed.exerciseLogs ?? [],
        routines: parsed.routines ?? [],
        blockChecks: parsed.blockChecks ?? []
      };
    } catch {
      const empty = createEmptyState();
      this.save(empty);
      return empty;
    }
  }

  save(state: PlannerState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  reset(): PlannerState {
    const empty = createEmptyState();
    this.save(empty);
    return empty;
  }

  private migrateCourses<T extends { modality?: string }>(courses: T[]): T[] {
    return courses.map(course => ({
      ...course,
      modality: course.modality === 'virtual' ? 'virtual-247' : course.modality
    }));
  }
}
