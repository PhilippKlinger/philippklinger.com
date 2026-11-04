import { Component } from '@angular/core';
import { focusAreas } from '../../../../content/focus-areas';
import { toolIcons } from '../../../../content/tool-icons';

@Component({
  selector: 'app-focus-areas',
  templateUrl: './focus-areas.html',
  styleUrl: './focus-areas.scss',
})
export class FocusAreas {
  protected readonly focusAreas = focusAreas;
  protected readonly toolIcons = toolIcons;
}
