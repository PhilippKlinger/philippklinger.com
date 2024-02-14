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
      title: 'DA Bubble',
      technologies: 'Angular | TypeScript | Firebase',
      description: 'Slack-inspired chat messenger. Collaborate in teams, increase productivity while communicating and sharing files in channels or direct messages.',
      githubLink: 'https://github.com/PhilippKlinger/DABubble',
      liveLink: 'https://dabubble.philipp-klinger.com/index.html',
      imageUrl: './assets/projects/dabubble.svg'
    },
    {
      id: 2,
      title: 'Browsergame',
      technologies: 'JavaScript | OOP | HTML | CSS',
      description: 'Immerse yourself in the thrilling adventure of a courageous Mayan as you navigate the perilous path through the jungle. Only with your skill can your hero successfully overcome all challenges.',
      githubLink: 'https://github.com/PhilippKlinger/Browsergame',
      liveLink: 'https://elmayavaliente.philipp-klinger.com/index.html',
      imageUrl: './assets/projects/browsergame.svg'
    },
    {
      id: 3,
      title: 'Join',
      technologies: 'JavaScript | HTML | CSS',
      description: 'Task manager inspired by the Kanban System. Create and organize tasks using drag and drop functions, assign users and categories.',
      githubLink: 'https://github.com/PhilippKlinger/Join',
      liveLink: 'https://join.philipp-klinger.com/templates/html/login.html',
      imageUrl: './assets/projects/join.svg'
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
