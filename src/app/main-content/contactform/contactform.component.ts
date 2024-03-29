import { Component, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-contact-form',
  templateUrl: './contactform.component.html',
  styleUrls: ['./contactform.component.scss']
})
export class ContactFormComponent implements OnInit {

  contactForm!: FormGroup;
  isFormSubmitted = false;
  isSubmitting = false;
  successPopupVisible = false;

  constructor(private formBuilder: FormBuilder, private el: ElementRef, private renderer: Renderer2, private sharedService: SharedService) { }

  ngOnInit(): void {
    this.contactForm = this.formBuilder.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(20)]],
      privacy: [false, Validators.requiredTrue]
    });

    this.sharedService.observeIntersection(
      this.el.nativeElement.querySelector('.contactform-section'),
      () => {
        this.renderer.addClass(this.el.nativeElement.querySelector('.contactform-section'), 'show');  
       
      }
    );
  }

  async onSubmit(): Promise<void> {
    try {
      if (this.contactForm.valid) {
        this.contactForm.disable();
        this.isFormSubmitted = true;
        this.isSubmitting = true;
        const formData = JSON.stringify(this.contactForm.value);
        const response = await fetch('https://philipp-klinger.com/send_mail.php', {
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: formData
        });
        if (!response.ok) {
          throw new Error('Failed to submit the form.');
        }
      }
    } catch (error) {
      console.error('Error submitting the form:', error);
    } finally {
      this.successPopupVisible = true;
      setTimeout(() => {
        this.contactForm.reset();
        this.contactForm.enable();
        this.isSubmitting = false;
        this.successPopupVisible = false;
      }, 2000);
    }
  }
}
