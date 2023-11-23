// header.component.ts
import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SharedService } from '../shared.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {

  @ViewChild('navigationCheckbox', { static: false })
  navigationCheckbox?: ElementRef; // Markiere das ElementRef als optional

  private checkboxStatusSubscription!: Subscription;

  constructor(private router: Router, private sharedService: SharedService) { }

  ngOnInit(): void {
    // Abonniere den Observable für den Hamburger-Menü-Status
    this.checkboxStatusSubscription = this.sharedService.checkboxStatus$.subscribe((status: boolean) => {
      // Überprüfe, ob navigationCheckbox nicht undefined ist, bevor du darauf zugreifst
      if (this.navigationCheckbox) {
        this.navigationCheckbox.nativeElement.checked = status;
      }
    });
  }

  ngOnDestroy(): void {
    // Achte darauf, das Abonnement zu kündigen, um Speicherlecks zu vermeiden
    this.checkboxStatusSubscription.unsubscribe();
  }

  toggleNavigation() {
    // Überprüfe, ob navigationCheckbox nicht undefined ist, bevor du darauf zugreifst
    if (this.navigationCheckbox) {
      const isChecked: boolean = this.navigationCheckbox.nativeElement.checked;

      if (isChecked) {
        this.router.navigate(['navigation']);
      } else {
        this.router.navigate(['']);
      }
    }
  }
}
