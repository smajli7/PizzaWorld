// src/app/shared/sidebar/sidebar.component.ts
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  imports: [CommonModule, RouterModule]
})
export class SidebarComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  
  user$: typeof this.auth.currentUser$;

  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  constructor() {
    this.user$ = this.auth.currentUser$;
  }

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }

  logout(): void {
    this.auth.logout();
    sessionStorage.setItem('logoutMsg', 'You have been successfully logged out.');
    this.router.navigate(['/login']);
  }
}
