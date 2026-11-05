import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Imprint } from './pages/imprint/imprint';
import { NotFound } from './pages/not-found/not-found';
import { Privacy } from './pages/privacy/privacy';
import { ProjectPage } from './pages/project-page/project-page';
import {
  hasProjectPage,
  projectDescription,
  projectResolver,
  projectTitle,
} from './pages/project-page/project-route';

const notFoundTitle = 'Seite nicht gefunden – Philipp Klinger';
const notFoundData = {
  description:
    'Diese Adresse gibt es auf philipp-klinger.com nicht (mehr). Weiter zur Startseite von Philipp Klinger.',
  // An error page has no canonical address of its own.
  canonical: false,
};

// "404" is prerendered as the Apache ErrorDocument; "**" covers client navigation.
export const routes: Routes = [
  {
    path: '',
    component: Home,
    title: 'Philipp Klinger – DevSecOps & Fullstack',
    data: {
      description:
        'Philipp Klinger, Software Engineer für Fullstack und DevSecOps: Projekte mit automatisierten Tests, CI/CD, Security-Checks und Operations.',
    },
  },
  {
    path: 'projekte/:slug',
    component: ProjectPage,
    canMatch: [hasProjectPage],
    title: projectTitle,
    resolve: { project: projectResolver, description: projectDescription },
  },
  {
    path: 'impressum',
    component: Imprint,
    title: 'Impressum – Philipp Klinger',
    data: {
      description:
        'Impressum von philipp-klinger.com: Anbieterkennzeichnung nach § 5 DDG und Kontakt zu Philipp Klinger.',
    },
  },
  {
    path: 'datenschutz',
    component: Privacy,
    title: 'Datenschutz – Philipp Klinger',
    data: {
      description:
        'Datenschutzerklärung von philipp-klinger.com: welche Daten beim Besuch anfallen und wie sie verarbeitet werden.',
    },
  },
  { path: '404', component: NotFound, title: notFoundTitle, data: notFoundData },
  { path: '**', component: NotFound, title: notFoundTitle, data: notFoundData },
];
