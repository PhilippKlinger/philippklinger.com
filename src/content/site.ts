// Public address of the site, base of canonical and Open Graph URLs.
// Assumption until the domain question (B15) is settled: the repository name.
export const siteUrl = 'https://philippklinger.com';

// DRAFT: texts of "So ist diese Seite gebaut" and "Kontakt", wording to be approved.
export const siteBuild = {
  intro:
    'Diese Seite ist selbst ein Beleg: Jede Änderung läuft über einen Pull Request und durch dieselben Prüfungen, die ich für meine Projekte einsetze.',
  points: [
    { term: 'Stack', text: 'Angular 22, statisch vorgerendert, ohne Server zur Laufzeit.' },
    {
      term: 'Prüfungen',
      text: 'Lint, Unit-Tests, Browser-Tests in vier Bildschirmbreiten, Barrierefreiheit nach WCAG 2.2 AA und Lighthouse.',
    },
    {
      term: 'Sicherheit',
      text: 'Secret-Scan, CodeQL, Prüfung der Abhängigkeiten, Stückliste (SBOM), Actions per Commit-SHA festgelegt.',
    },
    {
      term: 'Datenschutz',
      text: 'Keine Analyse-Cookies, keine Drittanbieter-Abrufe, Schriften selbst gehostet.',
    },
  ],
  repository: 'https://github.com/PhilippKlinger/philippklinger.com',
};

export const contact = {
  intro:
    'Sie suchen Verstärkung für Entwicklung, Auslieferung oder Betrieb? Schreiben Sie mir, ich freue mich auf das Gespräch.',
  // DRAFT: availability line, Philipp delivers the final wording.
  availability: 'Offen für eine Festanstellung, remote oder hybrid, ab sofort.',
};
