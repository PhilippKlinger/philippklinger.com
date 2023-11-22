import { Component, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { SharedService } from '../shared.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {

  @ViewChild('navigationCheckbox')
  navigationCheckbox!: ElementRef;

  constructor(private router: Router, private sharedService: SharedService) { }

  toggleNavigation() {
    const isChecked: boolean = this.navigationCheckbox.nativeElement.checked;

    if (isChecked) {
      this.router.navigate(['navigation']);
    } else {
      this.router.navigate(['']);
    }

    this.sharedService.updateCheckboxStatus(!isChecked);
  }
}
