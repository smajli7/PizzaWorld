import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom }   from '@angular/core';
import { provideRouter }         from '@angular/router';
import { provideHttpClient }     from '@angular/common/http';
import { AuthService } from './app/core/auth.service'; // Import AuthService if needed

import { NgApexchartsModule }    from 'ng-apexcharts';   // 👈 NEW

import { AppComponent } from './app/app.component';
import { routes }       from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),

    // ⬇️ one-liner that makes <apx-chart> & its inputs available everywhere
    importProvidersFrom(NgApexchartsModule)
  ]
}).catch(err => console.error(err));

bootstrapApplication(AppComponent, { providers: [ /* … */ ] })
  .then(appRef => {
    appRef.injector.get(AuthService).loadCurrentUser().subscribe();
  })
  .catch(err => console.error(err));