import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter }       from '@angular/router';
import { HttpClientModule }    from '@angular/common/http';
import { NgApexchartsModule }  from 'ng-apexcharts';   // 👈 NEW

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    
    importProvidersFrom(
      HttpClientModule,    // ← keep any modules you already had
      NgApexchartsModule   
    )
  ]
};
