import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  /**
   * Toggles the `.collapsed` class on the sidebar to expand/collapse it.
   */
  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }
}
