import { profile } from '../../../content/profile';
import { docsUrl, siteUrl } from '../../../content/site';
import { profilePageSchema } from './profile-page-schema';

describe('profilePageSchema', () => {
  const schema = profilePageSchema();

  it('describes the start page as a ProfilePage of a Person', () => {
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('ProfilePage');
    expect(schema.url).toBe(`${siteUrl}/`);
    expect(schema.mainEntity['@type']).toBe('Person');
  });

  it('takes name, role and portrait from the content files', () => {
    expect(schema.mainEntity.name).toBe(profile.name);
    expect(schema.mainEntity.jobTitle).toBe(profile.role);
    expect(schema.mainEntity.image).toBe(`${siteUrl}/images/portrait.webp`);
  });

  it('links GitHub, LinkedIn and the documentation as sameAs', () => {
    expect(schema.mainEntity.sameAs).toEqual([profile.github, profile.linkedin, docsUrl]);
  });
});
