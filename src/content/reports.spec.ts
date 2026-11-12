import { reportCard } from './reports';

// With the closing slash: the blog answers every other form with a 301.
const blog = 'https://philippklinger.github.io/my-dso-blog/docs/projects/';
const repos = 'https://github.com/PhilippKlinger';

describe('reportCard', () => {
  it('has the texts of the spec', () => {
    expect(reportCard.title).toBe('Security, Linux und Container');
    expect(reportCard.text).toBe(
      'Praxisprojekte mit Bericht: Aufgabe, Vorgehen, Ergebnis und Belege. Jeder Eintrag führt direkt zum passenden Bericht.',
    );
    expect(reportCard.chips).toEqual(['OWASP', 'Linux', 'NGINX', 'Docker Compose']);
  });

  it('leads to all reports', () => {
    expect(reportCard.cta).toEqual({ label: 'Alle Projektberichte ansehen', url: blog });
  });

  it('lists the four reports in order with https links', () => {
    expect(reportCard.reports.map((report) => [report.title, report.what, report.links])).toEqual([
      [
        'OWASP Juice Shop',
        'Web Application Security: Injection, unsigned JWT',
        [{ label: 'Bericht lesen', url: `${blog}Juice%20Shop%20Master/` }],
      ],
      [
        'V-Server Setup',
        'Linux, SSH, NGINX',
        [
          { label: 'Bericht lesen', url: `${blog}v-server-setup/` },
          { label: 'Repo', url: `${repos}/v-server-setup` },
        ],
      ],
      [
        'Truck Signs API',
        'Fehlerhaftes Compose-Setup repariert, PostgreSQL',
        [
          { label: 'Bericht lesen', url: `${blog}truck-signs-api/` },
          { label: 'Repo', url: `${repos}/truck-signs-api` },
        ],
      ],
      [
        'WordPress Multi-Container',
        'Docker Compose, Healthchecks, persistente Daten',
        [
          { label: 'Bericht lesen', url: `${blog}wordpress-multicontainer-setup/` },
          { label: 'Repo', url: `${repos}/wordpress-multicontainer-setup` },
        ],
      ],
    ]);
  });

  it('links Juice Shop without a repository', () => {
    const juiceShop = reportCard.reports[0];
    expect(juiceShop.links.map((link) => link.label)).toEqual(['Bericht lesen']);
  });
});
