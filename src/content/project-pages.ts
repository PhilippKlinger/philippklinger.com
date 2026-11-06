// Block "Wie es gebaut ist" of the project pages (spec 7). What has no source stays out.

export interface ProjectPageContent {
  architecture: { summary: string; parts: { name: string; role: string }[] };
  /** 2 to 3. */
  decisions: { title: string; reason: string; price: string }[];
  failure: { title: string; what: string; found: string; changed: string };
}

/** Keyed by slug. A project without an entry shows no block. */
export const projectPageContent: Partial<Record<string, ProjectPageContent>> = {};
