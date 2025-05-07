export interface DocumentNode {
  id: string;
  name: string;
  type: 'organization' | 'space' | 'page';
  children?: DocumentNode[];
  content?: string; // Content for 'page' type
  parentId?: string | null; // To help reconstruct path or for breadcrumbs
}
