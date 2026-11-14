// DRAFT
// Block "Wie es gebaut ist" of the project pages (spec 16.3). What has no source stays out.
// Shortened for the cut of Block C from the texts before it, final wording in the text pass.

export interface ProjectPageContent {
  /** One sentence or two, then the parts in their order. */
  architecture: { summary: string; parts: string[] };
  /** Exactly one (spec 16.3, D9). */
  decisions: { title: string; reason: string; price: string }[];
  failure: { title: string; found: string; changed: string };
}

/** Keyed by slug. A project without an entry shows no block. */
export const projectPageContent: Partial<Record<string, ProjectPageContent>> = {
  videoflix: {
    architecture: {
      summary:
        'Angular-Frontend und Django-API laufen als zwei Images hinter Caddy. Konvertierung mit ffmpeg und Mailversand laufen als eigene RQ-Worker; Datenbank und Redis haben keine Route nach außen.',
      parts: ['Caddy', 'Frontend · API', 'Worker', 'Postgres · Redis'],
    },
    decisions: [
      {
        title: 'Eigenes Deploy-Repo, Images per Digest gepinnt',
        reason:
          'Ein Commit im Deploy-Repo entspricht genau einer laufenden Kombination. SSH-Zugang und Deploy-Secrets liegen nur dort.',
        price:
          'Ein drittes Repo. Ein Rollback dreht Migrationen nicht zurück, ein älteres Backend-Image muss also mit dem neueren Schema arbeiten.',
      },
    ],
    failure: {
      title: 'Der Dev-Stack lief nur nach Handgriffen',
      found:
        'Vier Fehler, etwa CRLF im Entrypoint unter Windows: Drei zeigte die erste Handprüfung im Browser, den vierten der erste Lauf des Playwright-Smoke-Tests.',
      changed:
        'LF per .gitattributes, Postgres fest auf 18, E-Mail-Backend aus der Umgebung. Seit dem 05.11. läuft Playwright in der Frontend-CI gegen den Compose-Stack.',
    },
  },
  'neuro-check-in': {
    architecture: {
      summary:
        'Android-App mit React Native, Expo und TypeScript, ohne Account und ohne eigenes Backend. Die Daten liegen offline in SQLite mit versioniertem Schema, Erinnerungen laufen lokal. Sentry filtert, damit keine Check-in-Inhalte das Gerät verlassen.',
      parts: ['Expo Router', 'SQLite', 'Notifications', 'Sentry'],
    },
    decisions: [
      {
        title: 'E2E auf zwei Emulator-Images',
        reason:
          'google_apis allein war auf GitHub-Runnern zu träge (Taps 5–7 s, WebView-Renderer abgeschossen, device offline), mehr RAM und Kerne halfen nicht. google_atd, Googles CI-Image, ist schnell und stabil.',
        price:
          'ATD hat keine Statusleiste und kein Benachrichtigungsfeld. Flows mit Tag notification-shade brauchen deshalb einen zweiten Emulator und ein eigenes Skript, das das Feld per adb öffnet.',
      },
    ],
    failure: {
      title: 'Notification-Einstieg ohne Zurück: CI grün, Fehler unverändert',
      found:
        'Der Gerätetest zeigte: Über eine Erinnerung geöffnet, hatte „Abbrechen“ kein Ziel. Auch nach dem ersten Fix, denn beim Kaltstart griff er nicht; sein Guard-Test war schon vor dem Fix grün.',
      changed:
        'Die Navigation übergibt withAnchor: true, ein Verhaltenstest mit dem echten expo-router war vorher rot. Neue Regel: Ein Regressionstest reproduziert den Bug vor dem Fix.',
    },
  },
  // Sources: compose files, CI workflows, rulesets and .trivyignore.yaml of vps-edge,
  // vps-monitoring and videoflix-deploy; PRs vps-edge #5, videoflix-deploy #32 and
  // vps-monitoring #1 with their first CI runs of 10.11.
  'vps-plattform': {
    architecture: {
      summary:
        'Caddy ist der einzige Container mit offenen Ports. Uptime Kuma läuft ohne Root und Docker-Socket, das Dashboard nur per SSH-Tunnel. Projekt-Stacks wie videoflix-deploy öffnen selbst keine Ports. Die CI startet jeden Stack, prüft diese Zusagen und scannt die Images mit Trivy.',
      parts: ['Caddy', 'Projekt-Stacks · Uptime Kuma'],
    },
    decisions: [
      {
        title: 'Bekannte Funde ohne Fix befristet angenommen',
        reason:
          'Für einige kritische CVEs in gebündelten Komponenten von Uptime Kuma gibt es noch kein Image mit Fix. Jeder Eintrag in .trivyignore.yaml begründet, warum die Lücke hier nicht erreichbar ist.',
        price:
          'Bekannte Funde bleiben für eine feste Frist offen. Danach wird die CI wieder rot und erzwingt eine neue Prüfung.',
      },
    ],
    failure: {
      title: 'Der erste Trivy-Lauf fand eine kritische CVE im Proxy',
      found:
        'CVE-2026-111497 im gepinnten Caddy 2.11.7 und im Postgres-Image von Videoflix: Der Trivy-Schritt der neuen CI brach am 10.11. beide Pull Requests ab.',
      changed:
        'Caddy 2.11.9 und ein neuer Postgres-Digest, noch vor dem Merge. Funde ohne Image mit Fix stehen befristet in .trivyignore.yaml.',
    },
  },
  // Depends on the rework KPF-08, re-read in task 15 and X2 before DRAFT falls.
  // Sources: Buildorder README (quickstart, security model), PR #15 and the practical test of the
  // first release (kit2). No version in the text.
  buildorder: {
    architecture: {
      summary:
        'Plugin für Claude Code mit eigenem Marketplace. Skills führen durch Einrichtung, Sessionstart und Sessionende; eine Node.js-CLI erledigt das Mechanische deterministisch. Hooks prüfen Commits und Steuerdateien, und zwar nur in einem Workspace mit workspace.json.',
      parts: ['/buildorder:init', 'CLI (detect, nest)', 'workspace.json', 'Hooks'],
    },
    decisions: [
      {
        title: 'Der Secret-Guard verweigert im Zweifel',
        reason:
          'Kann der Hook die git-Ausgabe nicht lesen oder das Ziel-Repo nicht erkennen, verweigert er den Commit und nennt eine prüfbare Form. Durchlassen ließe genau die unklaren Fälle ungeprüft.',
        price:
          'Manche gültigen Befehle müssen anders geschrieben werden; ohne node sperrt er jeden git-Befehl. Commits außerhalb von Claude Code fängt gitleaks im Pre-commit und in der CI ab.',
      },
    ],
    failure: {
      title: 'Das Starter-Image fiel bei Trivy durch',
      found:
        'Im Praxistest des ersten Release meldete Trivy im Django-Starter-Image HIGH-Lücken: zwei im Debian-Basis-Image, fünf in Paketen, die pip mitbringt. Neue Projekte wären mit roter CI gestartet.',
      changed:
        'Die Laufzeit-Stage installiert die Debian-Sicherheitsupdates und enthält kein pip mehr. Buildorders eigene CI scannt das Starter-Image mit Trivy, damit ein alterndes Basis-Image rot wird, bevor es Nutzer trifft.',
    },
  },
};
