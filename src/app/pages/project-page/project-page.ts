import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Project, projectPageTexts } from '../../../content/projects';
import { EvidenceChain } from './evidence-chain/evidence-chain';

@Component({
  selector: 'app-project-page',
  imports: [EvidenceChain, RouterLink],
  templateUrl: './project-page.html',
  styleUrl: './project-page.scss',
})
export class ProjectPage {
  readonly project = input.required<Project>();
  protected readonly texts = projectPageTexts;
}
