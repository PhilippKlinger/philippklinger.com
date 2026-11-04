import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { profile } from '../../../content/profile';
import { docsUrl, repositoryUrl } from '../../../content/site';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  protected readonly profile = profile;
  protected readonly repositoryUrl = repositoryUrl;
  protected readonly docsUrl = docsUrl;
  protected readonly year = new Date().getFullYear();
}
