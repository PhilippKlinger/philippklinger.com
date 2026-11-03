import { NgTemplateOutlet } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { projects } from '../../../../content/projects';

@Component({
  selector: 'app-project-list',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList {
  protected readonly projects = projects;
}
