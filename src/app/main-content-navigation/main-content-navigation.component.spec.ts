import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainContentNavigationComponent } from './main-content-navigation.component';

describe('MainContentNavigationComponent', () => {
  let component: MainContentNavigationComponent;
  let fixture: ComponentFixture<MainContentNavigationComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MainContentNavigationComponent]
    });
    fixture = TestBed.createComponent(MainContentNavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
