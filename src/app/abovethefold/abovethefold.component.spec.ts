import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbovethefoldComponent } from './abovethefold.component';

describe('AbovethefoldComponent', () => {
  let component: AbovethefoldComponent;
  let fixture: ComponentFixture<AbovethefoldComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AbovethefoldComponent]
    });
    fixture = TestBed.createComponent(AbovethefoldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
