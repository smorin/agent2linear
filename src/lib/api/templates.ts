import { logger } from '../logger.js';
import { getLinearClient, LinearClientError } from './client.js';

/**
 * Template data structure
 */
export interface Template {
  id: string;
  name: string;
  type: 'issue' | 'project';
  description?: string;
}

/**
 * Get all templates from Linear
 */
export async function getAllTemplates(typeFilter?: 'issue' | 'project'): Promise<Template[]> {
  try {
    const client = getLinearClient();
    const result: Template[] = [];

    // Fetch all templates from Linear
    try {
      // client.templates returns LinearFetch<Template[]> which is Promise<Template[]>
      const templates = await client.templates;

      for (const template of templates) {
        // Determine template type based on the 'type' field from Linear
        let templateType: 'issue' | 'project';

        if (template.type.toLowerCase().includes('project')) {
          templateType = 'project';
        } else {
          // Default to issue template (most common case)
          templateType = 'issue';
        }

        // Apply filter if specified
        if (typeFilter && templateType !== typeFilter) {
          continue;
        }

        result.push({
          id: template.id,
          name: template.name,
          type: templateType,
          description: template.description || undefined,
        });
      }
    } catch (err) {
      logger.internal('template fetch failed');
      throw err; // Re-throw to let caller know there was an error
    }

    // Sort by type then name
    return result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch templates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(
  templateId: string
): Promise<{ id: string; name: string; type: 'issue' | 'project'; description?: string } | null> {
  try {
    // Use entity cache instead of direct API call
    const { getEntityCache } = await import('../entity-cache.js');
    const cache = getEntityCache();
    const template = await cache.findTemplateById(templateId);

    if (!template) {
      return null;
    }

    return {
      id: template.id,
      name: template.name,
      type: template.type,
      description: template.description || undefined,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch template: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
