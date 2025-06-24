// src/app/core/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  BehaviorSubject, Observable, tap, catchError, of
} from 'rxjs';
import { CurrentUser } from './models/current-user.model'; // Import your CurrentUser model

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'authToken';

  private currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
  currentUser$               = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  /* ───────── Token ───────── */
  setToken(token: string): void { localStorage.setItem(this.tokenKey, token); }
  get token(): string | null     { return localStorage.getItem(this.tokenKey); }
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
  }

  /* ─────── User-Info ─────── */
  private loaded = false;
  loadCurrentUser(): Observable<CurrentUser | null> {
    if (this.loaded) return this.currentUser$;
    this.loaded = true;

    const t = this.token;
    if (!t) return of(null);

    return this.http
      .get<CurrentUser>('/api/me', {
        headers: new HttpHeaders({ Authorization: `Bearer ${t}` })
      })
      .pipe(
        tap(u => this.currentUserSubject.next(u)),
        catchError(() => { this.logout(); return of(null); })
      );
  }

  get snapshot(): CurrentUser | null { return this.currentUserSubject.value; }
}
