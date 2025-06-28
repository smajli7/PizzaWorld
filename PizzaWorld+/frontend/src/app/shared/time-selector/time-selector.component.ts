import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type TimePeriod = 'all' | 'day' | 'week' | 'month' | 'year';

@Component({
  selector: 'app-time-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="time-selector">
      <div class="period-selector">
        <label for="period">Time Period:</label>
        <select id="period" [(ngModel)]="selectedPeriod" (change)="onPeriodChange()">
          <option value="all">All Time</option>
          <option value="day">Last Day</option>
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="year">Last Year</option>
        </select>
      </div>
      <div class="custom-date-selector">
        <label for="fromDate">Custom Range:</label>
        <input type="date" id="fromDate" [(ngModel)]="customFromDate" placeholder="From Date">
        <input type="date" id="toDate" [(ngModel)]="customToDate" placeholder="To Date">
        <button class="apply-btn" (click)="onCustomDateChange()">Apply</button>
      </div>
      <div class="current-range">
        <span>Current Range: {{ fromDate | date:'mediumDate' }} - {{ toDate | date:'mediumDate' }}</span>
      </div>
    </div>
  `,
  styles: [`
    .time-selector {
      background: white;
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      border: 1px solid #e1e8ed;
      margin-bottom: 1.5rem;

      .period-selector, .custom-date-selector {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;

        label {
          font-weight: 600;
          color: #2c3e50;
          white-space: nowrap;
        }

        select, input {
          padding: 0.5rem;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          font-size: 0.9rem;
          transition: border-color 0.3s ease;

          &:focus {
            outline: none;
            border-color: #ff6b35;
            box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.1);
          }
        }

        .apply-btn {
          background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease;

          &:hover {
            transform: translateY(-1px);
          }
        }
      }

      .current-range {
        padding: 0.75rem;
        background: #f8f9fa;
        border-radius: 8px;
        text-align: center;
        font-weight: 500;
        color: #2c3e50;
      }
    }

    @media (max-width: 768px) {
      .time-selector {
        .period-selector, .custom-date-selector {
          flex-direction: column;
          align-items: stretch;
        }
      }
    }
  `]
})
export class TimeSelectorComponent implements OnInit {
  @Input() selectedPeriod: TimePeriod = 'all';
  @Input() earliestDate: string = '2000-01-01';
  @Output() periodChange = new EventEmitter<{ from: string; to: string }>();

  customFromDate: string = '';
  customToDate: string = '';
  fromDate: string = '';
  toDate: string = '';

  ngOnInit(): void {
    this.initializeDateRange();
  }

  private initializeDateRange(): void {
    const today = new Date();
    let fromDate = new Date();

    switch (this.selectedPeriod) {
      case 'all':
        fromDate = new Date(this.earliestDate);
        break;
      case 'day':
        fromDate.setDate(today.getDate() - 1);
        break;
      case 'week':
        fromDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        fromDate.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        fromDate.setFullYear(today.getFullYear() - 1);
        break;
    }

    this.fromDate = fromDate.toISOString().split('T')[0];
    this.toDate = today.toISOString().split('T')[0];
    this.emitDateRange();
  }

  onPeriodChange(): void {
    this.initializeDateRange();
  }

  onCustomDateChange(): void {
    if (this.customFromDate && this.customToDate) {
      this.fromDate = this.customFromDate;
      this.toDate = this.customToDate;
      this.emitDateRange();
    }
  }

  private emitDateRange(): void {
    this.periodChange.emit({ from: this.fromDate, to: this.toDate });
  }
} 