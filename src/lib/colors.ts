import type { Color } from './types.js';
import { getAllIssueLabels, getAllProjectLabels, getAllWorkflowStates, getAllProjectStatuses } from './linear-client.js';

/**
 * Curated Linear color palette
 * Based on Linear's standard design system colors
 */
export const CURATED_COLORS: Color[] = [
  // Primary colors
  { hex: '#5E6AD2', name: 'Purple' },
  { hex: '#26B5CE', name: 'Cyan' },
  { hex: '#4CB782', name: 'Green' },
  { hex: '#F2C94C', name: 'Yellow' },
  { hex: '#F2994A', name: 'Orange' },
  { hex: '#EB5757', name: 'Red' },
  { hex: '#BB6BD9', name: 'Pink' },
  { hex: '#56CCF2', name: 'Light Blue' },

  // Secondary colors
  { hex: '#95A2B3', name: 'Gray' },
  { hex: '#2D3648', name: 'Dark Gray' },
  { hex: '#1B1F2A', name: 'Almost Black' },
  { hex: '#E2E8F0', name: 'Light Gray' },
  { hex: '#F7FAFC', name: 'Almost White' },

  // Additional accent colors
  { hex: '#FF6B6B', name: 'Bright Red' },
  { hex: '#4ECDC4', name: 'Teal' },
  { hex: '#45B7D1', name: 'Sky Blue' },
  { hex: '#96CEB4', name: 'Mint' },
  { hex: '#FFEAA7', name: 'Light Yellow' },
  { hex: '#DFE6E9', name: 'Light Steel' },
  { hex: '#74B9FF', name: 'Periwinkle' },

  // Status colors (semantic)
  { hex: '#10B981', name: 'Success Green' },
  { hex: '#EF4444', name: 'Error Red' },
  { hex: '#F59E0B', name: 'Warning Orange' },
  { hex: '#3B82F6', name: 'Info Blue' },
];

/**
 * Search colors by hex code (supports partial matching)
 */
export function searchColors(hex: string): Color[] {
  const normalizedHex = hex.toLowerCase().replace('#', '');
  return CURATED_COLORS.filter(color =>
    color.hex.toLowerCase().replace('#', '').includes(normalizedHex)
  );
}

/**
 * Find exact color by hex code
 */
export function findColorByHex(hex: string): Color | undefined {
  const normalizedHex = hex.toLowerCase().startsWith('#') ? hex.toLowerCase() : `#${hex.toLowerCase()}`;
  return CURATED_COLORS.find(color => color.hex.toLowerCase() === normalizedHex);
}

/**
 * Find color by name
 */
export function findColorByName(name: string): Color | undefined {
  return CURATED_COLORS.find(color => color.name.toLowerCase() === name.toLowerCase());
}

/**
 * Extract colors from workspace entities
 */
export async function extractColorsFromEntities(type?: 'labels' | 'workflow-states' | 'project-statuses'): Promise<Color[]> {
  const colorMap = new Map<string, Color>();

  try {
    if (!type || type === 'labels') {
      // Extract from issue labels
      const issueLabels = await getAllIssueLabels();
      for (const label of issueLabels) {
        if (label.color) {
          const normalizedColor = label.color.toUpperCase();
          const existing = colorMap.get(normalizedColor);
          if (existing) {
            existing.usageCount = (existing.usageCount || 0) + 1;
          } else {
            colorMap.set(normalizedColor, {
              hex: normalizedColor,
              usageCount: 1,
            });
          }
        }
      }

      // Extract from project labels
      const projectLabels = await getAllProjectLabels();
      for (const label of projectLabels) {
        if (label.color) {
          const normalizedColor = label.color.toUpperCase();
          const existing = colorMap.get(normalizedColor);
          if (existing) {
            existing.usageCount = (existing.usageCount || 0) + 1;
          } else {
            colorMap.set(normalizedColor, {
              hex: normalizedColor,
              usageCount: 1,
            });
          }
        }
      }
    }

    if (!type || type === 'workflow-states') {
      // Extract from workflow states
      const workflowStates = await getAllWorkflowStates();
      for (const state of workflowStates) {
        if (state.color) {
          const normalizedColor = state.color.toUpperCase();
          const existing = colorMap.get(normalizedColor);
          if (existing) {
            existing.usageCount = (existing.usageCount || 0) + 1;
          } else {
            colorMap.set(normalizedColor, {
              hex: normalizedColor,
              usageCount: 1,
            });
          }
        }
      }
    }

    if (!type || type === 'project-statuses') {
      // Extract from project statuses
      const projectStatuses = await getAllProjectStatuses();
      for (const status of projectStatuses) {
        if (status.color) {
          const normalizedColor = status.color.toUpperCase();
          const existing = colorMap.get(normalizedColor);
          if (existing) {
            existing.usageCount = (existing.usageCount || 0) + 1;
          } else {
            colorMap.set(normalizedColor, {
              hex: normalizedColor,
              usageCount: 1,
            });
          }
        }
      }
    }
  } catch (error) {
    // Handle errors gracefully
    console.error('Error extracting colors:', error);
  }

  // Convert map to array and sort by usage count (descending)
  return Array.from(colorMap.values()).sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
}

/**
 * Get color usage count across all entities
 */
export async function getColorUsage(hex: string): Promise<{
  color: string;
  totalUsage: number;
  breakdown: {
    issueLabels: number;
    projectLabels: number;
    workflowStates: number;
    projectStatuses: number;
  };
}> {
  const normalizedHex = hex.toUpperCase();
  const breakdown = {
    issueLabels: 0,
    projectLabels: 0,
    workflowStates: 0,
    projectStatuses: 0,
  };

  try {
    // Count in issue labels
    const issueLabels = await getAllIssueLabels();
    breakdown.issueLabels = issueLabels.filter(label => label.color.toUpperCase() === normalizedHex).length;

    // Count in project labels
    const projectLabels = await getAllProjectLabels();
    breakdown.projectLabels = projectLabels.filter(label => label.color.toUpperCase() === normalizedHex).length;

    // Count in workflow states
    const workflowStates = await getAllWorkflowStates();
    breakdown.workflowStates = workflowStates.filter(state => state.color.toUpperCase() === normalizedHex).length;

    // Count in project statuses
    const projectStatuses = await getAllProjectStatuses();
    breakdown.projectStatuses = projectStatuses.filter(status => status.color.toUpperCase() === normalizedHex).length;
  } catch (error) {
    console.error('Error getting color usage:', error);
  }

  const totalUsage = breakdown.issueLabels + breakdown.projectLabels + breakdown.workflowStates + breakdown.projectStatuses;

  return {
    color: normalizedHex,
    totalUsage,
    breakdown,
  };
}

/**
 * Format color for terminal display with ANSI codes
 */
export function formatColorPreview(hex: string, text: string = '████'): string {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // ANSI 24-bit color escape code
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

/**
 * Get all curated colors
 */
export function getAllCuratedColors(): Color[] {
  return [...CURATED_COLORS];
}

/**
 * Validate hex color format
 */
export function isValidHexColor(hex: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Normalize hex color (ensure it has # prefix and is uppercase)
 */
export function normalizeHexColor(hex: string): string {
  const cleaned = hex.replace('#', '').toUpperCase();
  return `#${cleaned}`;
}
