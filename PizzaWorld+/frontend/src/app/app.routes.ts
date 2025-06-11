import { Routes } from '@angular/router';

export const routes: Routes = [
  /**
   * Leerer Pfad: Wenn die App ohne zusätzlichen URL-Teil
   * (also nur http://localhost:4200/) geladen wird,
   * sofort auf /login umleiten.
   */
  {
    path: '',
    pathMatch: 'full',   
    redirectTo: 'login'
  },

  /** Login-Seite */
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent)
  },

  { path: '**', redirectTo: 'login' }
];