import { Component, OnInit } from '@angular/core';
import { SharedService } from '../shared.service';


@Component({
  selector: 'app-main-content-navigation',
  templateUrl: './main-content-navigation.component.html',
  styleUrls: ['./main-content-navigation.component.scss']
})
export class MainContentNavigationComponent {
  constructor(private sharedService: SharedService) {}

  updateCheckboxStatus(): void {
    this.sharedService.resetCheckboxStatus();
  }
}