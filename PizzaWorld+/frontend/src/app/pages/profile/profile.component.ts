import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { CurrentUser } from '../../core/models/current-user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  imports: [RouterModule, CommonModule]
})
export class ProfileComponent implements OnInit {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  /** Holds data returned by GET /api/me (username, role, storeId, stateAbbr) */
  user?: CurrentUser;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<CurrentUser>('/api/me').subscribe({
      next: res => (this.user = res),
      error: err => console.error('Failed to load current user', err)
    });
  }

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }
}
