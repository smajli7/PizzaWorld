import { Component, ViewChild, ElementRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }
}
