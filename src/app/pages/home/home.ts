import { Component } from '@angular/core';
import { About } from './about/about';
import { FocusAreas } from './focus-areas/focus-areas';
import { Hero } from './hero/hero';
import { ProjectList } from './project-list/project-list';

@Component({
  selector: 'app-home',
  imports: [Hero, About, FocusAreas, ProjectList],
  templateUrl: './home.html',
})
export class Home {}
