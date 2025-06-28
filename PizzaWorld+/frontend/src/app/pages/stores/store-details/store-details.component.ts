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
  revenueComparisonChartOptions: Partial<ChartOptions> | null = null;
  ordersComparisonChartOptions: Partial<ChartOptions> | null = null;
  performanceComparisonChartOptions: Partial<ChartOptions> | null = null;

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

    console.log('Loading store details for:', this.storeId);

    // Load from cached data - this should be instant
    const cachedStores = this.kpi.getCachedStoresData();
    const storePerformance = this.kpi.getStorePerformance(this.storeId);

    console.log('Cached stores:', cachedStores?.length);
    console.log('Store performance:', storePerformance);

    if (cachedStores && storePerformance) {
      this.store = cachedStores.find(s => s.storeid === this.storeId) || null;
      this.storePerformance = storePerformance;

      if (this.store && this.storePerformance) {
        console.log('Found store and performance data in cache');
        this.prepareStoreStats();
        this.error = false;

        // Defer chart initialization to next tick for faster initial render
        setTimeout(() => {
          this.initializeCharts();
          this.chartsReady = true;
          this.cdr.detectChanges();
        }, 0);
      } else {
        console.log('Store or performance data missing from cache');
        this.error = true;
      }
    } else if (cachedStores) {
      // Store exists but no performance data - try to load it
      this.store = cachedStores.find(s => s.storeid === this.storeId) || null;
      if (this.store) {
        console.log('Store found in cache, loading performance from API');
        this.loadFromAPI();
      } else {
        console.log('Store not found in cache');
        this.error = true;
      }
    } else {
      // No cached data at all - try to load from API
      console.log('No cached data, loading from API');
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
    this.initializeRevenueChart();
    this.initializeOrdersChart();
    this.initializePerformanceChart();
    this.initializeComparisonCharts();
  }

  private initializeComparisonCharts(): void {
    this.initializeRevenueComparisonChart();
    this.initializeOrdersComparisonChart();
    this.initializePerformanceComparisonChart();
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
        animations: { enabled: false },
        background: '#ffffff',
        foreColor: '#ff6b35'
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '70%',
          borderRadius: 8,
          colors: {
            ranges: [{
              from: 0,
              to: 999999,
              color: '#ff6b35'
            }]
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          colors: ['#ff6b35'],
          fontSize: '14px',
          fontWeight: 'bold'
        },
        formatter: (val: number) => '$' + val.toLocaleString()
      },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: {
        categories: ['Total Revenue'],
        labels: {
          style: {
            colors: '#ff6b35',
            fontSize: '14px',
            fontWeight: '600'
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
          },
          formatter: (val: number) => '$' + val.toLocaleString()
        }
      },
      fill: { opacity: 1 },
      tooltip: {
        theme: 'light',
        style: {
          fontSize: '12px'
        },
        y: { formatter: (val: number) => '$' + val.toLocaleString() }
      },
      title: {
        text: 'Store Revenue',
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#ff6b35'
        }
      },
      colors: ['#ff6b35']
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
        animations: { enabled: false },
        background: '#ffffff',
        foreColor: '#ff6b35'
      },
      stroke: {
        curve: 'smooth',
        width: 4,
        colors: ['#ff6b35']
      },
      xaxis: {
        categories: ['Total Orders'],
        labels: {
          style: {
            colors: '#ff6b35',
            fontSize: '14px',
            fontWeight: '600'
          }
        }
      },
      yaxis: {
        title: {
          text: 'Number of Orders',
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
          },
          formatter: (val: number) => val.toLocaleString()
        }
      },
      tooltip: {
        theme: 'light',
        style: {
          fontSize: '12px'
        },
        y: { formatter: (val: number) => val.toLocaleString() + ' orders' }
      },
      title: {
        text: 'Store Orders',
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#ff6b35'
        }
      },
      colors: ['#ff6b35']
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
        animations: { enabled: false },
        background: '#ffffff',
        foreColor: '#ff6b35'
      },
      labels: ['Avg Order Value', 'Unique Customers'],
      dataLabels: {
        enabled: true,
        style: {
          colors: ['#ffffff'],
          fontSize: '12px',
          fontWeight: 'bold'
        },
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
                color: '#ff6b35'
              }
            }
          }
        }
      },
      colors: ['#ff6b35', '#f7931e'],
      title: {
        text: 'Store Performance Metrics',
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#ff6b35'
        }
      },
      legend: {
        position: 'bottom',
        labels: {
          colors: '#ff6b35'
        }
      }
    };
  }

  private initializeRevenueComparisonChart(): void {
    const allStores = this.kpi.getCachedPerformanceData();
    if (!this.storePerformance || !allStores) return;

    const currentStoreRevenue = this.storePerformance.totalRevenue;

    // Get top 10 stores by revenue for comparison
    const topStores = Object.entries(allStores.storePerformance)
      .sort(([, a], [, b]) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const storeIds = topStores.map(([id]) => id);
    const revenues = topStores.map(([, data]) => data.totalRevenue);

    // Color coding: green for good (top performers), red for poor performers
    const colors: string[] = revenues.map(revenue => {
      const maxRevenue = Math.max(...revenues);
      const minRevenue = Math.min(...revenues);
      const percentage = (revenue - minRevenue) / (maxRevenue - minRevenue);

      if (percentage >= 0.7) return '#10B981'; // Green for top 30%
      if (percentage >= 0.4) return '#F59E0B'; // Yellow for middle 30%
      return '#EF4444'; // Red for bottom 40%
    });

    // Highlight current store
    const currentStoreIndex = storeIds.indexOf(this.storeId);
    if (currentStoreIndex !== -1) {
      colors[currentStoreIndex] = '#3B82F6'; // Blue for current store
    }

    this.revenueComparisonChartOptions = {
      series: [{
        name: 'Revenue',
        data: revenues
      }],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: false }
      },
      colors: colors,
      xaxis: {
        categories: storeIds.map(id => `Store ${id}`),
        labels: { rotate: -45 }
      },
      yaxis: {
        title: { text: 'Revenue ($)' }
      },
      dataLabels: {
        enabled: true,
        formatter: (value: number) => `$${(value / 1000).toFixed(0)}k`
      },
      tooltip: {
        y: {
          formatter: (value: number) => `$${value.toLocaleString()}`
        }
      },
      title: {
        text: 'Store Revenue Comparison (Top 10)',
        align: 'center'
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          dataLabels: {
            position: 'top'
          }
        }
      }
    };
  }

  private initializeOrdersComparisonChart(): void {
    const allStores = this.kpi.getCachedPerformanceData();
    if (!this.storePerformance || !allStores) return;

    // Get top 10 stores by orders for comparison
    const topStores = Object.entries(allStores.storePerformance)
      .sort(([, a], [, b]) => b.totalOrders - a.totalOrders)
      .slice(0, 10);

    const storeIds = topStores.map(([id]) => id);
    const orders = topStores.map(([, data]) => data.totalOrders);

    // Color coding: green for good (top performers), red for poor performers
    const colors: string[] = orders.map(orderCount => {
      const maxOrders = Math.max(...orders);
      const minOrders = Math.min(...orders);
      const percentage = (orderCount - minOrders) / (maxOrders - minOrders);

      if (percentage >= 0.7) return '#10B981'; // Green for top 30%
      if (percentage >= 0.4) return '#F59E0B'; // Yellow for middle 30%
      return '#EF4444'; // Red for bottom 40%
    });

    // Highlight current store
    const currentStoreIndex = storeIds.indexOf(this.storeId);
    if (currentStoreIndex !== -1) {
      colors[currentStoreIndex] = '#3B82F6'; // Blue for current store
    }

    this.ordersComparisonChartOptions = {
      series: [{
        name: 'Orders',
        data: orders
      }],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: false }
      },
      colors: colors,
      xaxis: {
        categories: storeIds.map(id => `Store ${id}`),
        labels: { rotate: -45 }
      },
      yaxis: {
        title: { text: 'Total Orders' }
      },
      dataLabels: {
        enabled: true,
        formatter: (value: number) => value.toLocaleString()
      },
      tooltip: {
        y: {
          formatter: (value: number) => value.toLocaleString()
        }
      },
      title: {
        text: 'Store Orders Comparison (Top 10)',
        align: 'center'
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          dataLabels: {
            position: 'top'
          }
        }
      }
    };
  }

  private initializePerformanceComparisonChart(): void {
    const allStores = this.kpi.getCachedPerformanceData();
    if (!this.storePerformance || !allStores) return;

    // Calculate performance score (combination of revenue and orders)
    const storeScores = Object.entries(allStores.storePerformance).map(([id, data]) => ({
      id,
      score: (data.totalRevenue / 1000) + (data.totalOrders / 10), // Normalized score
      revenue: data.totalRevenue,
      orders: data.totalOrders
    }));

    // Get top 10 stores by performance score
    const topStores = storeScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const storeIds = topStores.map(store => store.id);
    const scores = topStores.map(store => store.score);

    // Color coding: green for good (top performers), red for poor performers
    const colors: string[] = scores.map(score => {
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      const percentage = (score - minScore) / (maxScore - minScore);

      if (percentage >= 0.7) return '#10B981'; // Green for top 30%
      if (percentage >= 0.4) return '#F59E0B'; // Yellow for middle 30%
      return '#EF4444'; // Red for bottom 40%
    });

    // Highlight current store
    const currentStoreIndex = storeIds.indexOf(this.storeId);
    if (currentStoreIndex !== -1) {
      colors[currentStoreIndex] = '#3B82F6'; // Blue for current store
    }

    this.performanceComparisonChartOptions = {
      series: [{
        name: 'Performance Score',
        data: scores
      }],
      chart: {
        type: 'line',
        height: 350,
        toolbar: { show: false }
      },
      colors: ['#3B82F6'],
      xaxis: {
        categories: storeIds.map(id => `Store ${id}`),
        labels: { rotate: -45 }
      },
      yaxis: {
        title: { text: 'Performance Score' }
      },
      dataLabels: {
        enabled: true,
        formatter: (value: number) => value.toFixed(0)
      },
      tooltip: {
        y: {
          formatter: (value: number) => `Score: ${value.toFixed(0)}`
        }
      },
      title: {
        text: 'Store Performance Comparison (Top 10)',
        align: 'center'
      },
      fill: {
        opacity: 0.3
      },
      stroke: {
        width: 2
      }
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
