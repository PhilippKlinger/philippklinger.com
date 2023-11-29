import { Component, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-description',
  templateUrl: './description.component.html',
  styleUrls: ['./description.component.scss']
})
export class DescriptionComponent implements OnInit {

  constructor(private el: ElementRef, private renderer: Renderer2, private sharedService: SharedService) {}

  ngOnInit() {
    this.sharedService.observeIntersection(
      this.el.nativeElement.querySelector('.description-section'),
      () => {
        this.renderer.addClass(this.el.nativeElement.querySelector('.description-section-content-right'), 'show');  
        this.renderer.addClass(this.el.nativeElement.querySelector('h2'), 'show');  
        setTimeout(() => {
          this.renderer.addClass(this.el.nativeElement.querySelector('.description-section-content-left'), 'show');  
        }, 200); 
      }
    );
  }
  
}
