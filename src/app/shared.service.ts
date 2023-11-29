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

  observeIntersection(element: HTMLElement, callback: () => void, offset: string = "0px"): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback();
        }
      });
    }, {
      rootMargin: '-400px' // Hier kannst du einen Offset in Pixeln oder Prozent angeben
    });
  
    observer.observe(element);
  }
  
  
}


