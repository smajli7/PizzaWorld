import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { forkJoin, catchError, of } from 'rxjs';

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
    FormsModule,
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
  selectedTimePeriod: 'all-time' | 'year' | 'month' | 'quarter' | 'custom-range' | 'compare' = 'all-time';
  availableYears: TimePeriodOption[] = [];
  availableMonths: TimePeriodOption[] = [];
  selectedYear?: number;
  selectedMonth?: number;
  selectedQuarter?: number;

  // ===== Custom Range state =====
  customRangeFromYear?: number;
  customRangeFromMonth?: number;
  customRangeToYear?: number;
  customRangeToMonth?: number;
  customRangeData: any = null;

  // ===== Compare Periods state =====
  comparePeriods: Array<{ year: number, month?: number, quarter?: number, label?: string }> = [];
  compareData: any = null;

  // ===== Fetch flags =====
  analyticsLoading = false;
  customModeActive = false; // Flag to track if custom-range or compare mode is active

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
    // For custom-range and compare modes, don't include standard filter parameters
    // as they use their own specific API calls
    if (this.selectedTimePeriod === 'custom-range' || this.selectedTimePeriod === 'compare') {
      return {
        timePeriod: this.selectedTimePeriod
      };
    }

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

    // For custom-range and compare modes, don't load regular analytics
    // These modes handle their own data loading
    if (this.selectedTimePeriod === 'custom-range' || this.selectedTimePeriod === 'compare') {
      console.log('Skipping regular analytics load for mode:', this.selectedTimePeriod);
      return;
    }

    this.analyticsLoading = true;
    const filters = this.buildFilterOptions();

    forkJoin({
      overview: this.kpi.getStoreAnalyticsOverview(this.store.storeid, filters).pipe(
        catchError(err => {
          console.error('Overview error:', err);
          return of({ revenue: 0, orders: 0, avg_order_value: 0, customers: 0, last_updated: new Date().toISOString() });
        })
      ),
      revenueTrends: this.kpi.getStoreRevenueTrends(this.store.storeid, filters).pipe(
        catchError(err => {
          console.error('Revenue trends error:', err);
          return of([]);
        })
      ),
      hourly: this.kpi.getStoreHourlyPerformance(this.store.storeid, filters).pipe(
        catchError(err => {
          console.error('Hourly performance error:', err);
          return of([]);
        })
      ),
      category: this.kpi.getStoreCategoryPerformance(this.store.storeid, filters).pipe(
        catchError(err => {
          console.error('Category performance error:', err);
          return of([]);
        })
      ),
      daily: this.kpi.getStoreDailyOperations(this.store.storeid, filters).pipe(
        catchError(err => {
          console.error('Daily operations error:', err);
          return of([]);
        })
      ),
      customer: this.kpi.getStoreCustomerInsights(this.store.storeid, filters).pipe(
        catchError(err => {
          console.error('Customer insights error:', err);
          return of([]);
        })
      ),
      products: this.kpi.getStoreProductPerformance(this.store.storeid, filters).pipe(
        catchError(err => {
          console.error('Product performance error:', err);
          return of([]);
        })
      ),
      efficiency: this.kpi.getStoreEfficiencyMetrics(this.store.storeid, filters).pipe(
        catchError(err => {
          console.error('Efficiency metrics error:', err);
          return of({ efficiency_score: 75, avg_orders_per_day: 0, active_days: 0, total_items_sold: 0, avg_order_value: 0 });
        })
      ),
      recentOrders: this.kpi.getStoreRecentOrders(this.store.storeid, 50).pipe(
        catchError(err => {
          console.error('Recent orders error:', err);
          return of([]);
        })
      )
    }).subscribe({
      next: (res) => {
        console.log('All store analytics loaded:', res);

        // Only update KPI cards if not in custom mode
        if (!this.customModeActive) {
          console.log('Updating KPI cards with regular analytics data');
          // KPI cards - using dashboard colors and mapping backend response correctly
          const overview = res.overview as any; // Type assertion to handle dynamic properties
          this.kpiCards = [
            {
              title: 'Total Revenue',
              value: this.formatCurrency(overview.total_revenue || overview.revenue || 0),
              subtitle: this.getTimePeriodLabel(),
              icon: 'pi pi-dollar',
              color: 'bg-gradient-to-r from-orange-500 to-orange-600',
              textColor: 'text-white'
            },
            {
              title: 'Total Orders',
              value: this.formatNumber(overview.total_orders || overview.orders || 0),
              subtitle: this.getTimePeriodLabel(),
              icon: 'pi pi-shopping-cart',
              color: 'bg-gradient-to-r from-orange-400 to-orange-500',
              textColor: 'text-white'
            },
            {
              title: 'Avg Order Value',
              value: this.formatCurrency(overview.avg_order_value || 0),
              subtitle: this.getTimePeriodLabel(),
              icon: 'pi pi-chart-line',
              color: 'bg-gradient-to-r from-orange-600 to-orange-700',
              textColor: 'text-white'
            },
            {
              title: 'Total Customers',
              value: this.formatNumber(overview.total_customers || overview.customers || 0),
              subtitle: this.getTimePeriodLabel(),
              icon: 'pi pi-users',
              color: 'bg-gradient-to-r from-orange-300 to-orange-400',
              textColor: 'text-white'
            }
          ];
        } else {
          console.log('Skipping KPI cards update - custom mode is active');
        }

        // Build all charts with error handling
        try {
          this.buildRevenueTrendChart(res.revenueTrends);
          this.buildHourlyHeatmapChart(res.hourly);
          this.buildCategoryDonutChart(res.category);
          this.buildDailyTrendsChart(res.daily);
          this.buildCustomerGrowthChart(res.customer);
          this.buildProductBarChart(res.products);
          this.buildEfficiencyGaugeChart(res.efficiency);
          this.buildWeeklyPatternChart(res.daily);
        } catch (chartError) {
          console.error('Chart building error:', chartError);
        }

        // Store data
        this.efficiencyMetrics = res.efficiency;
        this.recentOrders = res.recentOrders;

        // Turn off all loading states
        Object.keys(this.chartsLoading).forEach(k => (this.chartsLoading as any)[k] = false);
        this.analyticsLoading = false;
        this.loading = false;

        console.log('Loading state set to false');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Store analytics load error', err);
        this.error = true;
        this.analyticsLoading = false;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buildRevenueTrendChart(data: any[]): void {
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
      fill: { type: ['gradient', 'solid'] },
      title: { text: '', style: { fontSize: '16px' } },
      tooltip: { shared: true },
      grid: { borderColor: '#f1f5f9' },
      legend: { position: 'top' }
    };
  }

  private buildHourlyHeatmapChart(data: any[]): void {
    if (!data || data.length === 0) return;

    const heatmapData = data.map(d => ({
      x: `${d.hour}:00`,
      y: d.revenue
    }));

    this.hourlyHeatmapChart = {
      series: [{ name: 'Revenue', data: heatmapData }],
      chart: { type: 'heatmap', height: 350, toolbar: { show: false } },
      plotOptions: {
        heatmap: {
          shadeIntensity: 0.5,
          colorScale: {
            ranges: [
              { from: 0, to: 1000, color: '#FFB800' },
              { from: 1001, to: 5000, color: '#FF6B35' },
              { from: 5001, to: 10000, color: '#E53E3E' }
            ]
          }
        }
      },
      dataLabels: { enabled: false },
      colors: ['#FF6B35'],
      title: { text: '', style: { fontSize: '16px' } },
      xaxis: { title: { text: 'Hour of Day' } },
      yaxis: { title: { text: 'Revenue' } },
      tooltip: {
        custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
          const value = series[seriesIndex][dataPointIndex];
          const hour = w.globals.labels[dataPointIndex];
          return `<div class="p-2"><strong>${hour}</strong><br/>Revenue: $${value?.toLocaleString()}</div>`;
        }
      }
    };
  }

  private buildCategoryDonutChart(data: any[]): void {
    if (!data || data.length === 0) return;

    const categories = data.map(d => d.category);
    const revenues = data.map(d => d.total_revenue);

    this.categoryDonutChart = {
      series: revenues,
      chart: { type: 'donut', height: 350 },
      labels: categories,
      colors: ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'],
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total Revenue',
                formatter: () => '$' + revenues.reduce((a, b) => a + b, 0).toLocaleString()
              }
            }
          }
        }
      },
      title: { text: '', style: { fontSize: '16px' } },
      legend: { position: 'bottom' },
      tooltip: {
        y: { formatter: (val: number) => '$' + val.toLocaleString() }
      },
      dataLabels: { enabled: true, formatter: (val: number) => val.toFixed(1) + '%' }
    };
  }

  private buildDailyTrendsChart(data: any[]): void {
    if (!data || data.length === 0) return;

    const dates = data.map(d => d.date);
    const revenues = data.map(d => d.revenue);
    const orders = data.map(d => d.orders);

    this.dailyTrendsChart = {
      series: [
        { name: 'Revenue', data: revenues },
        { name: 'Orders', data: orders }
      ],
      chart: { type: 'line', height: 350, toolbar: { show: false } },
      xaxis: { categories: dates, title: { text: 'Date' } },
      yaxis: [
        { title: { text: 'Revenue ($)' } },
        { opposite: true, title: { text: 'Orders' } }
      ],
      stroke: { width: [3, 2], curve: 'smooth' },
      colors: ['#8B5CF6', '#F59E0B'],
      title: { text: '', style: { fontSize: '16px' } },
      tooltip: { shared: true },
      legend: { position: 'top' }
    };
  }

  private buildCustomerGrowthChart(data: any[]): void {
    if (!data || data.length === 0) return;

    const weeks = data.map(d => `Week ${d.week}`);
    const newCustomers = data.map(d => d.new_customers);
    const revenueFromNew = data.map(d => d.revenue_from_new_customers);

    this.customerGrowthChart = {
      series: [
        { name: 'New Customers', type: 'column', data: newCustomers },
        { name: 'Revenue from New', type: 'line', data: revenueFromNew }
      ],
      chart: { type: 'line', height: 350, toolbar: { show: false } },
      xaxis: { categories: weeks },
      yaxis: [
        { title: { text: 'New Customers' } },
        { opposite: true, title: { text: 'Revenue ($)' } }
      ],
      colors: ['#14B8A6', '#F97316'],
      fill: { type: ['solid', 'gradient'] },
      title: { text: '', style: { fontSize: '16px' } },
      tooltip: { shared: true },
      legend: { position: 'top' }
    };
  }

  private buildProductBarChart(data: any[]): void {
    if (!data || data.length === 0) return;

    const products = data.slice(0, 10).map(d => d.product_name || 'Unknown');
    const revenues = data.slice(0, 10).map(d => d.total_revenue);
    const quantities = data.slice(0, 10).map(d => d.total_quantity);

    this.productBarChart = {
      series: [
        { name: 'Revenue', data: revenues },
        { name: 'Quantity Sold', data: quantities }
      ],
      chart: { type: 'bar', height: 400, toolbar: { show: false } },
      xaxis: { categories: products, labels: { rotate: -45 } },
      yaxis: [
        { title: { text: 'Revenue ($)' } },
        { opposite: true, title: { text: 'Quantity' } }
      ],
      plotOptions: {
        bar: { horizontal: false, columnWidth: '60%' }
      },
      colors: ['#6366F1', '#EF4444'],
      title: { text: '', style: { fontSize: '16px' } },
      tooltip: { shared: true },
      legend: { position: 'top' }
    };
  }

  private buildEfficiencyGaugeChart(data: any): void {
    if (!data || !data.efficiency_score) return;

    this.efficiencyGaugeChart = {
      series: [data.efficiency_score],
      chart: { type: 'radialBar', height: 300 },
      plotOptions: {
        radialBar: {
          startAngle: -135,
          endAngle: 135,
          hollow: { size: '60%' },
          dataLabels: {
            show: true,
            name: { fontSize: '16px', fontWeight: 600 },
            value: { fontSize: '24px', fontWeight: 700, formatter: (val: number) => `${val}%` }
          }
        }
      },
      colors: data.efficiency_score >= 80 ? ['#10B981'] : data.efficiency_score >= 60 ? ['#F59E0B'] : ['#EF4444'],
      title: { text: '', style: { fontSize: '16px' } },
      labels: ['Efficiency Score']
    };
  }

  private buildWeeklyPatternChart(data: any[]): void {
    if (!data || data.length === 0) return;

    // Group by day of week
    const dayGroups = data.reduce((acc: any, item: any) => {
      const day = new Date(item.date).toLocaleDateString('en', { weekday: 'short' });
      if (!acc[day]) acc[day] = [];
      acc[day].push(item.revenue);
      return acc;
    }, {});

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const avgRevenues = days.map(day => {
      const dayData = dayGroups[day] || [];
      return dayData.length > 0 ? dayData.reduce((a: number, b: number) => a + b, 0) / dayData.length : 0;
    });

    this.weeklyPatternChart = {
      series: [{ name: 'Avg Revenue', data: avgRevenues }],
      chart: { type: 'radar', height: 400, toolbar: { show: false } },
      xaxis: { categories: days },
      colors: ['#EC4899'],
      title: { text: '', style: { fontSize: '16px' } },
      tooltip: {
        y: { formatter: (val: number) => '$' + val.toLocaleString() }
      },
      legend: { position: 'top' }
    };
  }


  goBack(): void {
    this.router.navigate(['/stores']);
  }

  openInMaps(lat: number | undefined, lng: number | undefined): void {
    if (lat === undefined || lng === undefined) return;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  }

  formatCoordinates(lat: number | undefined, lng: number | undefined): string {
    if (lat === undefined || lng === undefined) return 'N/A';
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

  // Time period change handlers (from dashboard)
  onTimePeriodChange(): void {
    // Clear previous custom/compare data when switching modes
    this.customRangeData = null;
    this.compareData = null;

    // Update custom mode flag
    this.customModeActive = (this.selectedTimePeriod === 'custom-range' || this.selectedTimePeriod === 'compare');

    if (this.selectedTimePeriod === 'all-time') {
      this.selectedYear = undefined;
      this.selectedMonth = undefined;
      this.selectedQuarter = undefined;
      this.loadAnalyticsData();
    } else if (this.selectedTimePeriod === 'year' && this.availableYears.length > 0) {
      this.selectedYear = this.availableYears[0].year;
      this.loadAnalyticsData();
    } else if (this.selectedTimePeriod === 'month') {
      if (this.availableYears.length > 0) {
        this.selectedYear = this.availableYears[0].year;
        this.loadAvailableMonths();
      }
    } else if (this.selectedTimePeriod === 'custom-range') {
      // Initialize custom range with default values
      if (this.availableYears.length > 0) {
        this.customRangeFromYear = this.availableYears[this.availableYears.length - 1].year;
        this.customRangeFromMonth = 1;
        this.customRangeToYear = this.availableYears[0].year;
        this.customRangeToMonth = 12;
      }
      // Don't call loadAnalyticsData() - user needs to click "Apply Range"
      console.log('Custom range mode activated, waiting for user input');
    } else if (this.selectedTimePeriod === 'compare') {
      // Initialize with 2 default periods
      this.comparePeriods = [];
      if (this.availableYears.length >= 2) {
        this.addComparePeriod();
        this.addComparePeriod();
        this.comparePeriods[0].year = this.availableYears[1].year;
        this.comparePeriods[0].label = `${this.availableYears[1].year}`;
        this.comparePeriods[1].year = this.availableYears[0].year;
        this.comparePeriods[1].label = `${this.availableYears[0].year}`;
      }
      // Don't call loadAnalyticsData() - user needs to click "Compare"
      console.log('Compare mode activated, waiting for user input');
    }
  }

  onYearChange(): void {
    if (this.selectedTimePeriod === 'month') {
      this.loadAvailableMonths();
    } else {
      this.loadAnalyticsData();
    }
  }

  onMonthChange(): void {
    this.loadAnalyticsData();
  }

  // ===== Custom Range Change Handlers =====
  onCustomRangeFromMonthChange(value: any): void {
    this.customRangeFromMonth = typeof value === 'string' ? parseInt(value, 10) : value;
    console.log('From month changed to:', this.customRangeFromMonth, typeof this.customRangeFromMonth);
  }

  onCustomRangeToMonthChange(value: any): void {
    this.customRangeToMonth = typeof value === 'string' ? parseInt(value, 10) : value;
    console.log('To month changed to:', this.customRangeToMonth, typeof this.customRangeToMonth);
  }

  private loadAvailableMonths(): void {
    if (this.selectedYear) {
      this.kpi.getAvailableMonthsForYear(this.selectedYear).subscribe({
        next: (months) => {
          this.availableMonths = months;
          if (months.length > 0) {
            this.selectedMonth = months[0].month;
          }
          this.loadAnalyticsData();
        },
        error: (err) => console.error('Error loading months:', err)
      });
    }
  }

  // ===== Custom Range Methods =====
  loadCustomRangeData(): void {
    if (!this.store) {
      console.error('Store not available for custom range analysis');
      return;
    }

    console.log('Current custom range values:', {
      fromYear: this.customRangeFromYear, fromYearType: typeof this.customRangeFromYear,
      fromMonth: this.customRangeFromMonth, fromMonthType: typeof this.customRangeFromMonth,
      toYear: this.customRangeToYear, toYearType: typeof this.customRangeToYear,
      toMonth: this.customRangeToMonth, toMonthType: typeof this.customRangeToMonth
    });

    if (!this.customRangeFromYear || !this.customRangeFromMonth || !this.customRangeToYear || !this.customRangeToMonth) {
      console.error('Invalid custom range parameters:', {
        fromYear: this.customRangeFromYear,
        fromMonth: this.customRangeFromMonth,
        toYear: this.customRangeToYear,
        toMonth: this.customRangeToMonth
      });
      return;
    }

    // Ensure all values are numbers
    const fromYear = Number(this.customRangeFromYear);
    const fromMonth = Number(this.customRangeFromMonth);
    const toYear = Number(this.customRangeToYear);
    const toMonth = Number(this.customRangeToMonth);

    console.log('Converted to numbers:', { fromYear, fromMonth, toYear, toMonth });

    // Validate that fromDate is before toDate
    const fromDate = new Date(fromYear, fromMonth - 1);
    const toDate = new Date(toYear, toMonth - 1);

    if (fromDate >= toDate) {
      console.error('From date must be before to date', { fromDate, toDate });
      return;
    }

    console.log('Loading custom range data:', {
      storeId: this.store.storeid,
      fromYear, fromMonth, toYear, toMonth
    });

    this.analyticsLoading = true;
    this.kpi.getStoreCustomRangeAnalytics(
      this.store.storeid,
      fromYear, fromMonth, toYear, toMonth
    ).subscribe({
      next: (data) => {
        this.customRangeData = data;
        console.log('Custom range data loaded successfully:', data);
        console.log('Summary data:', data.summary);
        console.log('Monthly breakdown length:', data.monthlyBreakdown?.length);

        // Verify the data structure before updating KPIs
        if (data && data.summary) {
          console.log('Data structure is valid, updating KPI cards...');
          this.updateKpiCardsWithCustomRange(data);
        } else {
          console.error('Invalid data structure received:', data);
        }

        this.analyticsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Custom range data loading failed:', err);
        this.analyticsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateKpiCardsWithCustomRange(data: any): void {
    console.log('updateKpiCardsWithCustomRange called with data:', data);

    if (data && data.summary) {
      const summary = data.summary;
      console.log('Updating KPI cards with summary:', summary);

      // Manual verification - calculate totals from monthly breakdown
      if (data.monthlyBreakdown && Array.isArray(data.monthlyBreakdown)) {
        const manualTotals = data.monthlyBreakdown.reduce((acc: any, month: any) => {
          acc.totalRevenue += month.total_revenue || 0;
          acc.totalOrders += month.total_orders || 0;
          acc.totalCustomers += month.total_customers || 0;
          acc.totalUnits += month.total_units || 0;
          return acc;
        }, { totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalUnits: 0 });

        console.log('Manual calculation from monthly breakdown:', manualTotals);
        console.log('Backend summary totals:', {
          totalRevenue: summary.totalRevenue,
          totalOrders: summary.totalOrders,
          totalCustomers: summary.totalCustomers,
          totalUnits: summary.totalUnits
        });

        // Use manual totals if they differ significantly from summary
        const useManual = Math.abs(manualTotals.totalRevenue - summary.totalRevenue) > 0.01;
        if (useManual) {
          console.warn('Using manual calculation due to discrepancy');
        }

        const actualTotals = useManual ? manualTotals : summary;
        const avgOrderValue = actualTotals.totalOrders > 0 ? actualTotals.totalRevenue / actualTotals.totalOrders : 0;

        const newKpiCards = [
          {
            title: 'Total Revenue',
            value: this.formatCurrency(actualTotals.totalRevenue || 0),
            subtitle: `${data.period?.label || 'Custom Range'}`,
            icon: 'pi pi-dollar',
            color: 'bg-gradient-to-r from-purple-500 to-purple-600',
            textColor: 'text-white'
          },
          {
            title: 'Total Orders',
            value: this.formatNumber(actualTotals.totalOrders || 0),
            subtitle: `${data.period?.label || 'Custom Range'}`,
            icon: 'pi pi-shopping-cart',
            color: 'bg-gradient-to-r from-purple-400 to-purple-500',
            textColor: 'text-white'
          },
          {
            title: 'Avg Order Value',
            value: this.formatCurrency(avgOrderValue),
            subtitle: `${data.period?.label || 'Custom Range'}`,
            icon: 'pi pi-chart-line',
            color: 'bg-gradient-to-r from-purple-600 to-purple-700',
            textColor: 'text-white'
          },
          {
            title: 'Total Customers',
            value: this.formatNumber(actualTotals.totalCustomers || 0),
            subtitle: `${data.period?.label || 'Custom Range'}`,
            icon: 'pi pi-users',
            color: 'bg-gradient-to-r from-purple-300 to-purple-400',
            textColor: 'text-white'
          }
        ];

        this.kpiCards = newKpiCards;
        console.log('KPI cards updated to:', this.kpiCards);

        // Force change detection
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      } else {
        console.error('No monthly breakdown data available');
      }
    } else {
      console.error('Invalid data structure for KPI update:', data);
    }
  }

  // ===== Compare Periods Methods =====
  addComparePeriod(): void {
    if (this.comparePeriods.length < 4) {
      const defaultYear = this.availableYears.length > 0 ? this.availableYears[0].year : new Date().getFullYear();
      this.comparePeriods.push({
        year: defaultYear,
        label: `Period ${this.comparePeriods.length + 1}`
      });
    }
  }

  removeComparePeriod(index: number): void {
    this.comparePeriods.splice(index, 1);
  }

  loadCompareData(): void {
    if (!this.store || this.comparePeriods.length < 2) {
      return;
    }

    this.analyticsLoading = true;
    this.kpi.getStoreComparePeriods(this.store.storeid, this.comparePeriods).subscribe({
      next: (data) => {
        this.compareData = data;
        console.log('Compare data loaded:', data);

        // Update display with comparison data
        this.updateDisplayWithCompareData(data);
        this.analyticsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Compare data loading failed:', err);
        this.analyticsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateDisplayWithCompareData(data: any): void {
    if (data && data.length > 0) {
      // For now, just update KPI cards with the first comparison period
      // In a full implementation, you'd show a comparison table/chart
      const firstPeriod = data[0];
      if (firstPeriod && firstPeriod.comparisons && firstPeriod.comparisons.length > 0) {
        const firstComparison = firstPeriod.comparisons[0];
        if (firstComparison.metrics) {
          this.kpiCards = [
            {
              title: 'Revenue Comparison',
              value: this.formatCurrency(firstComparison.metrics.total_revenue || 0),
              subtitle: `${firstComparison.label || 'Period 1'}`,
              icon: 'pi pi-dollar',
              color: 'bg-gradient-to-r from-blue-500 to-blue-600',
              textColor: 'text-white'
            },
            {
              title: 'Orders Comparison',
              value: this.formatNumber(firstComparison.metrics.total_orders || 0),
              subtitle: `${firstComparison.label || 'Period 1'}`,
              icon: 'pi pi-shopping-cart',
              color: 'bg-gradient-to-r from-blue-400 to-blue-500',
              textColor: 'text-white'
            },
            {
              title: 'Avg Order Value',
              value: this.formatCurrency(firstComparison.metrics.avg_order_value || 0),
              subtitle: `${firstComparison.label || 'Period 1'}`,
              icon: 'pi pi-chart-line',
              color: 'bg-gradient-to-r from-blue-600 to-blue-700',
              textColor: 'text-white'
            },
            {
              title: 'Customers Comparison',
              value: this.formatNumber(firstComparison.metrics.total_customers || 0),
              subtitle: `${firstComparison.label || 'Period 1'}`,
              icon: 'pi pi-users',
              color: 'bg-gradient-to-r from-blue-300 to-blue-400',
              textColor: 'text-white'
            }
          ];
        }
      }
    }
  }

  // Update getTimePeriodLabel to handle new options
  getTimePeriodLabel(): string {
    switch (this.selectedTimePeriod) {
      case 'year':
        return this.selectedYear ? `Year ${this.selectedYear}` : '';
      case 'month':
        return this.selectedMonth && this.selectedYear ? `${this.selectedMonth}/${this.selectedYear}` : '';
      case 'quarter':
        return this.selectedQuarter && this.selectedYear ? `Q${this.selectedQuarter} ${this.selectedYear}` : '';
      case 'custom-range':
        if (this.customRangeFromYear && this.customRangeFromMonth && this.customRangeToYear && this.customRangeToMonth) {
          return `${this.customRangeFromMonth}/${this.customRangeFromYear} - ${this.customRangeToMonth}/${this.customRangeToYear}`;
        }
        return 'Custom Range';
      case 'compare':
        return `Comparing ${this.comparePeriods.length} periods`;
      default:
        return 'All-time';
    }
  }
}
