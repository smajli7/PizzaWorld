import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SidebarComponent } from '../../../shared/sidebar/sidebar.component';
import { KpiService, StoreInfo, PerformanceData, StorePerformance } from '../../../core/kpi.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexTitleSubtitle,
  ApexDataLabels,
  ApexTooltip,
  ApexPlotOptions,
  ApexYAxis,
  ApexStroke,
  ApexResponsive,
  ApexLegend
} from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  title: ApexTitleSubtitle;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  plotOptions: ApexPlotOptions;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  responsive: ApexResponsive[];
  legend: ApexLegend;
  colors: string[];
  fill: any;
  labels: string[];
};

export type PieChartOptions = {
  series: number[];
  chart: ApexChart;
  title: ApexTitleSubtitle;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  legend: ApexLegend;
  colors: string[];
  labels: string[];
};

@Component({
  selector: 'app-store-details',
  standalone: true,
  imports: [
    SidebarComponent,
    CommonModule,
    CardModule,
    ButtonModule,
    NgApexchartsModule
  ],
  templateUrl: './store-details.component.html',
  styleUrls: ['./store-details.component.scss']
})
export class StoreDetailsComponent implements OnInit {
  storeId: string = '';
  store: StoreInfo | null = null;
  loading = true;
  error = false;
  storeStats: any = null;
  storePerformance: StorePerformance | null = null;
  chartsReady = false;

