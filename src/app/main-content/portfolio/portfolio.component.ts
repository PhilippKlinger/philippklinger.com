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
      liveLink: 'https://join.philipp-klinger.com/templates/html/login.html',
      imageUrl: './assets/projects/join.png'
    },
    {
      id: 2,
      title: 'Browsergame',
      technologies: 'JavaScript | HTML | CSS',
      description: 'Immerse yourself in the thrilling adventure of a courageous Mayan as you navigate the perilous path through the jungle. Only with your skill can your hero successfully overcome all challenges.',
      githubLink: 'https://github.com/PhilippKlinger/Browsergame',
      liveLink: 'https://elmayavaliente.philipp-klinger.com/index.html',
      imageUrl: './assets/projects/mayavaliente.png'
    },
    {
      id: 3,
      title: 'Pokedex',
      technologies: 'JavaScript | HTML | CSS | API',
      description: 'An online app has been designed to offer a Pokédex-like experience by accessing a database through an API. Users can explore and gather information about various items within the database, similar to how a Pokédex provides details about different Pokémon.',
      githubLink: 'https://github.com/PhilippKlinger/Pokedex',
      liveLink: 'https://pokedex.philipp-klinger.com/index.html',
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
