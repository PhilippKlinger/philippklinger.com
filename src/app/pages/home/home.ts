import { Component } from '@angular/core';
import { About } from './about/about';
import { Contact } from './contact/contact';
import { FocusAreas } from './focus-areas/focus-areas';
import { Hero } from './hero/hero';
import { ProjectList } from './project-list/project-list';
import { SiteBuild } from './site-build/site-build';

@Component({
  selector: 'app-home',
  imports: [Hero, About, FocusAreas, ProjectList, SiteBuild, Contact],
  templateUrl: './home.html',
})
export class Home {}
