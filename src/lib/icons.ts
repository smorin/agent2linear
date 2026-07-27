import { isAuthenticationError } from './cli-error.js';
import { getAllIssueLabels, getAllProjectLabels, getAllWorkflowStates } from './linear-client.js';
import type { Icon } from './types.js';

/**
 * Curated list of common Linear icons/emojis
 * Organized by category for easier browsing
 */
export const CURATED_ICONS: Icon[] = [
  // Status & Progress
  { name: 'bug', emoji: '🐛', unicode: 'U+1F41B', category: 'status' },
  { name: 'sparkles', emoji: '✨', unicode: 'U+2728', category: 'status' },
  { name: 'fire', emoji: '🔥', unicode: 'U+1F525', category: 'status' },
  { name: 'check', emoji: '✅', unicode: 'U+2705', category: 'status' },
  { name: 'cross', emoji: '❌', unicode: 'U+274C', category: 'status' },
  { name: 'warning', emoji: '⚠️', unicode: 'U+26A0', category: 'status' },
  { name: 'alert', emoji: '🚨', unicode: 'U+1F6A8', category: 'status' },
  { name: 'hourglass', emoji: '⏳', unicode: 'U+23F3', category: 'status' },
  { name: 'rocket', emoji: '🚀', unicode: 'U+1F680', category: 'status' },
  { name: 'construction', emoji: '🚧', unicode: 'U+1F6A7', category: 'status' },

  // Objects & Tools
  { name: 'art', emoji: '🎨', unicode: 'U+1F3A8', category: 'objects' },
  { name: 'gear', emoji: '⚙️', unicode: 'U+2699', category: 'objects' },
  { name: 'wrench', emoji: '🔧', unicode: 'U+1F527', category: 'objects' },
  { name: 'hammer', emoji: '🔨', unicode: 'U+1F528', category: 'objects' },
  { name: 'microscope', emoji: '🔬', unicode: 'U+1F52C', category: 'objects' },
  { name: 'lightbulb', emoji: '💡', unicode: 'U+1F4A1', category: 'objects' },
  { name: 'key', emoji: '🔑', unicode: 'U+1F511', category: 'objects' },
  { name: 'lock', emoji: '🔒', unicode: 'U+1F512', category: 'objects' },
  { name: 'book', emoji: '📖', unicode: 'U+1F4D6', category: 'objects' },
  { name: 'memo', emoji: '📝', unicode: 'U+1F4DD', category: 'objects' },

  // People & Communication
  { name: 'people', emoji: '👥', unicode: 'U+1F465', category: 'people' },
  { name: 'person', emoji: '👤', unicode: 'U+1F464', category: 'people' },
  { name: 'speech', emoji: '💬', unicode: 'U+1F4AC', category: 'people' },
  { name: 'bell', emoji: '🔔', unicode: 'U+1F514', category: 'people' },
  { name: 'eyes', emoji: '👀', unicode: 'U+1F440', category: 'people' },
  { name: 'hand', emoji: '✋', unicode: 'U+270B', category: 'people' },

  // Nature & Symbols
  { name: 'star', emoji: '⭐', unicode: 'U+2B50', category: 'symbols' },
  { name: 'flag', emoji: '🚩', unicode: 'U+1F6A9', category: 'symbols' },
  { name: 'target', emoji: '🎯', unicode: 'U+1F3AF', category: 'symbols' },
  { name: 'heart', emoji: '❤️', unicode: 'U+2764', category: 'symbols' },
  { name: 'clock', emoji: '🕐', unicode: 'U+1F550', category: 'symbols' },
  { name: 'calendar', emoji: '📅', unicode: 'U+1F4C5', category: 'symbols' },
  { name: 'chart', emoji: '📊', unicode: 'U+1F4CA', category: 'symbols' },
  { name: 'graph', emoji: '📈', unicode: 'U+1F4C8', category: 'symbols' },

  // Tech & Development
  { name: 'computer', emoji: '💻', unicode: 'U+1F4BB', category: 'tech' },
  { name: 'mobile', emoji: '📱', unicode: 'U+1F4F1', category: 'tech' },
  { name: 'database', emoji: '🗄️', unicode: 'U+1F5C4', category: 'tech' },
  { name: 'server', emoji: '🖥️', unicode: 'U+1F5A5', category: 'tech' },
  { name: 'cloud', emoji: '☁️', unicode: 'U+2601', category: 'tech' },
  { name: 'link', emoji: '🔗', unicode: 'U+1F517', category: 'tech' },
  { name: 'package', emoji: '📦', unicode: 'U+1F4E6', category: 'tech' },
  { name: 'folder', emoji: '📁', unicode: 'U+1F4C1', category: 'tech' },

  // Business & Organization
  { name: 'building', emoji: '🏢', unicode: 'U+1F3E2', category: 'business' },
  { name: 'briefcase', emoji: '💼', unicode: 'U+1F4BC', category: 'business' },
  { name: 'money', emoji: '💰', unicode: 'U+1F4B0', category: 'business' },
  { name: 'trophy', emoji: '🏆', unicode: 'U+1F3C6', category: 'business' },
  { name: 'medal', emoji: '🏅', unicode: 'U+1F3C5', category: 'business' },
];

