# philippklinger.com

[![CI](https://github.com/PhilippKlinger/philippklinger.com/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/PhilippKlinger/philippklinger.com/actions/workflows/ci.yml)
[![CodeQL](https://github.com/PhilippKlinger/philippklinger.com/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/PhilippKlinger/philippklinger.com/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/PhilippKlinger/philippklinger.com/badge)](https://scorecard.dev/viewer/?uri=github.com/PhilippKlinger/philippklinger.com)

Portfolio-Website von Philipp Klinger (DevSecOps & Fullstack). Die Seite stellt Projekte mit Nachweisen vor und ist selbst ein Beleg: Jede Änderung läuft über Pull Request, automatische Prüfungen und einen nachvollziehbaren Build.

## Herkunft

**Neuaufbau 2026.** Die Vorgängerversion entstand in der Weiterbildung bei der Developer Akademie (Angular 16, Akademie-Vorlage) und ist über den Tag [`v1-legacy`](https://github.com/PhilippKlinger/philippklinger.com/tree/v1-legacy) erhalten.

Das Design basiert auf einer Portfolio-Vorlage der Developer Akademie GmbH, angepasst und erweitert.

**Eigener Beitrag:** Neuaufbau auf Angular 22 mit statischem Prerendering, eigene Seitenstruktur, Design-Tokens mit WCAG-AA-Kontrasten, Quality Gates in der CI und abgesicherter `main`-Branch.

## Stack

| Bereich   | Umsetzung                                                                                 |
| --------- | ----------------------------------------------------------------------------------------- |
| Framework | Angular 22, Standalone Components, zoneless                                               |
| Rendering | statisch vorgerendert (`outputMode: "static"`), kein Server zur Laufzeit                  |
| Styles    | SCSS mit Design-Tokens (Custom Properties), Schriften Fira Code und Karla selbst gehostet |
| Tests     | Vitest (Logik, Komponenten), Playwright mit axe-core (E2E, WCAG 2.2 AA), Lighthouse CI    |
| Qualität  | ESLint, Prettier                                                                          |
| Hosting   | statischer Webspace (Apache)                                                              |

## Ablauf

```mermaid
flowchart LR
  Dev[Branch] --> PR[Pull Request]
  PR --> CI["CI: Format, Lint, Tests, Build,<br/>Bundle-Grenze, Platzhalter, Audit, SBOM"]
  PR --> E2E["E2E (4 Viewports, axe)<br/>+ Lighthouse"]
  PR --> Sec["gitleaks + CodeQL"]
  CI & E2E & Sec --> Main["main (Ruleset: nur per PR,<br/>Checks müssen grün sein)"]
  Main --> Dist["dist/ (statisches HTML je Route)"]
```

Die Workflows liegen in [`.github/workflows/`](.github/workflows/). `deploy.yml` lädt jeden Merge per FTPS auf die Vorschau; dieselben Dateien gehen nach Freigabe auf die Hauptdomain.

Jeder Build wird signiert; eine ausgelieferte Datei lässt sich so prüfen: `gh attestation verify <datei> -R PhilippKlinger/philippklinger.com`.

## Lokal starten

Voraussetzung: Node.js 24 und npm.

| Zweck                                                            | Befehl                 |
| ---------------------------------------------------------------- | ---------------------- |
| Abhängigkeiten installieren                                      | `npm ci`               |
| Entwicklungsserver (http://localhost:4200)                       | `npm start`            |
| Unit-Tests                                                       | `npm test`             |
| Lint                                                             | `npm run lint`         |
| Formatierung prüfen                                              | `npm run format:check` |
| Produktions-Build nach `dist/philippklinger/browser/`            | `npm run build`        |
| Build und E2E-Tests (einmalig `npx playwright install chromium`) | `npm run e2e`          |

## Projektstruktur

```
src/
  app/pages/   eine Komponente je Seite (Start, Impressum, Datenschutz, 404)
  styles/      Design-Tokens, Breakpoints, Schriften, Basis-Styles
e2e/          Playwright-Tests gegen den statischen Build, Testserver wie Apache
.github/       CI-Workflows und Dependabot
```
