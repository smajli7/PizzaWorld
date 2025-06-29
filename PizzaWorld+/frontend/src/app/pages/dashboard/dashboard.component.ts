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
  plotOptions?: any;
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

  // New analytics data
  topStoresData: any[] = [];
  revenueByYear: any[] = [];
  revenueByYearMonth: any[] = [];
  productCategoryPerformance: any[] = [];
  customerAcquisition: any[] = [];
  averageOrderValueTrend: any[] = [];

  constructor(private kpi: KpiService) {}

  ngOnInit(): void {
    this.loadDashboardData();
    
    // Make debug method globally accessible for testing
    (window as any).testPizzaWorldCache = () => this.testInstantLoading();
    (window as any).debugPizzaWorldCache = () => this.debugCacheStatus();
    console.log('🔧 Debug methods available: testPizzaWorldCache(), debugPizzaWorldCache()');
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = false;

    // ALWAYS try to load from cache first - this should be instant after login
    const cachedData = this.kpi.getCachedPerformanceData();
    const cachedStores = this.kpi.getCachedStoresData();

    if (cachedData && cachedStores) {
      // Use cached data - this should be instant
      this.performanceData = cachedData;
      this.dataLastUpdated = cachedData.globalKPIs.lastUpdated;
      this.loading = false;
      this.setupCharts();
      this.loadAdditionalAnalytics();
      console.log('✅ Dashboard loaded INSTANTLY from cache');
      return;
    }

    // Only if NO cache exists (shouldn't happen after login), then load from API
    console.log('⚠️ No cached data found - loading from API (this should not happen after login)');
    this.kpi.loadPerformanceData()
      .pipe(
        catchError(err => {
          console.error('❌ Dashboard loading error:', err);
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
          this.loadAdditionalAnalytics();
          console.log('✅ Dashboard loaded from API');
        } else {
          this.error = true;
        }
      });
  }

  loadAdditionalAnalytics(): void {
    // Load top stores data
    this.kpi.getTopStoresByRevenue().subscribe(data => {
      this.topStoresData = data;
      console.log('✅ Top stores data loaded');
    });

    // Load revenue by year
    this.kpi.getRevenueByYear().subscribe(data => {
      this.revenueByYear = data;
      console.log('✅ Revenue by year data loaded');
    });

    // Load revenue by year/month
    this.kpi.getRevenueByYearMonth().subscribe(data => {
      this.revenueByYearMonth = data;
      console.log('✅ Revenue by year/month data loaded');
    });

    // Load product category performance
    this.kpi.getProductCategoryPerformance().subscribe(data => {
      this.productCategoryPerformance = data;
      console.log('✅ Product category performance loaded');
    });

    // Load customer acquisition
    this.kpi.getCustomerAcquisitionByMonth().subscribe(data => {
      this.customerAcquisition = data;
      console.log('✅ Customer acquisition data loaded');
    });

    // Load average order value trend
    this.kpi.getAverageOrderValueTrend().subscribe(data => {
      this.averageOrderValueTrend = data;
      console.log('✅ Average order value trend loaded');
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
                  this.loadAdditionalAnalytics();
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

    // Setup revenue chart with modern styling
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
        },
        background: 'transparent'
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '60%',
          distributed: false,
          dataLabels: {
            position: 'top'
          }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: function (val) {
          return '$' + Number(val).toLocaleString();
        },
        style: {
          fontSize: '12px',
          colors: ['#374151']
        }
      },
      stroke: {
        width: 0
      },
      xaxis: {
        categories: Object.keys(this.performanceData.storePerformance),
        labels: {
          style: {
            colors: '#6b7280',
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        title: {
          text: 'Revenue ($)',
          style: {
            color: '#6b7280',
            fontSize: '14px'
          }
        },
        labels: {
          formatter: function (val) {
            return '$' + Number(val).toLocaleString();
          },
          style: {
            colors: '#6b7280',
            fontSize: '12px'
          }
        }
      },
      tooltip: {
        y: {
          formatter: function (val) {
            return '$' + Number(val).toLocaleString();
          }
        }
      }
    };

    // Setup orders chart with modern styling
    this.ordersChartOpts = {
      series: [{
        name: 'Orders',
        data: Object.values(this.performanceData.storePerformance).map(store => store.totalOrders)
      }],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: {
          show: false
        },
        background: 'transparent'
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '60%',
          distributed: false,
          dataLabels: {
            position: 'top'
          }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: function (val) {
          return Number(val).toLocaleString();
        },
        style: {
          fontSize: '12px',
          colors: ['#374151']
        }
      },
      stroke: {
        width: 0
      },
      xaxis: {
        categories: Object.keys(this.performanceData.storePerformance),
        labels: {
          style: {
            colors: '#6b7280',
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        title: {
          text: 'Orders',
          style: {
            color: '#6b7280',
            fontSize: '14px'
          }
        },
        labels: {
          formatter: function (val) {
            return Number(val).toLocaleString();
          },
          style: {
            colors: '#6b7280',
            fontSize: '12px'
          }
        }
      },
      tooltip: {
        y: {
          formatter: function (val) {
            return Number(val).toLocaleString() + ' orders';
          }
        }
      }
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    return value.toLocaleString();
  }

  debugCacheStatus(): void {
    console.log('🔍 Debug: Cache status check');
    this.kpi.debugCacheStatus();
  }

  testInstantLoading(): void {
    console.log('🧪 Test: Instant loading simulation');
    this.loadDashboardData();
  }
}
