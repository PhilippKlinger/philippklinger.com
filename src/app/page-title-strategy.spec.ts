import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { Component } from '@angular/core';
import { PageTitleStrategy } from './page-title-strategy';

@Component({ template: '' })
class Blank {}

describe('PageTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'a',
            component: Blank,
            title: 'Seite A',
            data: { description: 'Beschreibung A' },
          },
          { path: 'b', component: Blank, title: 'Seite B' },
        ]),
        { provide: TitleStrategy, useClass: PageTitleStrategy },
      ],
    });
  });

  it('sets title and meta description from the route', async () => {
    await TestBed.inject(Router).navigateByUrl('/a');
    expect(TestBed.inject(Title).getTitle()).toBe('Seite A');
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe('Beschreibung A');
  });

  it('removes the description of the previous page when the next has none', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    expect(TestBed.inject(Meta).getTag('name="description"')).toBeNull();
  });
});
