// What Software Delivery shows per project (spec 4.2, 6.4). Keyed by slug, because projects.ts
// must stay free of value imports. Measured steps read status.json, fixed steps stay as written.
import type { DeliveryPlan, FixedStep, MeasuredStep } from './software-delivery';

type Sentences = MeasuredStep['sentences'];

// DRAFT: all sentences, wording to be approved (PK-23).
const codeSentences: Sentences = {
  verified: 'Jede Änderung ist versioniert und nachvollziehbar.',
  partial: 'Ein Teil der Repos ist nicht abrufbar.',
  deviation: 'Der Schutz des Hauptzweigs ist nicht durchgängig aktiv.',
};
const checkSentences: Sentences = {
  verified: 'Jede Änderung wird automatisch getestet und auf Schwachstellen geprüft.',
  partial: 'Ein Teil der Prüfungen ist nicht abrufbar.',
  deviation: 'Mindestens eine Prüfung lief zuletzt nicht erfolgreich.',
};
// The CI of the VPS platform starts the real stack and scans it, it runs no tests.
const platformCheckSentences: Sentences = {
  // DRAFT
  verified: 'Jede Änderung startet die echte Konfiguration und wird auf Schwachstellen geprüft.',
  partial: checkSentences.partial,
  deviation: checkSentences.deviation,
};
const signedBuildSentences: Sentences = {
  verified: 'Das Release ist signiert, seine Bestandteile sind aufgelistet.',
  partial: 'Ein Teil der Nachweise liegt vor.',
  unsigned: 'Die Bestandteile sind aufgelistet, die Signatur fehlt noch.',
  deviation: 'Für den gebauten Stand fehlt ein Herkunftsnachweis.',
  notSetUp: 'Hier steht künftig, dass das Release signiert ist.',
};
const deploymentSentences: Sentences = {
  verified: 'Live läuft genau der geprüfte Stand.',
  partial: 'Ein Teil der Dienste läuft nachweislich auf dem geprüften Stand.',
  deviation: 'Die laufende Version weicht vom zuletzt geprüften Commit ab.',
  deployRunFailed: 'Der letzte Deploy-Lauf war nicht erfolgreich.',
  // DRAFT
  deployRunOnly: 'Der letzte Deploy-Lauf war erfolgreich, der laufende Stand ist nicht abrufbar.',
  notSetUp: 'Hier steht künftig, dass live genau der geprüfte Stand läuft.',
};
const monitoringSentences: Sentences = {
  verified: 'Der Dienst wird überwacht, hier ist die Verfügbarkeit.',
  deviation: 'Mindestens ein überwachter Dienst ist gerade nicht erreichbar.',
  notSetUp: 'Hier steht künftig, ob der Dienst erreichbar ist.',
};
const restoreSentences: Sentences = {
  verified: 'Das Backup wurde wirklich eingespielt.',
  deviation: 'Der letzte Restore-Test ist fehlgeschlagen.',
  notSetUp: 'Hier steht künftig, wann ein Backup zuletzt eingespielt wurde.',
};

function privateStep(name: string, arrowToNext?: string): FixedStep {
  return {
    name,
    arrowToNext,
    state: 'private',
    sentence: 'Der Code ist privat, Läufe zeige ich im Gespräch.',
  };
}

export const deliveryPlans: Record<string, DeliveryPlan> = {
  videoflix: {
    statusKey: 'videoflix',
    runningLabel: 'Läuft in Produktion',
    repoLabels: {
      'PhilippKlinger/videoflix-backend': 'Backend',
      'PhilippKlinger/videoflix-frontend': 'Frontend',
      'PhilippKlinger/videoflix-deploy': 'Deploy',
    },
    steps: [
      {
        name: 'Code',
        arrowToNext: 'CI',
        sources: ['code'],
        setUp: true,
        sentences: codeSentences,
      },
      {
        name: 'Tests & Security-Checks',
        arrowToNext: 'Image',
        sources: ['checks'],
        setUp: true,
        sentences: checkSentences,
      },
      {
        name: 'Signed Build',
        arrowToNext: 'Deploy',
        sources: ['supplyChain'],
        setUp: true,
        sentences: signedBuildSentences,
      },
      {
        name: 'Deployment',
        arrowToNext: 'Betrieb',
        sources: ['live', 'deployRun'],
        setUp: true,
        sentences: deploymentSentences,
      },
      {
        name: 'Monitoring',
        arrowToNext: 'Backup',
        sources: ['stability'],
        setUp: false,
        sentences: monitoringSentences,
      },
      { name: 'Restore-Test', sources: ['restore'], setUp: false, sentences: restoreSentences },
    ],
  },
  'neuro-check-in': {
    statusKey: 'neuro-check-in',
    // DRAFT
    runningLabel: 'Website erreichbar',
    steps: [
      privateStep('Code', 'CI'),
      privateStep('Unit- & E2E-Tests', 'Release'),
      {
        name: 'Release im Play Store',
        state: 'verified',
        sentence: 'Die App ist öffentlich im Play Store verfügbar.',
        links: [
          {
            label: 'Im Play Store ansehen',
            url: 'https://play.google.com/store/apps/details?id=com.philippklinger.neurocheckin',
          },
        ],
      },
      { name: 'Website', sources: ['stability'], setUp: true, sentences: monitoringSentences },
    ],
  },
  // No signed build and no deployment step: the repositories build no images and the platform
  // has no version endpoint (plan VPS platform, E4).
  'vps-plattform': {
    statusKey: 'vps-plattform',
    // DRAFT
    runningLabel: 'Läuft in Produktion',
    // DRAFT
    repoLabels: {
      'PhilippKlinger/vps-edge': 'Edge-Proxy',
      'PhilippKlinger/vps-monitoring': 'Monitoring',
    },
    steps: [
      {
        name: 'Code',
        arrowToNext: 'CI',
        sources: ['code'],
        setUp: true,
        sentences: codeSentences,
      },
      {
        name: 'CI & Security-Checks',
        arrowToNext: 'Betrieb',
        sources: ['checks'],
        setUp: true,
        sentences: platformCheckSentences,
      },
      // No status page slug of its own yet (E5); rises by itself once the data proves it.
      { name: 'Betrieb', sources: ['stability'], setUp: false, sentences: monitoringSentences },
    ],
  },
  'developer-workspace-kit': {
    fixedSignal: { state: 'private', status: 'Code privat', when: '' },
    footnote: 'Öffentliches Repo folgt',
    steps: [privateStep('Code', 'CI'), privateStep('CI', 'Release'), privateStep('Release')],
  },
  // The site itself: no own data, so a restore test does not exist instead of being "not planned".
  portfolio: {
    statusKey: 'portfolio',
    runningLabel: 'Läuft in Produktion',
    steps: [
      {
        name: 'Code',
        arrowToNext: 'CI',
        sources: ['code'],
        setUp: true,
        sentences: codeSentences,
      },
      {
        name: 'Tests & Security-Checks',
        arrowToNext: 'Build',
        sources: ['checks'],
        setUp: true,
        sentences: checkSentences,
      },
      {
        name: 'Signed Build',
        arrowToNext: 'Deploy',
        sources: ['supplyChain'],
        setUp: true,
        sentences: signedBuildSentences,
      },
      {
        name: 'Deployment',
        arrowToNext: 'Betrieb',
        sources: ['live'],
        setUp: true,
        sentences: deploymentSentences,
      },
      { name: 'Monitoring', sources: ['stability'], setUp: false, sentences: monitoringSentences },
    ],
  },
};
