# Linear SDK Async Properties Guide

This guide documents async properties in the Linear SDK and common performance footguns when using the SDK directly instead of agent2linear.

## Overview

The Linear SDK uses lazy loading for all entity relationships. When you access a property that references another Linear entity (User, Team, Project, etc.), the SDK returns a Promise that triggers an API call.

This design follows GraphQL best practices for reducing over-fetching, but can lead to N+1 query problems if not handled carefully.

## The Core Pattern

All async properties in the Linear SDK return `LinearFetch<T>`, which is an alias for `Promise<T>`.

### Convention

- **Single entity relations**: Getter properties that return Promises
  ```typescript
  get assignee(): LinearFetch<User> | undefined
  ```

- **Collections**: Methods that return Promises
  ```typescript
  comments(variables?): LinearFetch<CommentConnection>
  ```

- **ID properties**: Always synchronous (no API calls)
  ```typescript
  get assigneeId(): string | undefined
  ```

## Async Properties by Object Type

### Issue Object

#### Async Relation Properties (Each triggers an API call)
- `assignee` - Assigned user
- `creator` - User who created the issue
- `cycle` - Sprint/cycle this issue belongs to
- `parent` - Parent issue (for sub-issues)
- `project` - Project this issue belongs to
- `projectMilestone` - Project milestone
- `state` - Workflow state
- `team` - Team this issue belongs to
- `snoozedBy` - User who snoozed this issue
- `favorite` - Favorite record if favorited

#### Async Collection Methods
- `attachments()` - Issue attachments
- `children()` - Sub-issues
- `comments()` - Issue comments
- `history()` - Issue history
- `labels()` - Issue labels
- `relations()` - Issue relations (blocks/blocked by)
- `subscribers()` - Users subscribed to this issue

#### Synchronous ID Properties (No API calls)
- `assigneeId`, `creatorId`, `cycleId`, `parentId`
- `projectId`, `stateId`, `teamId`
- All scalar fields: `id`, `title`, `description`, `identifier`, `number`, `priority`, `estimate`

### Project Object

#### Async Relation Properties
- `creator` - User who created the project
- `lead` - Project lead
- `status` - Project status
- `convertedFromIssue` - Original issue if converted from issue

#### Async Collection Methods
- `comments()` - Project comments
- `issues()` - Issues in this project
- `members()` - Project members
- `teams()` - Teams associated with this project
- `projectMilestones()` - Project milestones

### Team Object

#### Async Relation Properties
- `activeCycle` - Current active cycle
- `defaultIssueState` - Default workflow state for new issues
- `organization` - Organization (always returns Promise, not optional)
- `markedAsDuplicateWorkflowState` - State for duplicates
- `triageIssueState` - Triage state

#### Async Collection Methods
- `cycles()` - Team cycles
- `issues()` - Team issues
- `labels()` - Team labels
- `members()` - Team members
- `projects()` - Team projects
- `states()` - Workflow states

### WorkflowState Object

#### Async Relation Properties
- `team` - Team this state belongs to

#### Async Collection Methods
- `issues()` - Issues in this state

### User Object

#### Async Relation Properties
- `organization` - Organization (always returns Promise, not optional)

#### Async Collection Methods
- `assignedIssues()` - Issues assigned to this user
- `createdIssues()` - Issues created by this user
- `teams()` - Teams this user belongs to

## Common Performance Footguns

### 1. The N+1 Query Problem

The most common footgun is accessing async properties in loops:

```typescript
// BAD: Triggers 1 + N API calls
const issues = await client.issues({ first: 50 });
for (const issue of issues.nodes) {
  const assignee = await issue.assignee;  // +1 API call per issue
  const state = await issue.state;        // +1 API call per issue
  console.log(`${issue.title}: ${assignee?.name} (${state?.name})`);
}
// Total: 1 (issues) + 50 (assignees) + 50 (states) = 101 API calls
```

```typescript
// GOOD: Use agent2linear or custom GraphQL query
const result = await client.client.rawRequest(`
  query {
    issues(first: 50) {
      nodes {
        title
        assignee { name }
        state { name }
      }
    }
  }
`);
// Total: 1 API call
```

### 2. Checking Existence vs Fetching Data

Always check ID properties first before fetching related entities:

```typescript
// BAD: Always triggers API call, even if null
const assignee = await issue.assignee;
if (assignee) {
  console.log(assignee.name);
}
```

```typescript
// GOOD: No API call if not assigned
if (issue.assigneeId) {
  const assignee = await issue.assignee;
  console.log(assignee.name);
}
```

### 3. Repeated Access to Same Property

The SDK does not cache lazy-loaded properties:

