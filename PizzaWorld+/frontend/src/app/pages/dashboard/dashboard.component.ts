// src/app/pages/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { LoadingPopupComponent } from '../../shared/loading-popup/loading-popup.component';
import { TimeSelectorComponent } from '../../shared/time-selector/time-selector.component';
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
  colors?: string[];
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
    TimeSelectorComponent,
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

  // Time selection
  selectedPeriod: 'day' | 'week' | 'month' | 'year' = 'month';
  fromDate: string = '';
  toDate: string = '';

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
          console.log('✅ Dashboard loaded from API');
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
        },
        background: '#ffffff',
        foreColor: '#ff6b35'
      },
      xaxis: {
        categories: Object.keys(this.performanceData.storePerformance),
        labels: {
          style: {
            colors: '#ff6b35',
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        title: {
          text: 'Revenue ($)',
          style: {
            color: '#ff6b35',
            fontSize: '14px',
            fontWeight: '600'
          }
        },
        labels: {
          style: {
            colors: '#ff6b35',
            fontSize: '12px'
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          colors: ['#ff6b35'],
          fontSize: '12px',
          fontWeight: 'bold'
        },
        formatter: (val: number) => '$' + (val / 1000).toFixed(0) + 'k'
      },
      stroke: {
        width: 2
      },
      tooltip: {
        theme: 'light',
        style: {
          fontSize: '12px'
        },
        y: {
          formatter: (value: number) => `$${value.toLocaleString()}`
        }
      },
      colors: ['#ff6b35'],
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '70%'
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
        },
        background: '#ffffff',
        foreColor: '#ff6b35'
      },
      xaxis: {
        categories: Object.keys(this.performanceData.storePerformance),
        labels: {
          style: {
            colors: '#ff6b35',
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        title: {
          text: 'Total Orders',
          style: {
            color: '#ff6b35',
            fontSize: '14px',
            fontWeight: '600'
          }
        },
        labels: {
          style: {
            colors: '#ff6b35',
            fontSize: '12px'
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          colors: ['#ff6b35'],
          fontSize: '12px',
          fontWeight: 'bold'
        }
      },
      stroke: {
        width: 4,
        colors: ['#ff6b35']
      },
      tooltip: {
        theme: 'light',
        style: {
          fontSize: '12px'
        },
        y: {
          formatter: (value: number) => value.toLocaleString()
        }
      },
      colors: ['#ff6b35']
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

  onTimePeriodChange(dateRange: { from: string; to: string }): void {
    this.fromDate = dateRange.from;
    this.toDate = dateRange.to;
    // Handle time period changes if needed
  }

  /** Debug method to check cache status */
  debugCacheStatus(): void {
    console.log('🔍 Dashboard Cache Debug:');
    this.kpi.debugCacheStatus();
    
    const allCached = this.kpi.isAllDataCached();
    console.log(`Overall cache status: ${allCached ? '✅ All cached' : '❌ Missing data'}`);
  }

  /** Global debug method accessible from browser console */
  testInstantLoading(): void {
    console.log('🧪 Testing instant loading...');
    
    // Test dashboard cache
    const dashboardCache = this.kpi.getCachedPerformanceData();
    console.log(`Dashboard cache: ${dashboardCache ? '✅' : '❌'}`);
    
    // Test stores cache
    const storesCache = this.kpi.getCachedStoresData();
    console.log(`Stores cache: ${storesCache ? `✅ ${storesCache.length} stores` : '❌'}`);
    
    // Test products cache
    const productsCache = this.kpi.getCachedProducts();
    console.log(`Products cache: ${productsCache ? `✅ ${productsCache.length} products` : '❌'}`);
    
    // Test sales cache
    const salesCache = this.kpi.getCachedAllTimeSalesKPIs('2000-01-01', new Date().toISOString().split('T')[0]);
    console.log(`Sales cache: ${salesCache ? '✅' : '❌'}`);
    
    if (dashboardCache && storesCache && productsCache && salesCache) {
      console.log('🎉 ALL CACHES WORKING - INSTANT TAB SWITCHING ENABLED!');
    } else {
      console.log('⚠️ Some caches missing - tab switching may have delays');
    }
  }
}
