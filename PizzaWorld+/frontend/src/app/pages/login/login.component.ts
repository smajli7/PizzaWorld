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
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../core/auth.service';
import { KpiService } from '../../core/kpi.service';
import { LoadingPopupComponent } from '../../shared/loading-popup/loading-popup.component';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, LoadingPopupComponent]
})
export class LoginComponent implements OnInit {
  form!: FormGroup;

  /* ---------- UI-State ---------- */
  showPassword = false;
  successMsg: string | null = null;   // grüne Info-Box
  errorMsg:   string | null = null;   // rote Fehler-Box
  showLogoutPopup = false; // for logout toast
  loading = false;
  error = '';

  // Loading popup properties
  showLoadingPopup = false;
  loadingProgress = 0;
  loadingMessage = 'Preparing your dashboard...';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private auth: AuthService,
    private kpi: KpiService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    // Check if user is already logged in
    if (this.auth.token) {
      this.router.navigate(['/dashboard']);
    }
    // Show logout message as popup if present in sessionStorage
    const logoutMsg = sessionStorage.getItem('logoutMsg');
    if (logoutMsg) {
      this.successMsg = logoutMsg;
      this.showLogoutPopup = true;
      setTimeout(() => { this.showLogoutPopup = false; }, 3000);
      sessionStorage.removeItem('logoutMsg');
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.error = '';
    this.showLoadingPopup = true;
    this.loadingProgress = 10;
    this.loadingMessage = 'Authenticating...';

    this.http
      .post<{ token: string }>('/api/login', this.form.value)
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (res: { token: string }) => {
          this.auth.setToken(res.token);
          this.loadingProgress = 30;
          this.loadingMessage = 'Loading user data...';

          // Wait for user to be loaded before navigating
          this.auth.loadCurrentUser().subscribe({
            next: (user) => {
              if (user) {
                this.successMsg = 'Login erfolgreich';
                this.errorMsg = null;
                this.loadingProgress = 50;
                this.loadingMessage = 'Loading performance data...';

                // Load performance data after successful login
                this.loadAllData();
              } else {
                this.errorMsg = 'Failed to load user after login';
                this.showLoadingPopup = false;
              }
            },
            error: () => {
              this.errorMsg = 'Failed to load user after login';
              this.showLoadingPopup = false;
            }
          });
        },
        error: () => {
          this.errorMsg = 'Benutzername oder Passwort falsch';
          this.successMsg = null;
          this.showLoadingPopup = false;
        }
      });
  }

  private loadAllData(): void {
    // Load performance data
    this.loadingProgress = 60;
    this.loadingMessage = 'Loading store performance...';

    this.kpi.loadPerformanceData()
      .subscribe({
        next: (data) => {
          console.log('Performance data loaded successfully');
          this.loadingProgress = 80;
          this.loadingMessage = 'Loading store locations...';

          // Load stores data
          this.kpi.getAllStores().subscribe({
            next: (stores) => {
              console.log('Stores data loaded successfully');
              this.loadingProgress = 100;
              this.loadingMessage = 'Finalizing...';

              // Small delay to show 100% completion
              setTimeout(() => {
                this.showLoadingPopup = false;
                this.router.navigate(['/dashboard']);
              }, 500);
            },
            error: (error) => {
              console.error('Stores loading error:', error);
              this.showLoadingPopup = false;
              this.router.navigate(['/dashboard']);
            }
          });
        },
        error: (error) => {
          console.error('Performance data loading error:', error);
          this.showLoadingPopup = false;
          this.router.navigate(['/dashboard']);
        }
      });
  }
}
