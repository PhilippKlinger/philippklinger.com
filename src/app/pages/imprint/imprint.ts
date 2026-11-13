import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { address, legalBack, imprint } from '../../../content/legal';
import { profile } from '../../../content/profile';

@Component({
  selector: 'app-imprint',
  templateUrl: './imprint.html',
  imports: [RouterLink],
  styleUrl: './imprint.scss',
})
export class Imprint {
  protected readonly address = address;
  protected readonly back = legalBack;
  protected readonly imprint = imprint;
  protected readonly email = profile.email;
}