  // Chart options - initialized lazily
  revenueChartOptions: Partial<ChartOptions> | null = null;
  ordersChartOptions: Partial<ChartOptions> | null = null;
  performanceChartOptions: Partial<PieChartOptions> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private kpi: KpiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.storeId = params['id'];
      this.loadStoreDetails();
    });
  }

  loadStoreDetails(): void {
    this.loading = true;
    this.error = false;
    this.chartsReady = false;

    // Load from cached data - this should be instant
    const cachedStores = this.kpi.getCachedStoresData();
    const storePerformance = this.kpi.getStorePerformance(this.storeId);

    if (cachedStores && storePerformance) {
      this.store = cachedStores.find(s => s.storeid === this.storeId) || null;
      this.storePerformance = storePerformance;

      if (this.store && this.storePerformance) {
        this.prepareStoreStats();
        this.error = false;

        // Defer chart initialization to next tick for faster initial render
        setTimeout(() => {
          this.initializeCharts();
          this.chartsReady = true;
          this.cdr.detectChanges();
        }, 0);
      } else {
        this.error = true;
      }
    } else if (cachedStores) {
      // Store exists but no performance data - try to load it
      this.store = cachedStores.find(s => s.storeid === this.storeId) || null;
      if (this.store) {
        this.loadFromAPI();
      } else {
        this.error = true;
      }
    } else {
      // No cached data at all - try to load from API
      this.loadFromAPI();
    }

    this.loading = false;
  }

  private loadFromAPI(): void {
    // This is a fallback - should rarely happen since data is preloaded
    this.kpi.getAllStores().subscribe({
      next: (stores) => {
        this.store = stores.find(s => s.storeid === this.storeId) || null;
        if (this.store) {
          this.kpi.getStoreStats(this.storeId).subscribe({
            next: (stats) => {
              if (stats) {
                this.prepareStoreStatsFromAPI(stats);
                setTimeout(() => {
                  this.initializeCharts();
                  this.chartsReady = true;
                  this.cdr.detectChanges();
                }, 0);
              } else {
                this.error = true;
              }
            },
            error: (err) => {
              console.error('Store stats loading error:', err);
              this.error = true;
            }
          });
        } else {
          this.error = true;
        }
      },
      error: (err) => {
        console.error('Stores loading error:', err);
        this.error = true;
      }
    });
  }

  private prepareStoreStats(): void {
    if (this.storePerformance) {
      this.storeStats = {
        totalOrders: this.storePerformance.totalOrders,
        totalRevenue: this.storePerformance.totalRevenue,
        avgOrderValue: this.storePerformance.avgOrderValue,
        uniqueCustomers: this.storePerformance.uniqueCustomers,
        lastUpdated: this.storePerformance.lastUpdated
      };
    }
  }

  private prepareStoreStatsFromAPI(stats: any): void {
    this.storeStats = {
      totalOrders: stats.kpis?.orders || 0,
      totalRevenue: stats.kpis?.revenue || 0,
      avgOrderValue: stats.kpis?.avg_order || 0,
      uniqueCustomers: stats.kpis?.customers || 0,
      topProducts: Array.isArray(stats.topProducts)
        ? stats.topProducts.map((p: any) => ({
            name: p.name || 'No data available',
            size: p.size || '',
            sku: p.sku || ''
          }))
        : [],
      worstProducts: Array.isArray(stats.worstProducts)
        ? stats.worstProducts.map((p: any) => ({
            name: p.name || 'No data available',
            size: p.size || '',
            sku: p.sku || ''
          }))
        : []
    };
  }

  private initializeCharts(): void {
    // Simplified chart initialization for better performance
    this.initializeRevenueChart();
    this.initializeOrdersChart();
    this.initializePerformanceChart();
  }

  private initializeRevenueChart(): void {
    const revenue = this.storePerformance?.totalRevenue || 0;
    this.revenueChartOptions = {
      series: [{
        name: 'Revenue',
        data: [revenue]
      }],
      chart: {
        type: 'bar',
        height: 200,
        toolbar: { show: false },
        animations: { enabled: false } // Disable animations for faster rendering
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '70%',
          borderRadius: 4
        }
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: { categories: ['Total Revenue'] },
      yaxis: {
        title: { text: 'Revenue ($)' },
        labels: {
          formatter: (val: number) => '$' + val.toLocaleString()
        }
      },
      fill: { opacity: 1 },
      tooltip: {
        y: { formatter: (val: number) => '$' + val.toLocaleString() }
      },
      title: {
        text: 'Store Revenue',
        align: 'center',
        style: { fontSize: '16px', fontWeight: 'bold' }
      },
      colors: ['#FF6B6B']
    };
  }

  private initializeOrdersChart(): void {
    const orders = this.storePerformance?.totalOrders || 0;
    this.ordersChartOptions = {
      series: [{
        name: 'Orders',
        data: [orders]
      }],
      chart: {
        type: 'line',
        height: 200,
        toolbar: { show: false },
        animations: { enabled: false } // Disable animations for faster rendering
      },
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: ['Total Orders'] },
      yaxis: {
        title: { text: 'Number of Orders' },
        labels: {
          formatter: (val: number) => val.toLocaleString()
        }
      },
      tooltip: {
        y: { formatter: (val: number) => val.toLocaleString() + ' orders' }
      },
      title: {
        text: 'Store Orders',
        align: 'center',
        style: { fontSize: '16px', fontWeight: 'bold' }
      },
      colors: ['#4ECDC4']
    };
  }

  private initializePerformanceChart(): void {
    const avgOrderValue = this.storePerformance?.avgOrderValue || 0;
    const uniqueCustomers = this.storePerformance?.uniqueCustomers || 0;

    this.performanceChartOptions = {
      series: [avgOrderValue, uniqueCustomers] as number[],
      chart: {
        type: 'donut',
        height: 250,
        toolbar: { show: false },
        animations: { enabled: false } // Disable animations for faster rendering
      },
      labels: ['Avg Order Value', 'Unique Customers'],
      dataLabels: {
        enabled: true,
        formatter: (val: number, opts: any) => {
          if (opts.seriesIndex === 0) {
            return '$' + avgOrderValue.toFixed(2);
          } else {
            return uniqueCustomers.toLocaleString();
          }
        }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '60%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Performance',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#263238'
              }
            }
          }
        }
      },
      colors: ['#FF6B6B', '#4ECDC4'],
      title: {
        text: 'Store Performance Metrics',
        align: 'center',
        style: { fontSize: '16px', fontWeight: 'bold' }
      },
      legend: { position: 'bottom' }
    };
  }

  goBack(): void {
    this.router.navigate(['/stores']);
  }

  openInMaps(lat: number, lng: number): void {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  }

  formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  formatCurrency(value: number): string {
    return '$' + value.toLocaleString();
  }

  formatNumber(value: number): string {
    return value.toLocaleString();
  }
}
