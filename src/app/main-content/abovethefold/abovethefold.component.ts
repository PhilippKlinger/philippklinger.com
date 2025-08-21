import { Component, ElementRef, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-abovethefold',
  templateUrl: './abovethefold.component.html',
  styleUrls: ['./abovethefold.component.scss']
})
export class AbovethefoldComponent implements OnInit, OnDestroy {
  phrases = [
    'AI-Driven Development',
    'IT Enthusiast',
    'Freelancing Digital Nomad',
    'Embracing DevSecOps'
  ];

  private phraseDuration = 2200;
  private typingSpeed = 50;
  private deletingSpeed = 35;
  private endOfPhrasePause = 1300;
  private startNextPhraseDelay = 250;

  visibleText = '';
  private iPhrase = 0;
  private typingTimer: any;
  private deleting = false;
  private prefersReduced =
    typeof window !== 'undefined'
      ? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
      : false;


  constructor(private el: ElementRef, private renderer: Renderer2, private sharedService: SharedService) { }

  ngOnInit() {
    this.sharedService.observeIntersection(
      this.el.nativeElement.querySelector('.welcome-message'),
      () => {
        this.renderer.addClass(this.el.nativeElement.querySelector('.welcome-message'), 'show');
        this.renderer.addClass(this.el.nativeElement.querySelector('.welcome-section-email'), 'show');
        this.renderer.addClass(this.el.nativeElement.querySelector('.welcome-section-scroll-down'), 'show');
      }
    );

    if (this.prefersReduced) {
      this.visibleText = this.phrases[0];
      this.rotateWithoutTyping();
    } else {
      this.tickType();
    }
  }

  ngOnDestroy() {
    clearTimeout(this.typingTimer);
  }

  private rotateWithoutTyping() {
    const next = () => {
      this.iPhrase = (this.iPhrase + 1) % this.phrases.length;
      this.visibleText = this.phrases[this.iPhrase];
      this.typingTimer = setTimeout(next, this.phraseDuration);
    };
    this.typingTimer = setTimeout(next, this.phraseDuration);
  }

  private tickType() {
    const full = this.phrases[this.iPhrase];

    if (!this.deleting) {
      this.visibleText = full.slice(0, this.visibleText.length + 1);

      if (this.visibleText === full) {
        this.typingTimer = setTimeout(() => {
          this.deleting = true;
          this.tickType();
        }, this.endOfPhrasePause);
        return;
      }

      this.typingTimer = setTimeout(() => this.tickType(), this.typingSpeed);
    } else {
      this.visibleText = full.slice(0, this.visibleText.length - 1);

      if (this.visibleText.length === 0) {
        this.deleting = false;
        this.iPhrase = (this.iPhrase + 1) % this.phrases.length;
        this.typingTimer = setTimeout(() => this.tickType(), this.startNextPhraseDelay);
        return;
      }

      this.typingTimer = setTimeout(() => this.tickType(), this.deletingSpeed);
    }
  }
}