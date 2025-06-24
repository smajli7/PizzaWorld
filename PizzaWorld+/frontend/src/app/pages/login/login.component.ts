// src/app/pages/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class LoginComponent implements OnInit {
  /* ---------- Form ---------- */
  form!: FormGroup;

  /* ---------- UI-State ---------- */
  showPassword = false;
  successMsg: string | null = null;   // grüne Info-Box
  errorMsg:   string | null = null;   // rote Fehler-Box

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.http
      .post<{ token: string }>('/api/login', this.form.value)     // Backend liefert { token }
      .subscribe({
        next: res => {
          /* 1) Token speichern + User laden */
          this.auth.setToken(res.token);
          this.auth.loadCurrentUser().subscribe();

          /* 2) UI-Feedback + Weiterleitung */
          this.successMsg = 'Login erfolgreich';
          this.errorMsg   = null;
          this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.errorMsg   = 'Benutzername oder Passwort falsch';
          this.successMsg = null;
        }
      });
  }
}
