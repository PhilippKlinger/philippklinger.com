// Single source for personal data shown on several pages.
// Texts marked DRAFT are placeholders until Philipp approves the final wording.
export const profile = {
  name: 'Philipp Klinger',
  role: 'Software Engineer · Fullstack & DevSecOps',
  // Region instead of the village (Grill 2026-11-04).
  location: 'Raum Osnabrück',
  email: 'hello@philipp-klinger.com',
  github: 'https://github.com/PhilippKlinger',
  linkedin: 'https://www.linkedin.com/in/philipp-klinger',
  // Approved wording (DECISIONS 2026-11-03, Faktenbasis section 6).
  claim:
    'Ich entwickle Anwendungen vom Code bis zum Betrieb und bringe sie sicher, automatisiert und nachvollziehbar live.',
  aiNote:
    'KI nutze ich als Werkzeug mit Leitplanken: Ich gebe die Richtung vor und prüfe, teste und sichere ab, was entsteht.',
};

export const navigation = [
  { label: 'Über mich', fragment: 'ueber-mich' },
  { label: 'Skills', fragment: 'skills' },
  { label: 'Projekte', fragment: 'projekte' },
  { label: 'Kontakt', fragment: 'kontakt' },
];

// DRAFT: about section (FB-06, mockup runde-5), wording follows in the text pass (Task 15).
// Facts and titles follow the final CV; no employer names (draft 2026-11-08).
export const about = {
  // Red thread of Bewerbungsphase/Wissensbasis/02-fundament.md (working version).
  motto:
    'Ich sorge dafür, dass komplexe Systeme zuverlässig und nachweisbar laufen: früher Prüfstände, heute Anwendungen und Pipelines.',
  // Short titles of the CV stations, one line each on the path.
  path: ['Techniker Maschinenbau', 'Field Service Engineer', 'Software Engineer'],
  // The approved AI sentence lives here instead of the hero (Grill 2026-11-04).
  text: `Als Field Service Engineer habe ich an komplexen Fahrzeugprüfsystemen Fehler analysiert und behoben und weltweit Inbetriebnahmen neuer Prüfanlagen unterstützt. Heute entwickle ich Fullstack-Anwendungen mit Tests, Security-Checks und Deployment als festem Teil der Arbeit und baue eigene Werkzeuge wie meine Android-App und das Developer Workspace Kit. ${profile.aiNote} Mein Ziel ist Software, die ein Team verstehen, weiterentwickeln und betreiben kann.`,
};
