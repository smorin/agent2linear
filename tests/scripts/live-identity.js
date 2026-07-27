/**
 * Assert the remote Linear organization identity printed by `a2l whoami`.
 *
 * `Active` is intentionally excluded: it describes the local a2l workspace
 * selection and is `(default)` when authentication comes from LINEAR_API_KEY.
 *
 * @param {string} output
 * @param {{ organizationName: string; organizationUrlKey: string }} expected
 * @returns {{ organizationName: string; organizationUrlKey: string }}
 */
export function assertLiveOrganizationIdentity(output, expected) {
  /** @type {Map<string, string>} */
  const fields = new Map();

  for (const line of output.split(/\r?\n/)) {
    const match = /^(Organization|Workspace):[ \t]*(.*)$/.exec(line);
    if (!match) continue;

    const [, name, rawValue] = match;
    if (fields.has(name)) {
      throw new Error(`Fail-closed: duplicate ${name} field in whoami output`);
    }
    fields.set(name, rawValue.trim());
  }

  if (!fields.has('Organization')) {
    throw new Error('Fail-closed: missing Organization field in whoami output');
  }
  if (!fields.has('Workspace')) {
    throw new Error('Fail-closed: missing Workspace field in whoami output');
  }

  const organizationName = fields.get('Organization');
  const organizationUrlKey = fields.get('Workspace');
  if (organizationName !== expected.organizationName) {
    throw new Error(
      `Fail-closed: expected organization ${expected.organizationName}, received ${organizationName}`
    );
  }
  if (organizationUrlKey !== expected.organizationUrlKey) {
    throw new Error(
      `Fail-closed: expected workspace URL key ${expected.organizationUrlKey}, received ${organizationUrlKey}`
    );
  }

  return { organizationName, organizationUrlKey };
}
