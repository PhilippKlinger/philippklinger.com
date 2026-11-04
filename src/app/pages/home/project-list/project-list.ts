import { NgTemplateOutlet } from '@angular/common';
import { Component } from '@angular/core';
import { projects } from '../../../../content/projects';

@Component({
  selector: 'app-project-list',
  imports: [NgTemplateOutlet],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList {
  protected readonly projects = projects;
}
