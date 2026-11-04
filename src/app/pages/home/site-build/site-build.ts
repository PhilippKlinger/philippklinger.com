import { Component } from '@angular/core';
import { siteBuild } from '../../../../content/site';

@Component({
  selector: 'app-site-build',
  templateUrl: './site-build.html',
  styleUrl: './site-build.scss',
})
export class SiteBuild {
  protected readonly siteBuild = siteBuild;
}
