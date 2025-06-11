// frontend/src/app/pages/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup
} from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import {
  Router,
  RouterModule            // ⬅️  für routerLink im Template
} from '@angular/router';
import { CommonModule } from '@angular/common'; // ngClass, ngIf, ...

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [
    CommonModule,          // *ngIf, ngClass, ...
    RouterModule,          // routerLink
    ReactiveFormsModule,   // [formGroup]
    HttpClientModule
  ]
})
export class LoginComponent implements OnInit {
  /** Formular-Instanz */
  form!: FormGroup;

  /** UI-State */
  showPassword = false;
  successMsg: string | null = null;
  errorMsg: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router      // ⬅️  DI-Injection, danach in Methoden benutzbar
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  /** Icon-Klick → Passwort ein-/ausblenden */
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  /** Formular absenden */
  onSubmit(): void {
    if (this.form.invalid) return;

    this.http.post('/api/login', this.form.value).subscribe({
      next: () => {
        this.successMsg = 'Login erfolgreich';
        this.errorMsg = null;
        this.router.navigateByUrl('/dashboard');   // jetzt ohne TS2304
      },
      error: () => {
        this.errorMsg = 'Benutzername oder Passwort falsch';
        this.successMsg = null;
      }
    });
  }
}
