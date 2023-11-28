import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})

export class SharedService {
  private checkboxStatusSubject = new BehaviorSubject<boolean>(false);
  checkboxStatus$ = this.checkboxStatusSubject.asObservable();

  updateCheckboxStatus(newStatus: boolean): void {
    this.checkboxStatusSubject.next(newStatus);
  }

  resetCheckboxStatus(): void {
    this.checkboxStatusSubject.next(false);
  }

  updateHamburgerMenuStatus(newStatus: boolean): void {
    this.checkboxStatusSubject.next(newStatus);
  }

  observeIntersection(element: HTMLElement, callback: () => void): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback();
        }
      });
    });

    observer.observe(element);
  }
  
}


