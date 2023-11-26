import { Component } from '@angular/core';

@Component({
  selector: 'app-portfolio',
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss']
})
export class PortfolioComponent {
  projects = [
    {
      id: 1,
      title: 'Join',
      technologies: 'Angular | TypeScript | HTML | CSS',
      description: 'Task manager inspired by the Kanban System. Create and organize tasks using drag and drop functions, assign users and categories',
      githubLink: 'https://github.com/yourusername/join',
      liveLink: 'https://yourwebsite.com/join',
      imageUrl: './assets/projects/mayavaliente.png'
    },
    {
      id: 2,
      title: 'Browsergame',
      technologies: 'Angular | TypeScript | HTML | CSS',
      description: 'Jump and Run Browsergame',
      githubLink: 'https://github.com/yourusername/join',
      liveLink: 'https://yourwebsite.com/join',
      imageUrl: './assets/projects/mayavaliente.png'
    },
    {
      id: 3,
      title: 'DA Bubble',
      technologies: 'Angular | TypeScript | HTML | CSS',
      description: 'Jump and Run Browsergame',
      githubLink: 'https://github.com/yourusername/join',
      liveLink: 'https://yourwebsite.com/join',
      imageUrl: './assets/projects/mayavaliente.png'
    },
    {
      id: 4,
      title: 'Simple Crm',
      technologies: 'Angular | TypeScript | HTML | CSS',
      description: 'Jump and Run Browsergame',
      githubLink: 'https://github.com/yourusername/join',
      liveLink: 'https://yourwebsite.com/join',
      imageUrl: './assets/projects/mayavaliente.png'
    },
  ];

  isReverse = false;

  toggleDisplayMode() {
    this.isReverse = !this.isReverse;
  }
  
}
