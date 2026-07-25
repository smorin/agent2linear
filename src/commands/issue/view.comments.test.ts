import { describe, expect, it } from 'vitest';

import { buildIssueViewJson } from './view.js';

describe('issue view JSON comment summary', () => {
  it('[PR17-R3] marks a bounded comment prefix as truncated without changing the comments array', () => {
    const comments = [{ id: 'comment-1', body: 'first' }];

    expect(
      buildIssueViewJson(
        { id: 'issue-1', identifier: 'ENG-1' },
        comments,
        true,
        undefined
      )
    ).toEqual({
      id: 'issue-1',
      identifier: 'ENG-1',
      comments,
      commentsTruncated: true,
    });
  });

  it('[PR17-R3] omits comment metadata when comments were not requested', () => {
    expect(
      buildIssueViewJson({ id: 'issue-1' }, undefined, undefined, undefined)
    ).toEqual({ id: 'issue-1' });
  });
});
