import { TestBed } from '@angular/core/testing';
import { Contact } from './contact';

// Formal address ("Sie") is kept only in imprint and privacy (FB-12).
const formalAddress = /\b(Sie|Ihnen|Ihre?|Ihrem|Ihren)\b/;

describe('Contact', () => {
  const render = () => {
    const fixture = TestBed.createComponent(Contact);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('addresses visitors informally', () => {
    const element = render();
    expect(element.querySelector('.intro')?.textContent).toContain('Du suchst Verstärkung');
    expect(element.textContent).not.toMatch(formalAddress);
  });
});
