import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-contact-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './contact-support.component.html',
  styleUrls: ['./contact-support.component.scss']
})
export class ContactSupportComponent implements OnInit {
  contactForm!: FormGroup;
  sending = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', [Validators.required]],
      message: ['', [Validators.required]]
    });
  }

  sendEmail(): void {
    if (this.contactForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.contactForm.controls).forEach(key => {
        this.contactForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.sending = true;
    this.successMessage = '';
    this.errorMessage = '';

    const emailData = {
      to: 'pizzaworldplus@proton.me',
      from: this.contactForm.value.email,
      senderName: this.contactForm.value.name,
      subject: `Support Request: ${this.contactForm.value.subject}`,
      message: `
        Name: ${this.contactForm.value.name}
        Email: ${this.contactForm.value.email}
        Subject: ${this.contactForm.value.subject}

        Message:
        ${this.contactForm.value.message}
      `
    };

    // Send email through backend API
    this.http.post('/api/send-support-email', emailData).subscribe({
      next: () => {
        this.sending = false;
        this.successMessage = 'Your message has been sent successfully! Our support team will get back to you soon.';
        this.contactForm.reset();

        // Clear success message after 5 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
      },
      error: (error) => {
        this.sending = false;
        this.errorMessage = 'Failed to send email. Please try again later or contact support directly at pizzaworldplus@proton.me';
        console.error('Email send error:', error);

        // Clear error message after 5 seconds
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
      }
    });
  }
}
