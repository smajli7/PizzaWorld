// src/app/core/auth.guard.ts
import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private http: HttpClient, private router: Router) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.http
      .get('/api/me', { observe: 'response', withCredentials: true })
      .pipe(
        map(res => res.status === 200),      // true = eingeloggt
        catchError(() => of(false)),         // Fehler → ausgeloggt
        tap(ok => {
          if (!ok) {
            this.router.navigate(['/login']); // Umleitung zur Login-Seite
          }
        })
      );
  }
}
