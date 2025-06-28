// src/app/pages/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { LoadingPopupComponent } from '../../shared/loading-popup/loading-popup.component';
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
    LoadingPopupComponent,
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

  // Loading popup properties
  showLoadingPopup = false;
  loadingProgress = 0;
  loadingMessage = 'Refreshing dashboard data...';

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

    // First, try to load from cache - be more lenient with cached data
    const cachedData = this.kpi.getCachedPerformanceData();
    const cachedStores = this.kpi.getCachedStoresData();

    if (cachedData && cachedStores) {
      // Use cached data if available, regardless of freshness
      this.performanceData = cachedData;
      this.dataLastUpdated = cachedData.globalKPIs.lastUpdated;
      this.loading = false;
      this.setupCharts();
      console.log('Dashboard loaded from cache');
      return;
    }

    // If no cache, load from API
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
        } else {
          this.error = true;
        }
      });
  }

  refreshData(): void {
    this.showLoadingPopup = true;
    this.loadingProgress = 10;
    this.loadingMessage = 'Clearing cached data...';

    // Clear cache
    this.kpi.clearPerformanceCache();

    setTimeout(() => {
      this.loadingProgress = 30;
      this.loadingMessage = 'Loading fresh performance data...';

      this.kpi.loadPerformanceData()
        .pipe(
          catchError(err => {
            console.error('Dashboard refresh error:', err);
            this.error = true;
            return of(null);
          }),
          finalize(() => {
            this.loading = false;
          })
        )
        .subscribe(data => {
          if (data) {
            this.loadingProgress = 85;
            this.loadingMessage = `Processed ${Object.keys(data.storePerformance).length} stores with optimized queries`;

            setTimeout(() => {
              this.loadingProgress = 95;
              this.loadingMessage = 'Updating dashboard...';

              setTimeout(() => {
                this.loadingProgress = 100;
                this.loadingMessage = 'Data refresh complete!';

                setTimeout(() => {
                  this.showLoadingPopup = false;
                  this.performanceData = data;
                  this.dataLastUpdated = data.globalKPIs.lastUpdated;
                  this.setupCharts();
                  this.error = false;
                  console.log('Dashboard data refreshed successfully');
                }, 500);
              }, 300);
            }, 300);
          } else {
            this.loadingProgress = 100;
            this.loadingMessage = 'Error: Failed to refresh data';
            setTimeout(() => {
              this.showLoadingPopup = false;
              this.error = true;
            }, 1000);
          }
        });
    }, 500);
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
