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
}
