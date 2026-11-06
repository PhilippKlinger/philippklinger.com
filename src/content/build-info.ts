export interface BuildInfo {
  sha: string;
  runId: string;
}

const SHA = /^[0-9a-f]{40}$/;
const RUN_ID = /^\d+$/;

/** Builds a new object from the two checked fields, so nothing else from the file reaches a page. */
export function parseBuildInfo(text: string): BuildInfo | null {
  try {
    const { sha, runId } = JSON.parse(text) as Partial<Record<keyof BuildInfo, unknown>>;
    const shaValid = typeof sha === 'string' && SHA.test(sha);
    const runIdValid = typeof runId === 'string' && RUN_ID.test(runId);
    return shaValid && runIdValid ? { sha, runId } : null;
  } catch {
    return null;
  }
}

export function buildRunUrl(info: BuildInfo, repositoryUrl: string): string {
  return `${repositoryUrl}/actions/runs/${info.runId}`;
}

export const buildLineTexts = {
  line: 'Diese Seite: getestet und deployt per GitHub Actions',
  build: 'Build',
  howBuilt: 'So ist diese Seite gebaut',
};
