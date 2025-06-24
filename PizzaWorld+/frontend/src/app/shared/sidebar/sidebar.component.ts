// src/app/shared/sidebar/sidebar.component.ts
import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  imports: [CommonModule, RouterModule]
})
export class SidebarComponent {
  user$: typeof this.auth.currentUser$;

  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  constructor(private auth: AuthService) {
    this.user$ = this.auth.currentUser$;
  }

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }
}