/**
 * Search icons by query (matches name or category)
 */
export function searchIcons(query: string): Icon[] {
  const lowerQuery = query.toLowerCase();
  return CURATED_ICONS.filter(
    icon =>
      icon.name.toLowerCase().includes(lowerQuery) ||
      icon.category?.toLowerCase().includes(lowerQuery) ||
      icon.emoji === query
  );
}

/**
 * Get icons filtered by category
 */
export function getIconsByCategory(category: string): Icon[] {
  return CURATED_ICONS.filter(icon => icon.category === category.toLowerCase());
}

/**
 * Get all unique categories
 */
export function getIconCategories(): string[] {
  const categories = new Set<string>();
  for (const icon of CURATED_ICONS) {
    if (icon.category) {
      categories.add(icon.category);
    }
  }
  return Array.from(categories).sort();
}

/**
 * Extract icons from workspace entities (labels, workflow states, etc.)
 * @param type - Entity type to extract from (or undefined for all)
 * @param teamId - Team ID to filter by (or undefined for workspace-wide)
 */
export async function extractIconsFromEntities(
  type?: 'labels' | 'workflow-states' | 'projects',
  teamId?: string
): Promise<
  Array<{
    emoji: string;
    usageCount: number;
    entities: string[];
  }>
> {
  const iconMap = new Map<
    string,
    {
      emoji: string;
      usageCount: number;
      entities: string[];
    }
  >();

  // Helper to extract emoji from text
  const extractEmoji = (text: string | undefined): string[] => {
    if (!text) return [];
    // Match emoji characters (simplified regex)
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    return text.match(emojiRegex) || [];
  };

  try {
    if (!type || type === 'labels') {
      // Extract from issue labels (team-scoped or workspace-wide)
      const issueLabels = await getAllIssueLabels(teamId);
      for (const label of issueLabels) {
        const emojis = extractEmoji(label.name);
        for (const emoji of emojis) {
          const existing = iconMap.get(emoji);
          if (existing) {
            existing.usageCount++;
            existing.entities.push(label.name);
          } else {
            iconMap.set(emoji, {
              emoji,
              usageCount: 1,
              entities: [label.name],
            });
          }
        }
      }

      // Extract from project labels
      const projectLabels = await getAllProjectLabels();
      for (const label of projectLabels) {
        const emojis = extractEmoji(label.name);
        for (const emoji of emojis) {
          const existing = iconMap.get(emoji);
          if (existing) {
            existing.usageCount++;
            existing.entities.push(label.name);
          } else {
            iconMap.set(emoji, {
              emoji,
              usageCount: 1,
              entities: [label.name],
            });
          }
        }
      }
    }

    if (!type || type === 'workflow-states') {
      // Extract from workflow states (team-scoped or workspace-wide)
      const workflowStates = await getAllWorkflowStates(teamId);
      for (const state of workflowStates) {
        const emojis = extractEmoji(state.name);
        for (const emoji of emojis) {
          const existing = iconMap.get(emoji);
          if (existing) {
            existing.usageCount++;
            existing.entities.push(state.name);
          } else {
            iconMap.set(emoji, {
              emoji,
              usageCount: 1,
              entities: [state.name],
            });
          }
        }
      }
    }

    if (!type || type === 'projects') {
      // Extract from projects (team-scoped or workspace-wide)
      const { getAllProjects } = await import('./linear-client.js');
      const projects = await getAllProjects(teamId ? { teamId } : undefined);
      for (const project of projects) {
        // Use the icon field directly (not project name)
        if (project.icon) {
          const existing = iconMap.get(project.icon);
          if (existing) {
            existing.usageCount++;
            existing.entities.push(project.name);
          } else {
            iconMap.set(project.icon, {
              emoji: project.icon,
              usageCount: 1,
              entities: [project.name],
            });
          }
        }
      }
    }
  } catch (error) {
    if (isAuthenticationError(error)) throw error;
    // Handle errors gracefully
    console.error('Error extracting icons:', error);
  }

  // Convert map to array and sort by usage count (descending)
  return Array.from(iconMap.values()).sort((a, b) => b.usageCount - a.usageCount);
}

/**
 * Find icon by name
 */
export function findIconByName(name: string): Icon | undefined {
  return CURATED_ICONS.find(icon => icon.name.toLowerCase() === name.toLowerCase());
}

/**
 * Find icon by emoji
 */
export function findIconByEmoji(emoji: string): Icon | undefined {
  return CURATED_ICONS.find(icon => icon.emoji === emoji);
}
