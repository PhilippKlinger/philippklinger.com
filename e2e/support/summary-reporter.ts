import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

// Compact Markdown summary of a run: counts plus one row per failing check with
// the viewports it failed on and the first line of the error. Written to
// e2e-report/summary.md (CI artifact) and to the GitHub step summary, so a run
// can be judged without opening the full HTML report.
const output = 'e2e-report/summary.md';

// Strips terminal colour codes from Playwright error messages.
const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

function firstLine(test: TestCase): string {
  const result = test.results.at(-1);
  const message = result?.error?.message ?? result?.errors[0]?.message ?? '';
  const line =
    message
      .replace(ansi, '')
      .split('\n')
      .find((l) => l.trim()) ?? '';
  return line.trim().replace(/\|/g, '\\|').slice(0, 200);
}

class SummaryReporter implements Reporter {
  private root?: Suite;

  onBegin(_config: unknown, suite: Suite): void {
    this.root = suite;
  }

  onEnd(result: FullResult): void {
    const tests = this.root?.allTests() ?? [];
    const failed = new Map<string, { projects: string[]; error: string }>();
    let passed = 0;
    let flaky = 0;
    let skipped = 0;

    for (const test of tests) {
      const outcome = test.outcome();
      if (outcome === 'expected') passed++;
      else if (outcome === 'flaky') flaky++;
      else if (outcome === 'skipped') skipped++;
      else {
        const file = test.location.file.replace(/\\/g, '/').split('/e2e/').at(-1);
        const key = `${file} › ${test.titlePath().slice(3).join(' › ')}`;
        const entry = failed.get(key) ?? { projects: [], error: firstLine(test) };
        entry.projects.push(test.parent.project()?.name ?? '?');
        failed.set(key, entry);
      }
    }

    const lines = [
      `## E2E: ${result.status === 'passed' ? 'bestanden' : 'Befunde'}`,
      '',
      `${passed} bestanden · ${failed.size} Prüfungen mit Befund · ${flaky} wackelig · ${skipped} übersprungen`,
      '',
    ];
    if (failed.size > 0) {
      lines.push('| Prüfung | Viewports | Fehler |', '|---|---|---|');
      for (const [title, { projects, error }] of failed) {
        lines.push(`| ${title.replace(/\|/g, '\\|')} | ${projects.join(', ')} | ${error} |`);
      }
      lines.push('');
    }
    const markdown = lines.join('\n');

    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, markdown);
    const stepSummary = process.env['GITHUB_STEP_SUMMARY'];
    if (stepSummary) appendFileSync(stepSummary, markdown + '\n');
  }

  printsToStdio(): boolean {
    return false;
  }
}

export default SummaryReporter;
