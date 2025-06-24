// src/main.ts
import { bootstrapApplication }  from '@angular/platform-browser';
import { provideRouter }         from '@angular/router';
import {
  provideHttpClient,
  HTTP_INTERCEPTORS
} from '@angular/common/http';
import { importProvidersFrom }   from '@angular/core';

import { NgApexchartsModule }    from 'ng-apexcharts';

import { AppComponent }          from './app/app.component';
import { routes }                from './app/app.routes';

import { AuthService }           from './app/core/auth.service';     // ✅ richtiger Pfad

import { TokenInterceptor }      from './app/core/token-interceptor'; // ⬅️ automatisch „Bearer …“

bootstrapApplication(AppComponent, {
  providers: [
    /* Basis-Provider */
    provideRouter(routes),
    provideHttpClient(),

    /* Globale Interceptor-Registrierung */
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },

    /* ApexCharts als Stand-alone-Provider */
    importProvidersFrom(NgApexchartsModule)
  ]
})
.then(appRef => {
  /* Lädt /api/me genau einmal nach dem Bootstrap */
  appRef.injector.get(AuthService).loadCurrentUser().subscribe();
})
.catch(err => console.error(err));
