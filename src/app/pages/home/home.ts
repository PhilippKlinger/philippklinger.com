import { Component } from '@angular/core';
import { About } from './about/about';
import { FocusAreas } from './focus-areas/focus-areas';
import { Hero } from './hero/hero';

@Component({
  selector: 'app-home',
  imports: [Hero, About, FocusAreas],
  templateUrl: './home.html',
})
export class Home {}
