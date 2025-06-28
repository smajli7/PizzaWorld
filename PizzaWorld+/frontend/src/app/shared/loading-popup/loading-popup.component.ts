import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-overlay" *ngIf="isVisible">
      <div class="loading-popup">
        <div class="pizza-loader">
          <div class="pizza-slice"></div>
          <div class="pizza-slice"></div>
          <div class="pizza-slice"></div>
          <div class="pizza-slice"></div>
          <div class="pizza-slice"></div>
          <div class="pizza-slice"></div>
          <div class="pizza-slice"></div>
          <div class="pizza-slice"></div>
        </div>
        <div class="loading-text">
          <h3>{{ title }}</h3>
          <p>{{ message }}</p>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="progress"></div>
          </div>
          <div class="progress-text">{{ progress }}%</div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./loading-popup.component.scss']
})
export class LoadingPopupComponent {
  @Input() isVisible = false;
  @Input() title = 'Loading PizzaWorld Data';
  @Input() message = 'Preparing your dashboard...';
  @Input() progress = 0;
}
