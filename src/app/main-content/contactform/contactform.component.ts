import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-contact-form',
  templateUrl: './contactform.component.html',
  styleUrls: ['./contactform.component.scss']
})
export class ContactFormComponent implements OnInit {

  contactForm!: FormGroup;

  constructor(private formBuilder: FormBuilder) { }

  ngOnInit(): void {
    this.contactForm = this.formBuilder.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      message: ['', Validators.required],
      privacy: [false, Validators.requiredTrue]
    });
  }

  async onSubmit(): Promise<void> {
    if (this.contactForm.valid) {
      this.contactForm.disable();

      let fd = new FormData();
          fd.append('name', this.contactForm.get('name')?.value || ''); // Hier wird der Wert des Formularfelds 'name' abgerufen
          fd.append('email', this.contactForm.get('email')?.value || ''); // Hier wird der Wert des Formularfelds 'email' abgerufen
          fd.append('message', this.contactForm.get('message')?.value || ''); // Hier wird der Wert des Formularfelds 'message' abgerufen
      

      // Sende die Formulardaten an den Server
      await fetch('https://philipp-klinger.developerakademie.net/portfolio/send_mail.php', {
        method: 'POST',
          body: fd,
          // mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
      })
      // .then(response => {
      //   // Überprüfe den Erfolg der Serverantwort
      //   if (!response.ok) {
      //     throw new Error(`Server error: ${response.statusText}`);
      //   }
      //   return response.json();
      // })
      .then(data => {
        // Hier kannst du mit der Serverantwort (data) arbeiten
        console.log(data);
      })
      .catch(error => {
        console.error('Error:', error);
      })
      .finally(() => {
        // Setze das Formular nach 5 Sekunden zurück und aktiviere es wieder
        setTimeout(() => {
          this.contactForm.reset();
          this.contactForm.enable();
        }, 5000);
      });
    }
  }
}



// import { Component, OnInit } from '@angular/core';
// import { FormBuilder, FormGroup, Validators } from '@angular/forms';

// @Component({
//   selector: 'app-contact-form',
//   templateUrl: './contactform.component.html',
//   styleUrls: ['./contactform.component.scss']
// })
// export class ContactFormComponent implements OnInit {

//   contactForm!: FormGroup;

//   constructor(private formBuilder: FormBuilder) { }

//   ngOnInit(): void {
//     this.contactForm = this.formBuilder.group({
//       name: ['', Validators.required],
//       email: ['', [Validators.required, Validators.email]],
//       message: ['', Validators.required],
//       privacy: [false, Validators.requiredTrue]
//     });
//   }

//   async onSubmit(): Promise<void> {
//     if (this.contactForm.valid) {
//       this.contactForm.disable();
//       setTimeout(() => {
//         this.contactForm.reset();
//         this.contactForm.enable();
//       }, 5000);
//       console.log(this.contactForm.value);

//       let fd = new FormData();
//     fd.append('name', this.contactForm.get('name')?.value || ''); // Hier wird der Wert des Formularfelds 'name' abgerufen
//     fd.append('email', this.contactForm.get('email')?.value || ''); // Hier wird der Wert des Formularfelds 'email' abgerufen
//     fd.append('message', this.contactForm.get('message')?.value || ''); // Hier wird der Wert des Formularfelds 'message' abgerufen

//       await fetch('https://philipp-klinger.developerakademie.net/portfolio/send_mail.php',
//       {
//         method: 'POST',
//         headers: {
//           'Content-type' : 'application/json'
//         },
//         body: fd,
//         mode: 'no-cors'
       
//       }
      
//       )
//     }
//   }

// }
