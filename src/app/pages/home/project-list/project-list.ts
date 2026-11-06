import { Component, inject } from '@angular/core';
import { projects } from '../../../../content/projects';
import { DeliveryStatus } from '../../../delivery/delivery-status';
import { ProjectCard } from './project-card/project-card';
import { ReportCard } from './report-card/report-card';

@Component({
  selector: 'app-project-list',
  imports: [ProjectCard, ReportCard],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList {
  protected readonly status = inject(DeliveryStatus);
  protected readonly projects = projects;
}
