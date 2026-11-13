import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { address, legalBack, privacy } from '../../../content/legal';
import { profile } from '../../../content/profile';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.html',
  imports: [RouterLink],
  styleUrl: './privacy.scss',
})
export class Privacy {
  protected readonly address = address;
  protected readonly back = legalBack;
  protected readonly privacy = privacy;
  protected readonly email = profile.email;
}
