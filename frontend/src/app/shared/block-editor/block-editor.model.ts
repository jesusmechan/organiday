export interface BlockEditorSave {
  title: string;
  start: string;
  end: string;
  location: string;
  notes: string;
  scope: 'once' | 'always';
}
