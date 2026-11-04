import { Component } from '@angular/core';
import { address, imprint } from '../../../content/legal';
import { profile } from '../../../content/profile';

@Component({
  selector: 'app-imprint',
  templateUrl: './imprint.html',
  styleUrl: './imprint.scss',
})
export class Imprint {
  protected readonly address = address;
  protected readonly imprint = imprint;
  protected readonly email = profile.email;
}
