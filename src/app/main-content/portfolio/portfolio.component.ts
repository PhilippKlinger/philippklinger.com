import { Component, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-portfolio',
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss']
})
export class PortfolioComponent implements OnInit {
  projects = [
    {
      id: 1,
      title: 'Join',
      technologies: 'JavaScript | HTML | CSS',
      description: 'Task manager inspired by the Kanban System. Create and organize tasks using drag and drop functions, assign users and categories',
      githubLink: 'https://github.com/PhilippKlinger/Join',
      liveLink: 'https://projectsphilipp.leahannich.de/Join/templates/html/login.html',
      imageUrl: './assets/projects/join.png'
    },
    {
      id: 2,
      title: 'Browsergame',
      technologies: 'JavaScript | HTML | CSS',
      description: 'Jump and Run Browsergame',
      githubLink: 'https://github.com/PhilippKlinger/Browsergame',
      liveLink: 'https://projectsphilipp.leahannich.de/browsergame/index.html',
      imageUrl: './assets/projects/mayavaliente.png'
    },
    {
      id: 3,
      title: 'Pokedex',
      technologies: 'JavaScript | HTML | CSS | API',
      description: 'Pokedex',
      githubLink: 'https://github.com/PhilippKlinger/Pokedex',
      liveLink: 'https://projectsphilipp.leahannich.de/Pokedex/index.html',
      imageUrl: './assets/projects/pokedex.png'
    },
    {
      id: 4,
      title: 'DA Bubble',
      technologies: 'Angular | TypeScript | HTML | CSS',
      description: 'Work in Progress',
      githubLink: 'https://github.com/yourusername/join',
      liveLink: 'https://yourwebsite.com/join',
      imageUrl: './assets/projects/da-bubble.jpg'
    },
  ];

  isReverse = false;

  toggleDisplayMode() {
    this.isReverse = !this.isReverse;
  }

  constructor(private el: ElementRef, private renderer: Renderer2, private sharedService: SharedService) {}

  ngOnInit() {
    this.sharedService.observeIntersection(
      this.el.nativeElement.querySelector('.portfolio-section'),
      () => {
        this.renderer.addClass(this.el.nativeElement.querySelector('.portfolio-section-head'), 'show');  
       
      }
    );
  }
  
}
