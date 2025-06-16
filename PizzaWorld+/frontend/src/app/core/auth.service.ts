// src/app/core/auth/auth.service.ts
// Minimal AuthService that hits /api/me once, caches the result, and exposes an observable

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { CurrentUser } from './models/current-user.model';


@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Holds the user object or null while unknown */
  private currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
  /** Public stream – templates use `auth.currentUser$ | async` */
  readonly currentUser$ = this.currentUserSubject.asObservable();

  /** Make sure we only query /api/me once */
  private loaded = false;

  constructor(private http: HttpClient) {}

  /** Call this once (e.g. app initialization) */
  loadCurrentUser(): Observable<CurrentUser> {
    if (this.loaded) {
      // already in flight or cached → return stream as‑is
      return this.currentUser$ as unknown as Observable<CurrentUser>;
    }
    this.loaded = true;
    return this.http
      .get<CurrentUser>('/api/me', { withCredentials: true })
      .pipe(tap(user => this.currentUserSubject.next(user)));
  }

  /** Optional helper if you need the value synchronously */
  get snapshot(): CurrentUser | null {
    return this.currentUserSubject.value;
  }
}
