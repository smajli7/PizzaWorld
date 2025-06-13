import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth.guard';


export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent)
  },
  
  {
    path: 'dashboard',
    canActivate: [AuthGuard],                    
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      )
  },

    {
    path: 'products',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/products/products.component').then(
        (m) => m.ProductsComponent
      )
  },

  {
  path: 'stores',
  canActivate: [AuthGuard],
  loadComponent: () =>
    import('./pages/stores/stores.component').then(
      (m) => m.StoresComponent
    )
},
{
  path: 'sales',
  canActivate: [AuthGuard],
  loadComponent: () =>
    import('./pages/sales/sales.component').then(
      (m) => m.SalesComponent
    )
},
{
  path: 'orders',
  canActivate: [AuthGuard],
  loadComponent: () =>
    import('./pages/orders/orders.component').then(
      (m) => m.OrdersComponent
    )
},


  {
    path: 'profile',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent)
  },

  { path: '**', redirectTo: 'login' }
];
