import { profile } from '../../../content/profile';
import { docsUrl, siteUrl } from '../../../content/site';

/** schema.org ProfilePage of the start page, built from the content files (spec 3.2). */
export function profilePageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `${siteUrl}/`,
    inLanguage: 'de',
    mainEntity: {
      '@type': 'Person',
      name: profile.name,
      jobTitle: profile.role,
      url: `${siteUrl}/`,
      image: `${siteUrl}/images/portrait.webp`,
      sameAs: [profile.github, profile.linkedin, docsUrl],
    },
  };
}
