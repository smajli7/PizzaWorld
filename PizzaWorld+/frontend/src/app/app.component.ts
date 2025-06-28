import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';  
import { AuthService } from './core/auth.service'; // Import AuthService
import { KpiService } from './core/kpi.service'; // Import KpiService

@Component({
  selector: 'app-root',
  standalone: true,
    templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet] // Import RouterOutlet for routing
})
export class AppComponent {
  constructor(private auth: AuthService, private kpi: KpiService) {
    // Clear all caches on app startup to ensure clean state
    this.kpi.clearAllCaches();
    console.log('🧹 App started - all caches cleared for fresh preload');
    
    // Load user if token exists
    this.auth.loadCurrentUser().subscribe();
  }
}