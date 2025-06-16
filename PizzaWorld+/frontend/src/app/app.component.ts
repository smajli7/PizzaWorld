import { Component } from '@angular/core';
import { AuthService } from './core/auth.service'; // Import AuthService

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(private auth: AuthService) {
    // ✓ runs once right after bootstrap
    this.auth.loadCurrentUser().subscribe();
  }
}