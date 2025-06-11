import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

/**
 * AuthGuard: lässt die Route nur passieren, wenn /api/me HTTP-200 liefert.
 * Backend muss einen Endpoint /api/me haben, der bei gültiger Session 200 (oder 204) zurückgibt.
 */
@Injectable({
  providedIn: 'root'          // stellt Guard global bereit
})
export class AuthGuard implements CanActivate {
  constructor(private http: HttpClient, private router: Router) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.http.get('/api/me', { observe: 'response' }).pipe(
      map(res => {
        if (res.status === 200) {       // eingeloggt
          return true;
        }
        this.router.navigateByUrl('/login');
        return false;
      }),
      catchError(() => {
        this.router.navigateByUrl('/login');
        return of(false);
      })
    );
  }
}
