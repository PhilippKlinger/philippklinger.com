import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { availability, profile } from '../../../../content/profile';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  protected readonly profile = profile;
  protected readonly availability = availability;
}
