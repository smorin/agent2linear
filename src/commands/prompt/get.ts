import { silenceStdoutWhile } from '../../lib/output.js';
import { resolvePrompt } from '../../lib/prompts.js';

interface PromptGetOptions {
  json?: boolean;
  team?: string;
  force?: boolean;
}

/**
 * `prompt get [name]` — print the markdown prompt that applies for the current
 * (or `-C`-targeted) directory. With `[name]`, do an exact, highest-precedence
 * lookup. Without it, run the M1 ladder: location override → team → general
 * `defaultPrompt`. `--team <id|alias>` selects the team layer (and is a strict
 * error when no `promptRule` matches it). With `--force` and an explicit `--team`,
 * the team prompt is evaluated first and outranks a location override.
 *
 * Raw markdown body to stdout by default; under `--json`, a single
 * `{ name, source, selection, body, context }` envelope. Errors/diagnostics go
 * to stderr; exit 1 when nothing resolves.
 */
export async function runPromptGet(
  name: string | undefined,
  options: PromptGetOptions
): Promise<void> {
  // Under --json, silence stray stdout so exactly one object is emitted.
  const restore = silenceStdoutWhile(!!options.json);

  const result = resolvePrompt({
    name,
    team: options.team,
    explicitTeam: options.team !== undefined,
    force: options.force,
  });

  restore();

  if (!result.ok) {
    console.error(`❌ ${result.error}`);
    if (result.hint) {
      console.error(`   ${result.hint}`);
    }
    process.exit(1);
  }

  const { prompt } = result;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          name: prompt.name,
          source: prompt.source,
          selection: prompt.selection,
          body: prompt.body,
          context: prompt.context,
        },
        null,
        2
      )
    );
    return;
  }

  // Raw markdown body to stdout. Preserve the body verbatim but ensure a single
  // trailing newline so piping/redirecting reads cleanly.
  process.stdout.write(prompt.body.endsWith('\n') ? prompt.body : `${prompt.body}\n`);
}
