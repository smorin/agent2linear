import { afterEach, describe, expect, it, vi } from 'vitest';

import { configureDiagnostics, resetDiagnostics } from '../logger.js';
import { getLinearClient } from './client.js';
import { createProject } from './projects.js';

vi.mock('./client.js', async () => {
  const actual = await vi.importActual<typeof import('./client.js')>('./client.js');
  return { ...actual, getLinearClient: vi.fn() };
});

afterEach(() => {
  resetDiagnostics();
  vi.restoreAllMocks();
});

describe('project creation diagnostics', () => {
  it('does not touch the lazy template getter at maximum diagnostics', async () => {
    configureDiagnostics({ debug: true });
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const lazyTemplateFetch = vi.fn(() => Promise.reject(new Error('must not fetch')));
    const project = {
      id: 'project-1',
      name: 'Project',
      url: 'https://linear.app/project/project-1',
      state: 'planned',
      lastAppliedTemplateId: 'template-1',
    };
    Object.defineProperty(project, 'lastAppliedTemplate', { get: lazyTemplateFetch });
    const createProjectMock = vi.fn().mockResolvedValue({ project: Promise.resolve(project) });
    vi.mocked(getLinearClient).mockReturnValue({
      createProject: createProjectMock,
    } as unknown as ReturnType<typeof getLinearClient>);

    const result = await createProject({ name: 'Project', templateId: 'template-1' });

    expect(result).toMatchObject({ id: 'project-1', name: 'Project' });
    expect(createProjectMock).toHaveBeenCalledOnce();
    expect(lazyTemplateFetch).not.toHaveBeenCalled();
    const templateDiagnostic = stderr.mock.calls.find(
      call => call[0] === '[debug] project template application result'
    );
    expect(templateDiagnostic?.[1]).toEqual({
      templateApplied: true,
      requestedTemplateMatched: true,
    });
    const rendered = JSON.stringify(stderr.mock.calls);
    expect(rendered).not.toContain('template-1');
    expect(rendered).not.toContain('project-1');
  });
});
