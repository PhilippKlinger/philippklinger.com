import { Component } from '@angular/core';

@Component({
  selector: 'app-skills',
  templateUrl: './skills.component.html',
  styleUrls: ['./skills.component.scss'],
})
export class SkillsComponent {
  icons = ['./assets/icons/angular.svg',
    './assets/icons/ts.svg',
    './assets/icons/js.svg',
    './assets/icons/html.svg',
    './assets/icons/css.svg',
    './assets/icons/firebase.svg',
    './assets/icons/git.svg',
    './assets/icons/scrum.svg',
    './assets/icons/api.svg',
    './assets/icons/material.svg',];
  skills = ['Agular', 'Typescript',
    'JavaScript', 'HTML', 'CSS',
    'Firebase', 'Git', 'Scrum',
    'Rest-Api', 'Material'];

}
