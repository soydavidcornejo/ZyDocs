import type { DocumentNode } from '@/types/document';

export const initialDocumentsData: DocumentNode[] = [
  {
    id: 'org1',
    name: 'Zypher Corp',
    type: 'organization',
    parentId: null,
    children: [
      {
        id: 'space1-org1',
        name: 'Product Development',
        type: 'space',
        parentId: 'org1',
        children: [
          { 
            id: 'page1-space1', 
            name: 'Q4 Roadmap', 
            type: 'page', 
            parentId: 'space1-org1',
            content: '# Q4 Product Roadmap\n\n## Key Initiatives\n- Launch Project Phoenix\n- Improve user onboarding\n\n## Timeline\n- Oct: Design Phase\n- Nov: Development Sprint 1\n- Dec: Beta Release' 
          },
          { 
            id: 'page2-space1', 
            name: 'Feature Specs', 
            type: 'page', 
            parentId: 'space1-org1',
            content: '# Feature Specifications\n\nThis document outlines the specifications for upcoming features.\n\n- **User Authentication**: OAuth 2.0 integration.\n- **Real-time Collaboration**: Implement using WebSockets.' 
          },
        ],
      },
      {
        id: 'space2-org1',
        name: 'Marketing Department',
        type: 'space',
        parentId: 'org1',
        children: [
          { 
            id: 'page3-space2', 
            name: 'Campaign Plan', 
            type: 'page', 
            parentId: 'space2-org1',
            content: '# Marketing Campaign Plan - Holiday Season\n\nFocus on social media and email marketing.' 
          },
        ],
      },
    ],
  },
  {
    id: 'org2',
    name: 'Innovate Solutions Ltd.',
    type: 'organization',
    parentId: null,
    children: [
      {
        id: 'space3-org2',
        name: 'Client Projects',
        type: 'space',
        parentId: 'org2',
        children: [
          { 
            id: 'page4-space3', 
            name: 'Project Alpha Docs', 
            type: 'page', 
            parentId: 'space3-org2',
            content: '# Project Alpha Documentation\n\nClient: ACME Corp\n\n## Overview\nThis project involves building a new e-commerce platform.' 
          },
          { 
            id: 'page5-space3',
            name: 'Meeting Notes',
            type: 'page',
            parentId: 'space3-org2',
            content: '## Weekly Sync - 2023-10-26\n\n### Attendees\n- Jane Doe\n- John Smith\n\n### Action Items\n1. Follow up on designs.\n2. Schedule next meeting.',
            children: [
              {
                id: 'subpage1-page5',
                name: 'Archived Notes Q3',
                type: 'page',
                parentId: 'page5-space3',
                content: '### Meeting Notes - 2023-09-15\n\nArchived notes from Q3.'
              }
            ]
          }
        ],
      },
    ],
  },
];

export const findDocument = (nodes: DocumentNode[], id: string): DocumentNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const foundInChildren = findDocument(node.children, id);
      if (foundInChildren) {
        return foundInChildren;
      }
    }
  }
  return null;
};
