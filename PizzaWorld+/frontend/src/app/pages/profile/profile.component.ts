import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CurrentUser } from '../../core/models/current-user.model';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { AuthService } from '../../core/auth.service';



@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  imports: [RouterModule, SidebarComponent, CommonModule]
})
export class ProfileComponent implements OnInit {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  /** Holds data returned by GET /api/me (username, role, storeId, stateAbbr) */
  user?: CurrentUser;

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.loadCurrentUser().subscribe({
      next: res => (this.user = res ?? undefined),
      error: err => console.error('Failed to load current user', err)
    });
  }

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }
}
