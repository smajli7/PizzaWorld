// src/app/pages/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { KpiService, DashboardKpiDto } from '../../core/kpi.service';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { CardModule } from 'primeng/card';

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

  constructor(private kpi: KpiService) {}

  ngOnInit() {
    this.kpi.getDashboard().subscribe(k => {
      this.kpis = k;
    });
  }
}
