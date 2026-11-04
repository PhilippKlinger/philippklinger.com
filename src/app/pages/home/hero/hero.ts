import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { profile } from '../../../../content/profile';
import { Band } from './band/band';

@Component({
  selector: 'app-hero',
  imports: [RouterLink, Band],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  protected readonly profile = profile;
}
