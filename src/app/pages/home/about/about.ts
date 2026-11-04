import { Component } from '@angular/core';
import { about } from '../../../../content/profile';

@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  protected readonly about = about;
}
