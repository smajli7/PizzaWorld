// src/app/pages/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { KpiService, DashboardKpiDto, PerformanceData } from '../../core/kpi.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { catchError, finalize, map } from 'rxjs/operators';
import { of } from 'rxjs';

import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis
} from 'ng-apexcharts';

// Define ChartOptions interface locally
interface ChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
}

@Component({
  standalone: true,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [
    CommonModule,
    SidebarComponent,
    NgApexchartsModule,
    CardModule,
    ButtonModule
  ]
})
export class DashboardComponent implements OnInit {
  // Dashboard data
  dashboardData: DashboardKpiDto | null = null;
  performanceData: PerformanceData | null = null;
  loading = true;
  error = false;
  dataLastUpdated: string | null = null;

  // Chart data
  revenueChartOpts: ChartOptions | null = null;
  ordersChartOpts: ChartOptions | null = null;

  constructor(private kpi: KpiService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = false;

    // First, try to load from cache
    const cachedData = this.kpi.getCachedPerformanceData();
    const cachedStores = this.kpi.getCachedStoresData();

    if (cachedData && this.kpi.isCachedDataFresh() && cachedStores) {
      this.performanceData = cachedData;
      this.dataLastUpdated = cachedData.globalKPIs.lastUpdated;
      this.loading = false;
      this.setupCharts();
      console.log('Dashboard loaded from cache');
      return;
    }

    // If no cache or stale data, load from API
    this.kpi.loadPerformanceData()
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
      .subscribe(data => {
        if (data) {
          this.performanceData = data;
          this.dataLastUpdated = data.globalKPIs.lastUpdated;
          this.setupCharts();
          console.log('Dashboard loaded from API');
        }
      });
  }

  refreshData(): void {
    this.kpi.clearPerformanceCache();
    this.loadDashboardData();
  }

  setupCharts(): void {
    if (!this.performanceData) return;

    // Setup revenue chart
    this.revenueChartOpts = {
      series: [{
        name: 'Revenue',
        data: Object.values(this.performanceData.storePerformance).map(store => store.totalRevenue)
      }],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: {
          show: false
        }
      },
      xaxis: {
        categories: Object.keys(this.performanceData.storePerformance)
      },
      yaxis: {
        title: {
          text: 'Revenue ($)'
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        width: 2
      },
      tooltip: {
        y: {
          formatter: (value: number) => `$${value.toLocaleString()}`
        }
      }
    };

    // Setup orders chart
    this.ordersChartOpts = {
      series: [{
        name: 'Orders',
        data: Object.values(this.performanceData.storePerformance).map(store => store.totalOrders)
      }],
      chart: {
        type: 'line',
        height: 350,
        toolbar: {
          show: false
        }
      },
      xaxis: {
        categories: Object.keys(this.performanceData.storePerformance)
      },
      yaxis: {
        title: {
          text: 'Total Orders'
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        width: 3
      },
      tooltip: {
        y: {
          formatter: (value: number) => value.toLocaleString()
        }
      }
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  formatNumber(value: number): string {
    return value.toLocaleString();
  }
}
