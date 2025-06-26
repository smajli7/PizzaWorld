import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter }       from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgApexchartsModule }  from 'ng-apexcharts';   // 👈 NEW
import { TokenInterceptor } from './core/token-interceptor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    
    importProvidersFrom(
      HttpClientModule,    // ← keep any modules you already had
      NgApexchartsModule   
    ),
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true }
  ]
};
