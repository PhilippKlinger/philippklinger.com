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
      title: 'Videoflix',
      technologies: 'Python | Django | Docker',
      description: 'A Netflix-inspired streaming platform to watch movies and series online. Users can browse categories, view details, and stream videos seamlessly. The project demonstrates backend-focused fullstack development with user authentication, JWT-based sessions, and media streaming functionality.',
      githubLink: 'https://github.com/PhilippKlinger/videoflix-backend',
      liveLink: 'https://videoflix.philipp-klinger.com/',
      imageUrl: './assets/projects/videoflix.png'
    },
    {
      id: 2,
      title: 'DA Bubble',
      technologies: 'Angular | TypeScript | Firebase',
      description: 'A Slack-inspired chat messenger enabling real-time communication. Teams can collaborate in public or private channels, exchange messages and files, and boost productivity. Built with Angular, TypeScript and Firebase for authentication and live data sync.',
      githubLink: 'https://github.com/PhilippKlinger/DABubble',
      liveLink: 'https://dabubble.philipp-klinger.com/index.html',
      imageUrl: './assets/projects/dabubble.png'
    },
     {
      id: 3,
      title: 'Coderr',
      technologies: 'Python | Django | Docker',
      description: 'A service marketplace platform inspired by Upwork. Customers can register, browse offers, place orders, and leave reviews. Built with Django Rest Framework, featuring authentication, role-based access and a scalable backend.',
      githubLink: 'https://github.com/PhilippKlinger/coderr_backend',
      liveLink: 'https://coderr.philipp-klinger.com/',
      imageUrl: './assets/projects/coderr.png'
    },
    {
      id: 4,
      title: 'Join',
      technologies: 'JavaScript | HTML | CSS',
      description: 'A Kanban-style task manager to organize and track projects. Users can create tasks, assign categories and team members, and manage them easily with drag & drop. Built with vanilla JavaScript to demonstrate clean OOP and DOM manipulation.',
      githubLink: 'https://github.com/PhilippKlinger/Join',
      liveLink: 'https://join.philipp-klinger.com/templates/html/login.html',
      imageUrl: './assets/projects/join.png'
    },
    {
      id: 5,
      title: 'Browsergame',
      technologies: 'JavaScript | OOP | HTML | CSS',
      description: 'A 2D browser adventure game written in JavaScript. Guide a Mayan hero through jungle challenges, avoid enemies and collect items. Built with object-oriented programming to handle game logic, animations and interactions.',
      githubLink: 'https://github.com/PhilippKlinger/Browsergame',
      liveLink: 'https://elmayavaliente.philipp-klinger.com/index.html',
      imageUrl: './assets/projects/browsergame.png'
    },
  ];

  isReverse = false;

  toggleDisplayMode() {
    this.isReverse = !this.isReverse;
  }

  constructor(private el: ElementRef, private renderer: Renderer2, private sharedService: SharedService) { }

  ngOnInit() {
    this.sharedService.observeIntersection(
      this.el.nativeElement.querySelector('.portfolio-section'),
      () => {
        this.renderer.addClass(this.el.nativeElement.querySelector('.portfolio-section-head'), 'show');

      }
    );
  }

}
