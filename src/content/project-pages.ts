// DRAFT
// Block "Wie es gebaut ist" of the project pages (spec 7). What has no source stays out.

export interface ProjectPageContent {
  architecture: { summary: string; parts: { name: string; role: string }[] };
  /** 2 to 3. */
  decisions: { title: string; reason: string; price: string }[];
  failure: { title: string; what: string; found: string; changed: string };
}

/** Keyed by slug. A project without an entry shows no block. */
export const projectPageContent: Partial<Record<string, ProjectPageContent>> = {
  videoflix: {
    architecture: {
      summary:
        'Angular-Frontend und Django-REST-API laufen als zwei Images hinter einem Edge-Proxy auf einer Origin; Konvertierung und Mailversand laufen als eigene RQ-Worker neben der API, und ein eigenes Deploy-Repo legt die laufenden Images per Digest fest.',
      parts: [
        {
          name: 'Edge-Proxy (Caddy)',
          role: 'TLS und Routing: /api/, /admin/, /static/ ans Backend, alles andere ans Frontend. Kein Dienst des Stacks veröffentlicht Ports.',
        },
        {
          name: 'frontend (Angular 22, nginx)',
          role: 'Liefert den statischen Build mit CSP aus. hls.js spielt die Streams ab.',
        },
        {
          name: 'web (Gunicorn gthread, Django/DRF)',
          role: 'API und Auth mit JWT im Cookie. Prüft Login und Sichtbarkeit und liefert HLS-Playlists und -Segmente aus.',
        },
        {
          name: 'worker (RQ, ffmpeg)',
          role: 'Konvertiert Uploads nacheinander nach HLS in 480p, 720p und 1080p. Genau ein Worker, ohne Route nach außen.',
        },
        {
          name: 'mail-worker (RQ)',
          role: 'Versendet Kontomails. Einziger Worker mit Route nach außen.',
        },
        {
          name: 'db und redis (Postgres 18, Redis 8)',
          role: 'Daten; Cache, Rate Limits und Job Queue. Beide im Netz internal ohne Route nach außen.',
        },
      ],
    },
    decisions: [
      {
        title: 'Eigenes Deploy-Repo, Images per Digest gepinnt',
        reason:
          'Die App-Repos bauen und pushen nur nach GHCR. Das Deploy-Repo pinnt die Images per Digest und rollt sie aus: ein Commit entspricht einer laufenden Kombination. SSH-Zugang und Deploy-Secrets liegen nur dort.',
        price:
          'Ein drittes Repo. Weil das Ruleset keinen Direkt-Commit auf main erlaubt, steht der laufende Digest zunächst in einer gitignorierten compose.override.yaml, erst ein Pin-PR trägt ihn nach. Ein Rollback dreht Migrationen nicht zurück, ein älteres Backend-Image muss also mit dem neueren Schema arbeiten.',
      },
      {
        title: 'HLS-Auslieferung durch Django statt direkt vom Proxy',
        reason:
          'Django prüft bei jedem Abruf Login und Eigentum. Fremde private Videos antworten mit 404, damit ihre Existenz nicht sichtbar wird. Die vorhandene Lösung wird richtig eingestellt, statt vorzeitig zu optimieren.',
        price:
          'Playlists und Segmente laufen durch Gunicorn. Dafür braucht es gthread, damit langsame Uploads und HLS-Requests sich nicht blockieren. X-Accel-Redirect kommt erst nach einer Messung, der Lasttest ist auf nach 1.0 verschoben. Die Grenze dieser Lösung ist also noch nicht gemessen.',
      },
      {
        title: 'Eigener mail-worker, damit ffmpeg keinen Weg nach außen hat',
        reason:
          'ffmpeg verarbeitet nicht vertrauenswürdige Uploads und soll keine Route nach außen bekommen. Vorher liefen Mails im Request, ein SMTP-Ausfall ergab einen 500. Jetzt legt der Request nur die User-ID in die Queue mail.',
        price:
          'Ein Dienst mehr und ein Henne-Ei-Problem: Das alte Image kennt den Befehl nicht, das neue Image braucht den Dienst. Dienst und Backend-Digest kamen deshalb in einem Deploy-Commit.',
      },
    ],
    failure: {
      title: 'Der Dev-Stack lief erst nach Handgriffen, und erst ein Browser-Test zeigte es',
      what: 'Vier Fehler im Dev-Stack: CRLF-Zeilenenden im Entrypoint unter Windows, postgres:latest statt einer festen Version, fest verdrahtetes SMTP, eine ungültige Absenderadresse in den Env-Vorlagen.',
      found:
        'Die ersten drei kamen bei der ersten Handprüfung im Browser hoch, den vierten fand der erste Lauf des neuen Playwright-Smoke-Tests.',
      changed:
        '.gitattributes erzwingt LF für *.sh, Postgres ist auf Version 18 festgelegt, das E-Mail-Backend kommt aus der Umgebung, Mailpit läuft im Dev-Stack. Seit dem 05.11. läuft Playwright in der Frontend-CI gegen den Compose-Stack, und der Image-Job hängt davon ab.',
    },
  },
  'neuro-check-in': {
    architecture: {
      summary:
        'Neuro Check-in ist eine Android-App mit React Native, Expo und TypeScript, deren Daten offline in SQLite liegen; es gibt keinen Account und kein eigenes Backend.',
      parts: [
        {
          name: 'App-Schicht',
          role: 'Screens und Routen dateibasiert mit Expo Router, PDF-Export über expo-print und expo-sharing.',
        },
        {
          name: 'Datenschicht',
          role: 'SQLite-Service-Layer mit parametrisierten Statements und versioniertem Schema (user_version). Die Migration läuft komplett in einer Transaktion, secure_delete ist an.',
        },
        {
          name: 'Notifications',
          role: 'Lokale Erinnerungen über expo-notifications. Das lokale Expo-Modul exact-alarm liest canScheduleExactAlarms(), die Freigabe wird just-in-time abgefragt.',
        },
        {
          name: 'Observability',
          role: 'Sentry mit rekursivem beforeSend-Scrubber und Breadcrumb-Filter, damit keine Check-in-Inhalte das Gerät verlassen. In Development ist Sentry aus.',
        },
        {
          name: 'CI und E2E',
          role: 'GitHub Actions: Secret-Scan, Audit-Gate, Lint, Typecheck, Jest mit Coverage-Schwelle, Expo Doctor, Bundle-Check. Dazu Maestro-Black-Box-Tests gegen einen Release-Build auf dem Android-Emulator.',
        },
        {
          name: 'Website',
          role: 'Getrenntes Repo, statische Astro-Ausgabe, geprüft mit Playwright, axe und Lighthouse CI. Kein zweiter Build, Production erhält genau die geprüften Dateien.',
        },
      ],
    },
    decisions: [
      {
        title: 'E2E auf zwei Emulator-Images',
        reason:
          'google_apis allein war auf GitHub-Runnern zu träge (Taps 5–7 s, WebView-Renderer abgeschossen, device offline), mehr RAM und Kerne halfen nicht. google_atd, Googles CI-Image, ist schnell und stabil.',
        price:
          'ATD hat keine Statusleiste und kein Benachrichtigungsfeld. Flows mit Tag notification-shade brauchen deshalb einen zweiten Emulator und ein eigenes Skript, das das Feld per adb öffnet.',
      },
      {
        title: 'Audit-Gate per Allowlist statt gesenktem Level',
        reason:
          'npm audit kennt keine Ausnahmen, und ein gesenktes Gate wird still schwächer. Ein eigenes Gate-Skript blockt jeden high- oder critical-Fund, außer er steht mit Begründung und Ablaufdatum in der Allowlist.',
        price:
          'Ein abgelaufener Eintrag macht die CI rot und erzwingt eine neue Prüfung. Bis dahin bleibt ein bekannter Fund akzeptiert: zod 3 in @expo/cli, nur Tooling, bis 31.01.2027.',
      },
      {
        title: 'Privates Repo, Merge-Sicherung per Hook statt Branch-Schutz',
        reason:
          'Gezeigt werden soll das fertige Produkt, nicht der Code. GitHub Free bietet für private Repos keinen Branch-Schutz und keine Rulesets (HTTP 403). Der Hook merge-guard blockiert gh pr merge, bis alle Checks grün und die Pflicht-Checks vorhanden sind. Kann er nicht prüfen, blockiert er.',
        price:
          'Ein Merge über die GitHub-Weboberfläche umgeht den Hook, dort gilt dieselbe Regel von Hand. CodeQL fällt im Free-Plan ebenfalls weg.',
      },
    ],
    failure: {
      title: 'Notification-Einstieg ohne Zurück: CI grün, Fehler unverändert',
      what: 'Beim Öffnen über eine Erinnerung lag die Check-in-Auswahl ohne Home darunter im Stack, router.back() und „Abbrechen“ hatten kein Ziel. Der erste Fix verankerte den Root-Stack per unstable_settings.anchor = "(tabs)", abgesichert durch einen Regex-Guard-Test. Beim Kaltstart griff er nicht: Die Navigation läuft dort, bevor der Root-Stack gemountet ist, und expo-router 58 setzt den Anchor dann nur mit withAnchor.',
      found:
        'Der Gerätetest zum SDK-58-Upgrade brachte den Befund, der Gerätetest nach dem ersten Fix zeigte: Fehler unverändert. Die Annahme war nie am Bibliotheks-Code geprüft worden, der Guard-Test war schon vor dem Fix grün.',
      changed:
        'Die Navigation liegt in openCheckInFromNotification und übergibt withAnchor: true. Ein Verhaltenstest mit dem echten expo-router deckt Kalt- und Warmstart ab und war vor dem Fix rot. Neue Regel: Ein Regressionstest muss den Bug vor dem Fix rot reproduzieren und Verhalten statt Quelltext prüfen. Der E2E-Flow S4 prüft den Einstieg heute im Release-Build mit echtem Kaltstart.',
    },
  },
  // Depends on the rework EV-13, re-read in task 15 and X2 before DRAFT falls.
  conduit: {
    architecture: {
      summary:
        'Docker Compose führt das Angular-Frontend, das Django-Backend und die PostgreSQL-Datenbank in einem Stack zusammen. GitHub Actions baut daraus die Images für das Deployment.',
      parts: [
        {
          name: 'Frontend (Angular, Nginx)',
          role: 'Multi-Stage-Build. Nginx liefert nur das kompilierte Frontend aus, Node.js und node_modules bleiben aus dem Runtime-Image heraus.',
        },
        {
          name: 'Backend (Django REST, Gunicorn)',
          role: 'Multi-Stage-Image, läuft als unprivilegierter appuser. Der Entrypoint wartet auf die Datenbank, führt die Migrationen aus und startet Gunicorn als PID 1.',
        },
        {
          name: 'PostgreSQL',
          role: 'Nur im Compose-Netzwerk erreichbar, Daten im Named Volume. Der pg_isready-Healthcheck steuert den Start des Backends.',
        },
        {
          name: 'Git-Submodule',
          role: 'Das Elternrepo pinnt die Commits von Frontend und Backend, damit lokale Builds und CI einen definierten Quellstand nutzen.',
        },
        {
          name: 'CI und GHCR',
          role: 'Baut die Images auf GitHub-Runnern und veröffentlicht sie mit Commit-SHA als Tag und unveränderlichem Digest.',
        },
        {
          name: 'Deployment-Workflow und docker-compose.prod.yaml',
          role: 'Das Manifest enthält nur Image-Referenzen, auf dem Zielserver wird nichts gebaut. Der Workflow ist darauf ausgelegt, Readiness und Image-Identität der laufenden Container zu prüfen.',
        },
      ],
    },
    decisions: [
      {
        title: 'Images in der CI bauen, nicht auf dem Server',
        reason:
          'Ein Build auf dem Server macht Releases schwer auf einen Quellstand zurückführbar. Commit-Tags und Digests verbinden die Container mit ihrer Source-Revision.',
        price:
          'API_URL wird in das Frontend-Bundle kompiliert, jede Änderung braucht einen neuen Build. Private GHCR-Pakete bräuchten ein eigenes Registry-Authentication-Design. Die eigene Workflow-Logik erzeugt Wartungsaufwand.',
      },
      {
        title: 'Frontend und Backend als gepinnte Git-Submodule',
        reason:
          'Beide Anwendungen bleiben eigene Repos, das Elternrepo legt den Quellstand für Build und CI fest.',
        price:
          'Klonen nur mit --recurse-submodules. Der Pin zeigt auf den Feature-Commit statt auf den Merge-Commit in master, der Inhalt ist identisch. Die Submodul-Repos haben keine eigene Build-CI.',
      },
      {
        title: 'PostgreSQL nur intern, Daten im Named Volume',
        reason:
          'Die Datenbank hat keinen veröffentlichten Host-Port, die Daten überstehen das Neuerstellen der Container.',
        price:
          'docker compose down -v löscht das Volume samt Inhalt. Neue Datenbank-Credentials brauchen nach der Initialisierung eine bewusste Migration. Es gibt keine Datensicherung des Volumes.',
      },
    ],
    failure: {
      title: 'CI auf main scheitert am persönlichen Token',
      what: 'Der Merge von PR #2 am 11.10. löste den ersten CI-Lauf auf main aus. Er scheiterte beim Submodul-Checkout mit „could not read Username“, die Folge-Jobs liefen nicht, kein Lauf baute mehr Images. Wahrscheinliche Ursache: Das Secret für den Submodul-Checkout vom 05.08. war abgelaufen.',
      found:
        'Die Bestandsaufnahme vom 31.10. las den Lauf und das Datum des Secrets aus, main war da seit 20 Tagen rot. Dieselbe Prüfung ergab, dass beide Submodule öffentlich sind und der Token vermeidbar ist.',
      changed:
        'Der Fix entfernt token: aus allen vier Checkouts in ci.yml, der nächste Lauf auf main war grün. Den Token zu erneuern wurde verworfen, weil das Problem damit nur verschoben wäre. Preis: Das funktioniert nur, solange die Repos öffentlich sind.',
    },
  },
  // Depends on the rework KPF-08, re-read in task 15 and X2 before DRAFT falls.
  'developer-workspace-kit': {
    architecture: {
      summary:
        'Das Developer Workspace Kit ist ein Node.js-Plugin für Claude Code und sein eigener Marketplace; kit.mjs erledigt das Mechanische deterministisch, Claude übernimmt Einordnung, Rückfragen und Texte.',
      parts: [
        {
          name: '/kit:init',
          role: 'Starter-Skill: erkennt Projektart und Stack eines Ordners. Startet nur auf ausdrücklichen Befehl (disable-model-invocation).',
        },
        {
          name: 'kit.mjs',
          role: 'CLI ohne Abhängigkeiten: detect, nest, scaffold, verify, finalize, sync u. a.',
        },
        {
          name: 'templates/',
          role: 'Vorlagen in vier Teilen: core, vier Profile, neun Module, Nutzer-Ebene.',
        },
        {
          name: '.claude/workspace.json',
          role: 'Einzige Steuerdatei je Workspace. Hooks, status.mjs, /kickoff und /handoff lesen nur sie.',
        },
        {
          name: 'Hooks',
          role: 'Sechs Hooks im Workspace, u. a. boundary-guard und secret-guard. Node in Exec-Form, ohne Shell dazwischen.',
        },
        {
          name: 'Statusline und Credits-Guard',
          role: 'Nutzer-Ebene: Nur die Statusline bekommt die rate_limits. Sie schreibt usage.json, der Guard liest sie.',
        },
      ],
    },
    decisions: [
      {
        title: 'Kopie statt Verweis',
        reason:
          'Hooks und Skills liegen sichtbar und anpassbar im jeweiligen Workspace. Das Plugin selbst bringt keine Hooks mit.',
        price:
          'Bestehende Workspaces bleiben auf ihrer Kopie, bis /kit:sync sie hebt. Dafür brauchte es ein eigenes Feature, und uncommittete Kit-Dateien stoppen den Lauf, weil Git das Sicherheitsnetz ist.',
      },
      {
        title: 'Durchgesetzte Grenzen, jede Shell-Regel doppelt',
        reason:
          'Harte Grenzen werden per Hook und permissions durchgesetzt, nicht als Prosa-Verbot. Gemessen: Eine Bash(…)-deny-Regel blockt das PowerShell-Tool nicht.',
        price:
          'Jede Regel steht doppelt, und auf macOS und Linux ist die PowerShell-Variante wirkungslos. Exotische Lesewege wie node -e readFileSync sind nicht geprüft.',
      },
      {
        title: '/review und /secure als Hülle um die eingebauten Befehle',
        reason:
          'Beide Skills wurden zuerst zugunsten von /code-review und /security-review entfernt. Der Abgleich in zwei bestehenden Workspaces zeigte, dass /secure Gesamt-Audit und Datenschutz abdeckte, was der eingebaute Befehl nicht leistet. Daher kombinieren statt ersetzen.',
        price:
          'Die Entscheidung wurde am selben Tag revidiert. Ein Fork kann das Startverzeichnis nicht wechseln: Aus dem Workspace-Root prüfen beide den Diff per git -C und nennen den eingebauten Lauf als offen.',
      },
    ],
    failure: {
      title: 'Ein lesender Audit-Skill durfte mehr als lesen',
      what: 'Die allowed-tools der Skills waren zu breit. „node *scripts/status.mjs*“ passte auch auf „node -e“. „git -C * log“ und „git -C * branch“ erlaubten „--output=“ und „-c diff.external=“. „node --test“ führte im lesenden Audit /bestandsaufnahme fremden Code aus.',
      found: 'Durch das Kit-eigene /secure in der Release-Prüfung vor v0.1.0.',
      changed:
        'Die Freigaben sind exakt an das jeweilige Skript im Skill-Verzeichnis gebunden. /bestandsaufnahme hat keine „git -C“- und „node --test“-Freigabe mehr, das Inventar liefert stattdessen unmergedBranches. Tests halten das fest.',
    },
  },
};
