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

// DRAFT: availability line below the hero, wording to be approved.
export const availability = [
  'Offen für Festanstellung',
  'DevSecOps & Fullstack',
  'Remote oder hybrid',
  'Verfügbar ab sofort',
];

export const navigation = [
  { label: 'Über mich', fragment: 'ueber-mich' },
  { label: 'Skills', fragment: 'skills' },
  { label: 'Projekte', fragment: 'projekte' },
  { label: 'Kontakt', fragment: 'kontakt' },
];

// DRAFT: about section, wording to be approved. Facts follow the final CV.
export const about = {
  intro:
    'Ich entwickle Webanwendungen vom Frontend bis zum Backend und sorge dafür, dass sie sicher und nachvollziehbar deployt werden. Aus über vier Jahren im Field Service für komplexe Fahrzeugprüfsysteme bringe ich systematische Fehleranalyse unter Druck mit.',
  points: [
    'Offen für Remote, hybrid oder vor Ort, ab sofort verfügbar.',
    // The approved AI sentence lives here instead of the hero (Grill 2026-11-04).
    profile.aiNote,
    'Aus dem Field Service kenne ich Troubleshooting an Systemen, die laufen müssen.',
  ],
};
