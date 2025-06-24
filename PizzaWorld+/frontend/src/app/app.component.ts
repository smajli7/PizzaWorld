import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';  
import { AuthService } from './core/auth.service'; // Import AuthService

@Component({
  selector: 'app-root',
  standalone: true,
    templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet] // Import RouterOutlet for routing
})
export class AppComponent {
  constructor(private auth: AuthService) {
    // ✓ runs once right after bootstrap
    this.auth.loadCurrentUser().subscribe();
  }
}