```typescript
// BAD: Triggers 2 API calls for the same data
const team1 = await issue.team;
// ... later in code
const team2 = await issue.team;  // Another API call
```

```typescript
// GOOD: Store the result
const team = await issue.team;
// ... use team throughout code
```

### 4. Accessing Properties During Iteration

Collection methods don't pre-fetch related data:

```typescript
// BAD: Triggers N+1 queries
const projects = await client.projects({ first: 25 });
for (const project of projects.nodes) {
  const lead = await project.lead;        // +1 API call
  const teams = await project.teams();    // +1 API call
}
// Total: 1 + 25×2 = 51 API calls
```

```typescript
// GOOD: Use custom GraphQL or agent2linear
// agent2linear automatically includes common relations
const projects = await a2l.projects({ limit: 25 });
// Total: 1 API call with all data
```

## Mitigation Strategies

### Strategy 1: Use agent2linear

agent2linear solves this by using custom GraphQL queries that fetch all commonly needed data upfront:

```bash
# Single API call with all related data
a2l issue list --limit 50
```

### Strategy 2: Custom GraphQL Queries

Write custom GraphQL queries when you need specific data:

```typescript
const { data } = await client.client.rawRequest(`
  query GetIssues {
    issues(first: 50) {
      nodes {
        id
        title
        assignee {
          id
          name
          email
        }
        state {
          id
          name
          type
        }
        team {
          id
          name
          key
        }
      }
    }
  }
`);
```

### Strategy 3: Check IDs First

Always check synchronous ID properties before fetching async relations:

```typescript
if (issue.projectId) {
  const project = await issue.project;
  // Use project
}
```

### Strategy 4: Batch Operations

If using the SDK, collect IDs first, then batch fetch:

```typescript
const issues = await client.issues({ first: 50 });
const assigneeIds = issues.nodes
  .map(i => i.assigneeId)
  .filter(id => id != null);

// Fetch assignees in parallel (still multiple calls, but concurrent)
const assignees = await Promise.all(
  assigneeIds.map(id => client.user(id))
);
```

### Strategy 5: Implement Caching Layer

For long-running processes (servers, webhooks), implement caching:

```typescript
const entityCache = new Map();

async function getCachedTeam(teamId: string) {
  if (entityCache.has(teamId)) {
    return entityCache.get(teamId);
  }
  const team = await client.team(teamId);
  entityCache.set(teamId, team);
  return team;
}
```

This is the approach used by Cyrus and other long-running Linear integrations.

## When to Use Each Approach

### Use agent2linear when:
- Building CLI tools
- One-time queries or infrequent operations
- AI agents needing token efficiency
- You need human-readable output
- Performance matters for bulk operations

### Use SDK with custom GraphQL when:
- You need specific fields not covered by agent2linear
- Building custom integrations
- You understand GraphQL and want full control

### Use SDK with caching when:
- Building long-running processes (servers, webhooks)
- Repeated access to same entities
- Real-time updates with Linear SDK subscriptions
- Write-heavy workflows with validation

### Avoid naive SDK usage when:
- Fetching lists with nested data (N+1 queries)
- Iterating over collections and accessing relations
- Performance matters
- You don't have a caching layer

## Reference

### Full List of Async Properties

For a complete, up-to-date list of async properties, refer to the Linear SDK TypeScript definitions:

```bash
# View the SDK type definitions
node_modules/@linear/sdk/dist/index.d.ts
```

Look for properties with return type `LinearFetch<T>` or methods returning `LinearFetch<Connection>`.

### Pattern Recognition

Quick way to identify async properties:

1. **Returns `LinearFetch<T>`**: It's async (triggers API call)
2. **Has a method signature `()`**: It's async (collection method)
3. **Ends with `Id`**: It's sync (no API call)
4. **Primitive type** (string, number, boolean, Date): It's sync

## Additional Resources

- [Linear GraphQL API Documentation](https://developers.linear.app/docs/graphql/working-with-the-graphql-api)
- [Linear SDK Documentation](https://developers.linear.app/docs/sdk/getting-started)
- [agent2linear Performance Benchmarks](./performance/README.md) - Real-world N+1 query impact
- [Cyrus Pattern](https://github.com/ceedaragents/cyrus) - SDK with caching implementation

## Summary

The Linear SDK's lazy loading is powerful but requires careful handling to avoid N+1 queries. The key principles:

1. **Check IDs first** before fetching relations
2. **Use custom GraphQL** or agent2linear for bulk operations
3. **Cache entity data** in long-running processes
4. **Understand the cost** of each async property access
5. **Choose the right tool** for your use case

When in doubt, use agent2linear for CLI operations and custom GraphQL for everything else. Avoid naive SDK usage in loops.
