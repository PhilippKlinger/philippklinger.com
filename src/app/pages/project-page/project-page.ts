import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Project, projectPageTexts } from '../../../content/projects';

@Component({
  selector: 'app-project-page',
  imports: [RouterLink],
  templateUrl: './project-page.html',
  styleUrl: './project-page.scss',
})
export class ProjectPage {
  readonly project = input.required<Project>();
  protected readonly texts = projectPageTexts;
}
