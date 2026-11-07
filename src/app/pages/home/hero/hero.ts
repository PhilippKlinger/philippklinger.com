import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { profile } from '../../../../content/profile';
import { HeroPipelineView } from './pipeline/hero-pipeline-view';

@Component({
  selector: 'app-hero',
  imports: [RouterLink, HeroPipelineView],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  protected readonly profile = profile;
  // One line on wide screens; on a phone each part gets its own, without a dot at the line end.
  protected readonly roleParts = profile.role.split(' · ');
}
