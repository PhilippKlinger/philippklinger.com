import { Component, Input, ElementRef, AfterViewInit, Renderer2 } from '@angular/core';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.scss']
})
export class ProjectComponent implements AfterViewInit {
  @Input() project: any;
  @Input() projects!: any[];
  @Input() isReversed: boolean = false;

  constructor(private el: ElementRef, private renderer: Renderer2, private sharedService: SharedService) { }

  ngAfterViewInit() {
    const projectId = this.project.id;
    const projectElement = this.el.nativeElement.querySelector(`.project-${projectId}`);

    this.sharedService.observeIntersection(
      projectElement,
      () => {
        
          this.renderer.addClass(projectElement, 'show');
    
      }
    );
  }
}
