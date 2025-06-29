import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.token;
    
    // Don't log every request to reduce console noise
    if (req.url.includes('/api/')) {
      console.log(`🔐 TokenInterceptor: ${req.method} ${req.url} - Token: ${token ? 'Present' : 'Missing'}`);
    }
    
    // Add token if available
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
    
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle authentication errors
        if (error.status === 401 || error.status === 403) {
          console.error(`🔐 Authentication error (${error.status}): ${req.url}`);
          console.error('Token may be expired or invalid. Logging out user.');
          
          // Clear invalid token and logout user
          this.auth.logout();
          
          // Don't retry the request - let the component handle the logout
          return throwError(() => new Error('Authentication failed - user logged out'));
        }
        
        // Handle other errors
        if (error.status >= 500) {
          console.error(`🚨 Server error (${error.status}): ${req.url}`, error.message);
        } else if (error.status >= 400) {
          console.error(`⚠️ Client error (${error.status}): ${req.url}`, error.message);
        }
        
        return throwError(() => error);
      })
    );
  }
}
