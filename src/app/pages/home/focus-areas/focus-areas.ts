import { Component } from '@angular/core';
import { focusAreas } from '../../../../content/focus-areas';

@Component({
  selector: 'app-focus-areas',
  templateUrl: './focus-areas.html',
  styleUrl: './focus-areas.scss',
})
export class FocusAreas {
  protected readonly focusAreas = focusAreas;
}
