// Texts of /impressum and /datenschutz; only verifiable facts.

// Current postal address (Philipp, 2026-11-04).
export const address = ['Philipp Klinger', 'Ostlandstraße 11', '49504 Lotte'];

// DRAFT: label of the way back from both legal pages (S10).
export const legalBack = 'Zurück zur Startseite';

export const imprint = {
  providerHeading: 'Angaben gemäß § 5 DDG',
  contactHeading: 'Kontakt',
};

export const privacy = {
  version: 'Stand: November 2026',
  intro:
    'Diese Website setzt keine Cookies, nutzt keine Analyse- oder Tracking-Werkzeuge und lädt keine Inhalte von Drittanbietern. Schriften und Bilder kommen vom selben Server wie die Seite. Im Folgenden steht, welche Daten trotzdem anfallen und was mit ihnen geschieht.',
  controllerHeading: 'Verantwortlicher',
  sections: [
    {
      heading: 'Hosting und Server-Logfiles',
      paragraphs: [
        'Die Website liegt bei ALL-INKL.COM – Neue Medien Münnich, Inhaber René Münnich, Hauptstraße 68, 02742 Friedersdorf, Deutschland. Beim Aufruf der Website erfasst der Server automatisch Informationen in Server-Logdateien, die Ihr Browser übermittelt:',
      ],
      items: [
        'IP-Adresse des anfragenden Geräts',
        'Datum und Uhrzeit des Aufrufs',
        'aufgerufene Adresse und übertragene Datenmenge',
        'zuvor besuchte Seite (Referrer), falls übermittelt',
        'Browser-Typ und Betriebssystem (User-Agent)',
      ],
    },
    {
      heading: 'Zweck, Rechtsgrundlage und Speicherdauer',
      paragraphs: [
        'Die Logdateien dienen dazu, die Website auszuliefern, ihre Stabilität und Sicherheit zu gewährleisten und Missbrauch abzuwehren. Rechtsgrundlage ist mein berechtigtes Interesse an einem sicheren und stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO).',
        'Die Logdaten werden im Rahmen der üblichen Server-Logrotation des Hosters kurzfristig gespeichert und anschließend automatisch gelöscht.',
        'Mit dem Hoster besteht ein Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO auf Basis der EU-Standardvertragsklauseln.',
      ],
    },
    {
      heading: 'Kontakt per E-Mail',
      paragraphs: [
        'Wenn Sie mir eine E-Mail schreiben, verarbeite ich Ihre Adresse und Ihre Nachricht, um Ihre Anfrage zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, wenn es um eine Anstellung oder einen Auftrag geht, sonst mein berechtigtes Interesse an der Antwort (Art. 6 Abs. 1 lit. f DSGVO). Das Postfach liegt ebenfalls bei ALL-INKL.COM. Ich lösche die Nachricht, wenn die Anfrage erledigt ist und keine gesetzliche Aufbewahrungspflicht besteht.',
      ],
    },
    // DRAFT: wording of the sessionStorage paragraph, not yet approved.
    {
      heading: 'Scrollposition im Browser',
      paragraphs: [
        'Die Startseite merkt sich im sessionStorage Ihres Browsers nur die Scrollposition, damit Sie nach dem Zurückgehen an derselben Stelle weiterlesen können. Der Wert wird nicht an den Server übertragen, er verlässt Ihr Gerät nicht und wird gelöscht, wenn die Browser-Sitzung des Tabs endet. Es werden keine Cookies gesetzt und nichts davon dient dem Tracking.',
      ],
    },
    {
      heading: 'Links zu GitHub und LinkedIn',
      paragraphs: [
        'Die Seite verlinkt auf meine Profile bei GitHub und LinkedIn. Erst wenn Sie einen solchen Link anklicken, verlassen Sie diese Seite; ab dann gelten die Datenschutzerklärungen der jeweiligen Anbieter.',
      ],
    },
    {
      heading: 'Ihre Rechte',
      paragraphs: [
        'Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage eines berechtigten Interesses (Art. 21). Eine E-Mail an die oben genannte Adresse genügt.',
        'Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.',
      ],
    },
  ],
};
