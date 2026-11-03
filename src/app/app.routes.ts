import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Imprint } from './pages/imprint/imprint';
import { NotFound } from './pages/not-found/not-found';
import { Privacy } from './pages/privacy/privacy';

const notFoundTitle = 'Seite nicht gefunden – Philipp Klinger';

// Project pages (/projekte/:slug) follow in stage 3 together with their content.
// "404" is prerendered as the Apache ErrorDocument; "**" covers client navigation.
export const routes: Routes = [
  { path: '', component: Home, title: 'Philipp Klinger – DevSecOps & Fullstack' },
  { path: 'impressum', component: Imprint, title: 'Impressum – Philipp Klinger' },
  { path: 'datenschutz', component: Privacy, title: 'Datenschutz – Philipp Klinger' },
  { path: '404', component: NotFound, title: notFoundTitle },
  { path: '**', component: NotFound, title: notFoundTitle },
];
