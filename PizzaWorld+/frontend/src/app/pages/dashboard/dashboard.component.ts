// src/app/pages/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { KpiService, DashboardKpiDto } from '../../core/kpi.service';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { CardModule } from 'primeng/card';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [
    CommonModule,
    SidebarComponent,
    NgxChartsModule,
    CardModule
  ]
})
export class DashboardComponent implements OnInit {
  kpis: DashboardKpiDto | null = null;
  kpiChartData: { name: string, value: number }[] = [];
  loading = true;
  error = false;

  constructor(private kpi: KpiService) {}

  ngOnInit() {
    this.loading = true;
    this.error = false;
    
    this.kpi.getDashboard()
      .pipe(
        catchError(err => {
          console.error('Dashboard loading error:', err);
          this.error = true;
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(k => {
        if (k) {
          this.kpis = k;
        }
      });
  }
}
