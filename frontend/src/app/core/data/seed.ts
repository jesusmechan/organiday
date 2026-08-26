import { PlannerState } from '../models/planner.models';

export function createEmptyState(): PlannerState {
  return {
    version: 4,
    terms: [],
    selectedTermId: '',
    blocks: [],
    courses: [],
    tasks: [],
    studyLogs: [],
    exerciseSessions: [],
    exerciseLogs: [],
    routines: [],
    blockChecks: [],
    exceptions: [],
    topics: [],
    blockSkips: []
  };
}
