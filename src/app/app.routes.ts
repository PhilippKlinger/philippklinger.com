import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Imprint } from './pages/imprint/imprint';
import { NotFound } from './pages/not-found/not-found';
import { Privacy } from './pages/privacy/privacy';

const notFoundTitle = 'Seite nicht gefunden – Philipp Klinger';
const notFoundData = {
  description:
    'Diese Adresse gibt es auf philippklinger.com nicht (mehr). Weiter zur Startseite von Philipp Klinger.',
  // An error page has no canonical address of its own.
  canonical: false,
};

// Project pages (/projekte/:slug) follow in stage 3 together with their content.
// "404" is prerendered as the Apache ErrorDocument; "**" covers client navigation.
export const routes: Routes = [
  {
    path: '',
    component: Home,
    title: 'Philipp Klinger – DevSecOps & Fullstack',
    data: {
      description:
        'Philipp Klinger, Software Engineer für Fullstack und DevSecOps: Projekte mit Tests, CI/CD, Sicherheitsprüfungen und Betrieb.',
    },
  },
  {
    path: 'impressum',
    component: Imprint,
    title: 'Impressum – Philipp Klinger',
    data: {
      description:
        'Impressum von philippklinger.com: Anbieterkennzeichnung nach § 5 DDG und Kontakt zu Philipp Klinger.',
    },
  },
  {
    path: 'datenschutz',
    component: Privacy,
    title: 'Datenschutz – Philipp Klinger',
    data: {
      description:
        'Datenschutzerklärung von philippklinger.com: welche Daten beim Besuch anfallen und wie sie verarbeitet werden.',
    },
  },
  { path: '404', component: NotFound, title: notFoundTitle, data: notFoundData },
  { path: '**', component: NotFound, title: notFoundTitle, data: notFoundData },
];
