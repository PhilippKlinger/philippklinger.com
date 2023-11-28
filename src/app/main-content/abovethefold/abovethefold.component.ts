import { Component, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-abovethefold',
  templateUrl: './abovethefold.component.html',
  styleUrls: ['./abovethefold.component.scss']
})
export class AbovethefoldComponent implements OnInit {

  constructor(private el: ElementRef, private renderer: Renderer2, private sharedService: SharedService) {}

  ngOnInit() {
    this.sharedService.observeIntersection(
      this.el.nativeElement.querySelector('.welcome-message'),
      () => {
        this.renderer.addClass(this.el.nativeElement.querySelector('.welcome-message'), 'show');  
      }
    );
  }
}
