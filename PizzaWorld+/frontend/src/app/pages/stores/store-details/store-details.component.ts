import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SidebarComponent } from '../../../shared/sidebar/sidebar.component';
import {
  KpiService,
  StoreInfo,
  PerformanceData,
  StorePerformance,
  TimePeriodOption,
  ChartFilterOptions,
  StoreRevenueTrend
} from '../../../core/kpi.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
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
import { forkJoin } from 'rxjs';

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
    ProgressBarModule,
    TableModule,
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

  // New comprehensive analytics properties
  storeOverview: any = null;
  revenueTrends: any[] = [];
  hourlyPerformance: any[] = [];
  categoryPerformance: any[] = [];
  dailyOperations: any[] = [];
  customerInsights: any[] = [];
  productPerformance: any[] = [];
  recentOrders: any[] = [];
  efficiencyMetrics: any = null;

  // KPI Cards data (same structure as dashboard/stores pages)
  kpiCards: Array<{ title: string; value: string; subtitle: string; icon: string; color: string; textColor: string }> = [];

  // Chart loading states
  chartsLoading = {
    revenueTrends: true,
    hourlyPerformance: true,
    categoryPerformance: true,
    dailyOperations: true,
    customerInsights: true,
    productPerformance: true,
    efficiencyMetrics: true,
    recentOrders: true
  };

  // Chart instances
  revenueTrendChart: any = null;
  hourlyHeatmapChart: any = null;
  categoryDonutChart: any = null;
  dailyTrendsChart: any = null;
  customerGrowthChart: any = null;
  productBarChart: any = null;
  efficiencyGaugeChart: any = null;
  weeklyPatternChart: any = null;

  // Chart options - initialized lazily
  revenueChartOptions: Partial<ChartOptions> | null = null;
  ordersChartOptions: Partial<ChartOptions> | null = null;
  performanceChartOptions: Partial<PieChartOptions> | null = null;
  revenueComparisonChartOptions: Partial<ChartOptions> | null = null;
  ordersComparisonChartOptions: Partial<ChartOptions> | null = null;
  performanceComparisonChartOptions: Partial<ChartOptions> | null = null;

  // ===== Time filter state (same pattern as dashboard) =====
  selectedTimePeriod: 'all-time' | 'year' | 'month' | 'quarter' = 'all-time';
  availableYears: TimePeriodOption[] = [];
  availableMonths: TimePeriodOption[] = [];
  selectedYear?: number;
  selectedMonth?: number;
  selectedQuarter?: number;

  // ===== Fetch flags =====
  analyticsLoading = false;

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

    const cachedStores = this.kpi.getCachedStoresData();
    if (!cachedStores) {
      // If stores cache missing, fetch first then retry
      this.kpi.getAllStores().subscribe({
        next: () => this.loadStoreDetails(),
        error: () => {
          this.error = true;
          this.loading = false;
        }
      });
      return;
    }

    this.store = cachedStores.find(s => s.storeid === this.storeId) || null;
    if (!this.store) {
      this.error = true;
      this.loading = false;
      return;
    }

    // Load time-period reference data then analytics
    this.kpi.getAvailableYears().subscribe({
      next: (years) => {
        this.availableYears = years;
        if (this.selectedTimePeriod !== 'all-time' && years.length > 0) {
          this.selectedYear = years[0].year;
        }
        if (this.selectedTimePeriod === 'month' && this.selectedYear) {
          this.kpi.getAvailableMonthsForYear(this.selectedYear).subscribe({
            next: (months) => {
              this.availableMonths = months;
              if (months.length > 0) this.selectedMonth = months[0].month;
              this.loadAnalyticsData();
            },
            error: () => {
              this.error = true;
              this.loading = false;
            }
          });
        } else {
          this.loadAnalyticsData();
        }
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  // ===== Build Http filter options =====
  private buildFilterOptions(): Partial<ChartFilterOptions> {
    return {
      timePeriod: this.selectedTimePeriod,
      year: this.selectedYear,
      month: this.selectedMonth,
      quarter: this.selectedQuarter
    };
  }

  // ===== Load analytics for store =====
  loadAnalyticsData(): void {
    if (!this.store) return;

    this.analyticsLoading = true;
    const filters = this.buildFilterOptions();

    forkJoin({
      overview: this.kpi.getStoreAnalyticsOverview(this.store.storeid, filters),
      revenueTrends: this.kpi.getStoreRevenueTrends(this.store.storeid, filters),
      hourly: this.kpi.getStoreHourlyPerformance(this.store.storeid, filters),
      category: this.kpi.getStoreCategoryPerformance(this.store.storeid, filters),
      efficiency: this.kpi.getStoreEfficiencyMetrics(this.store.storeid, filters),
      recentOrders: this.kpi.getStoreRecentOrders(this.store.storeid, 50)
    }).subscribe({
      next: (res) => {
        // KPI cards
        this.kpiCards = [
          {
            title: 'Revenue',
            value: this.formatCurrency(res.overview.revenue),
            subtitle: this.getTimePeriodLabel(),
            icon: 'pi pi-dollar',
            color: 'bg-gradient-to-r from-green-400 to-emerald-500',
            textColor: 'text-white'
          },
          {
            title: 'Orders',
            value: this.formatNumber(res.overview.orders),
            subtitle: this.getTimePeriodLabel(),
            icon: 'pi pi-shopping-cart',
            color: 'bg-gradient-to-r from-blue-400 to-indigo-500',
            textColor: 'text-white'
          },
          {
            title: 'Avg Order',
            value: this.formatCurrency(res.overview.avg_order_value),
            subtitle: this.getTimePeriodLabel(),
            icon: 'pi pi-chart-line',
            color: 'bg-gradient-to-r from-purple-400 to-pink-500',
            textColor: 'text-white'
          },
          {
            title: 'Customers',
            value: this.formatNumber(res.overview.customers),
            subtitle: this.getTimePeriodLabel(),
            icon: 'pi pi-users',
            color: 'bg-gradient-to-r from-orange-400 to-red-500',
            textColor: 'text-white'
          }
        ];

        // Charts
        this.buildRevenueTrendChart(res.revenueTrends);
        this.hourlyHeatmapChart = null;
        this.categoryDonutChart = null;
        // TODO build more charts using res.hourly, res.category, etc.

        // Efficiency metrics & orders table
        this.efficiencyMetrics = res.efficiency;
        this.recentOrders = res.recentOrders;

        Object.keys(this.chartsLoading).forEach(k => (this.chartsLoading as any)[k] = false);
        this.analyticsLoading = false;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Store analytics load error', err);
        this.error = true;
        this.analyticsLoading = false;
        this.loading = false;
      }
    });
  }

  private buildRevenueTrendChart(data: StoreRevenueTrend[]): void {
    if (!data || data.length === 0) return;
    const dates = data.map(d => d.date);
    const revenues = data.map(d => d.revenue);
    const orders = data.map(d => d.orders);

    this.revenueTrendChart = {
      series: [
        { name: 'Revenue', type: 'area', data: revenues },
        { name: 'Orders', type: 'line', data: orders }
      ],
      chart: { type: 'line', height: 350, toolbar: { show: false } },
      xaxis: { categories: dates },
      yaxis: [ { title: { text: 'Revenue ($)' } }, { opposite: true, title: { text: 'Orders' } } ],
      colors: ['#ff6b35', '#3b82f6'],
      stroke: { width: [0, 2] },
      fill: { type: ['gradient', 'solid'] }
    };
  }

  private getTimePeriodLabel(): string {
    switch (this.selectedTimePeriod) {
      case 'year':
        return this.selectedYear ? `Year ${this.selectedYear}` : '';
      case 'month':
        return this.selectedMonth && this.selectedYear ? `${this.selectedMonth}/${this.selectedYear}` : '';
      case 'quarter':
        return this.selectedQuarter && this.selectedYear ? `Q${this.selectedQuarter} ${this.selectedYear}` : '';
      default:
        return 'All-time';
    }
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

  // New methods for comprehensive analytics
  calculateEfficiencyScore(metrics: any): string {
    if (!metrics || !metrics.efficiency_score) return '0%';
    return `${Math.round(metrics.efficiency_score)}%`;
  }

  calculateEfficiencyScoreNumeric(metrics: any): number {
    if (!metrics || !metrics.efficiency_score) return 0;
    return Math.round(metrics.efficiency_score);
  }

  getPerformanceClass(score: number): string {
    if (score >= 80) return 'performance-excellent';
    if (score >= 60) return 'performance-good';
    return 'performance-poor';
  }

  formatPercentage(value: number): string {
    return `${(value || 0).toFixed(1)}%`;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }

  formatTime(date: string): string {
    return new Date(date).toLocaleTimeString();
  }

  formatDateTime(date: string): string {
    return new Date(date).toLocaleString();
  }

  formatCompactNumber(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value?.toLocaleString() || '0';
  }

  getRevenueGrowthClass(growth: number): string {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  getRevenueGrowthIcon(growth: number): string {
    if (growth > 0) return 'pi pi-arrow-up';
    if (growth < 0) return 'pi pi-arrow-down';
    return 'pi pi-minus';
  }
}
