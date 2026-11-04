import { Component } from '@angular/core';
import { address, privacy } from '../../../content/legal';
import { profile } from '../../../content/profile';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.html',
  styleUrl: './privacy.scss',
})
export class Privacy {
  protected readonly address = address;
  protected readonly privacy = privacy;
  protected readonly email = profile.email;
}
