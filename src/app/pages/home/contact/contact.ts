import { Component } from '@angular/core';
import { profile } from '../../../../content/profile';
import { contact } from '../../../../content/site';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class Contact {
  protected readonly profile = profile;
  protected readonly contact = contact;
}
