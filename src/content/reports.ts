// Row of the reports on the start page: leads to the blog, the list gives its count (spec 16.1).
import type { ProjectPreview } from './projects';
import type { DeliveryLink } from './software-delivery';

export interface Report {
  title: string;
  what: string;
  links: DeliveryLink[];
}

// Every address ends with a slash: the blog redirects any other form with a 301.
const reportBase = 'https://philippklinger.github.io/my-dso-blog/docs/projects/';
const repoBase = 'https://github.com/PhilippKlinger';

function reportLinks(reportPath: string, repository?: string): DeliveryLink[] {
  const report = { label: 'Bericht lesen', url: `${reportBase}${reportPath}` };
  return repository ? [report, { label: 'Repo', url: `${repoBase}/${repository}` }] : [report];
}

// DRAFT: texts of the row, wording to be approved (PK-23).
export const reportCard: {
  title: string;
  text: string;
  chips: string[];
  cta: DeliveryLink;
  preview: ProjectPreview;
  reports: Report[];
} = {
  title: 'Security, Linux und Container',
  text: 'Praxisprojekte mit Bericht: Aufgabe, Vorgehen, Ergebnis und Belege. Jeder Eintrag führt direkt zum passenden Bericht.',
  chips: ['OWASP', 'Linux', 'NGINX', 'Docker Compose'],
  cta: { label: 'Alle Projektberichte ansehen', url: reportBase },
  // Start page of the blog (screenshot by Philipp, 13.11.).
  preview: { src: 'images/projects/blog.webp', width: 704, height: 380 },
  reports: [
    {
      title: 'OWASP Juice Shop',
      what: 'Web Application Security: Injection, unsigned JWT',
      links: reportLinks('Juice%20Shop%20Master/'),
    },
    {
      title: 'V-Server Setup',
      what: 'Linux, SSH, NGINX',
      links: reportLinks('v-server-setup/', 'v-server-setup'),
    },
    {
      title: 'Truck Signs API',
      what: 'Fehlerhaftes Compose-Setup repariert, PostgreSQL',
      links: reportLinks('truck-signs-api/', 'truck-signs-api'),
    },
    {
      title: 'WordPress Multi-Container',
      what: 'Docker Compose, Healthchecks, persistente Daten',
      links: reportLinks('wordpress-multicontainer-setup/', 'wordpress-multicontainer-setup'),
    },
  ],
};
