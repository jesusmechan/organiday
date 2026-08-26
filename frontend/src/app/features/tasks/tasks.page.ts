import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DisableAutocompleteDirective } from '../../core/directives/disable-autocomplete.directive';
import { DateFieldComponent } from '../../shared/date-field/date-field.component';
import { PlannerStore } from '../../core/services/planner.store';
import { DAY_LABELS, MODALITY_LABELS, PRIORITY_LABELS, TOPIC_LABELS } from '../../core/utils/time';
import { Priority, TopicKind } from '../../core/models/planner.models';

@Component({
  selector: 'app-tasks-page',
  imports: [FormsModule, RouterLink, DisableAutocompleteDirective, DateFieldComponent],
  templateUrl: './tasks.page.html',
  styleUrl: './tasks.page.scss'
})
export class TasksPage {
  private readonly store = inject(PlannerStore);

  readonly term = this.store.viewedTerm;
  readonly tasks = computed(() => this.store.termState().tasks);
  readonly courses = computed(() => this.store.termState().courses);
  readonly suggestions = this.store.suggestions;
  readonly labels = PRIORITY_LABELS;
  readonly topicLabels = TOPIC_LABELS;
  readonly days = DAY_LABELS;
  readonly modality = MODALITY_LABELS;
  readonly showForm = signal(false);
  readonly showTopic = signal(false);
  readonly topics = computed(() => this.store.termState().topics);

  title = '';
  courseId = '';
  priority: Priority = 'medium';
  deadline = '';
  estimatedHours = 2;
  topicTitle = '';
  topicCourseId = '';
  topicKind: TopicKind = 'exam';
  topicDue = '';

  add(): void {
    if (!this.title.trim()) return;
    this.store.addTask({
      title: this.title.trim(),
      courseId: this.courseId || undefined,
      priority: this.priority,
      deadline: this.deadline || undefined,
      estimatedMinutes: Math.round(this.estimatedHours * 60)
    });
    this.title = '';
    this.courseId = '';
    this.priority = 'medium';
    this.deadline = '';
    this.estimatedHours = 2;
    this.showForm.set(false);
  }

  toggle(id: string): void {
    this.store.toggleTask(id);
  }

  log(id: string, minutes: number): void {
    this.store.logStudy(id, minutes);
  }

  remove(id: string): void {
    this.store.deleteTask(id);
  }

  accept(taskId: string, dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6, start: string, end: string, taskTitle: string): void {
    this.store.acceptSuggestion({ taskId, dayOfWeek, start, end, taskTitle });
  }

  progress(logged: number, estimated: number): number {
    if (!estimated) return 0;
    return Math.min(100, Math.round((logged / estimated) * 100));
  }

  courseName(id?: string): string {
    const course = this.courses().find(c => c.id === id);
    if (!course) return 'General';
    return `${course.shortName} · ${MODALITY_LABELS[course.modality]}`;
  }

  addTopic(): void {
    if (!this.topicTitle.trim() || !this.topicCourseId || !this.topicDue) return;
    this.store.addTopic({
      courseId: this.topicCourseId,
      title: this.topicTitle.trim(),
      kind: this.topicKind,
      dueDate: this.topicDue
    });
    this.topicTitle = '';
    this.topicDue = '';
    this.showTopic.set(false);
  }

  toggleTopic(id: string): void {
    const topic = this.topics().find(item => item.id === id);
    if (topic) this.store.toggleTopic(topic);
  }

  removeTopic(id: string): void {
    this.store.deleteTopic(id);
  }
}
