import { Component, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-skills',
  templateUrl: './skills.component.html',
  styleUrls: ['./skills.component.scss'],
})

export class SkillsComponent implements OnInit {

  icons = [
    './assets/icons/python.svg',
    './assets/icons/django.svg',
    './assets/icons/api.svg',
    './assets/icons/postgresql.svg',
    './assets/icons/redis.svg',
    './assets/icons/docker.svg',
    './assets/icons/linux.svg',
    './assets/icons/git.svg',
    './assets/icons/angular.svg',
    './assets/icons/ts.svg',
    './assets/icons/js.svg',
    './assets/icons/html.svg',
    './assets/icons/css.svg',
    './assets/icons/material.svg',
    './assets/icons/firebase.svg',
  ];

  skills = [
    'Python', 'Django', 'REST‑API',
    'PostgreSQL', 'Redis',
    'Docker', 'Linux', 'Git',
    'Angular', 'TypeScript', 'JavaScript',
    'HTML', 'CSS', 'Angular Material',
    'Firebase'
  ];

  constructor(private el: ElementRef, private renderer: Renderer2, private sharedService: SharedService) { }

  ngOnInit(): void {
    this.sharedService.observeIntersection(
      this.el.nativeElement.querySelector('.skills-content-section'),
      () => {

        this.renderer.addClass(this.el.nativeElement.querySelector('.skills-content-section'), 'show');
        this.icons.forEach((icon, index) => {
          const iconElement = this.el.nativeElement.querySelector(`#icon-${index}`);
          this.renderer.addClass(iconElement, 'show');
        });


      }
    );
  }
}







// falls die animation on scroll immer von vorne begnnen soll :

// import { Component, ElementRef, Renderer2, OnInit } from '@angular/core';

// @Component({
//   selector: 'app-skills',
//   templateUrl: './skills.component.html',
//   styleUrls: ['./skills.component.scss'],
// })
// export class SkillsComponent implements OnInit {
//   icons = ['./assets/icons/angular.svg', /* ... deine anderen Icons ... */];
//   skills = ['Agular', /* ... deine anderen Skills ... */];

//   constructor(private el: ElementRef, private renderer: Renderer2) {}

//   ngOnInit() {
//     const observer = new IntersectionObserver((entries) => {
//       entries.forEach((entry) => {
//         if (entry.isIntersecting) {
//           this.icons.forEach((icon, index) => {
//             const iconElement = this.el.nativeElement.querySelector(`#icon-${index}`);
//             this.renderer.addClass(iconElement, 'show');
//           });
//         } else {
//           // Wenn die Komponente den Viewport verlässt, entferne die Klasse "show"
//           this.icons.forEach((icon, index) => {
//             const iconElement = this.el.nativeElement.querySelector(`#icon-${index}`);
//             this.renderer.removeClass(iconElement, 'show');
//           });
//         }
//       });
//     });

//     // Beobachte das Container-Element (skills-content-section)
//     observer.observe(this.el.nativeElement);
//   }
// }

