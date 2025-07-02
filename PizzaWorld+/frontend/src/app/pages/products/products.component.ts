import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexDataLabels,
  ApexTooltip,
  ApexGrid,
  ApexPlotOptions,
  ApexFill,
  ApexStroke,
  ApexLegend
} from 'ng-apexcharts';
import { forkJoin } from 'rxjs';
import { KpiService } from '../../core/kpi.service';

type TimePeriod = 'all-time' | 'year' | 'month' | 'custom-range' | 'since-launch' | 'compare';

interface ProductFilterOptions {
  timePeriod: TimePeriod;
  year?: number;
  month?: number;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
}

interface ProductInfo {
  sku: string;
  product_name: string;
  category: string;
  size: string;
  launch_date: string;
}

interface ProductKPI {
  revenue: number;
  orders: number;
  units_sold: number;
  unique_customers: number;
  avg_price: number;
  avg_order_value: number;
}

interface TrendDataPoint {
  yr: number;
  mo: number;
  metric_value: number;
}

interface TimePeriodOption {
  year: number;
  month?: number;
  year_label: string;
  month_label?: string;
  month_name_label?: string;
}

interface ChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  title?: any;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  plotOptions?: ApexPlotOptions;
  stroke?: ApexStroke;
  grid?: ApexGrid;
  colors: string[];
  fill?: ApexFill;
  legend?: ApexLegend;
  toolbar?: any;
}

interface PieChartOptions {
  series: number[];
  chart: ApexChart;
  labels: string[];
  colors: string[];
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  legend: ApexLegend;
  toolbar?: any;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, SidebarComponent, RouterModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent implements OnInit {
  // Overview filtering
  selectedTimePeriod: TimePeriod = 'all-time';
  selectedYear?: number;
  selectedMonth?: number;
  availableYears: TimePeriodOption[] = [];
  availableMonths: TimePeriodOption[] = [];

  // UI state
  loading = false;
  error = false;
  overviewChartLoading = false;

  // Overview chart
  overviewChartOptions: Partial<ChartOptions> | null = null;

  // More Insights functionality
  showMoreInsights = false;
  productsList: ProductInfo[] = [];
  selectedSku: string = '';
  currentProduct: ProductInfo | null = null;
  currentKPI: ProductKPI | null = null;

  // Detailed analytics charts
  revenueTrendChartOptions: Partial<ChartOptions> | null = null;
  ordersTrendChartOptions: Partial<ChartOptions> | null = null;
  unitsTrendChartOptions: Partial<ChartOptions> | null = null;
  aovTrendChartOptions: Partial<ChartOptions> | null = null;

  // Color palette from spec
  colorPalette = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

  // Product table properties
  productTableData: any[] = [];
  productTableSortColumn: 'total_revenue' | 'total_quantity' | 'product_name' | 'category' | 'size' = 'total_revenue';
  productTableSortAscending = false;

  readonly LAUNCH_PROGRESS_TARGET_MULTIPLIER = 1.5;

  constructor(private http: HttpClient, private kpiService: KpiService) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  loadInitialData(): void {
    this.loading = true;
    this.error = false;

    // Load time periods and products list, then load overview data
    forkJoin({
      years: this.http.get<TimePeriodOption[]>('/api/v2/chart/time-periods/years', { headers: this.getAuthHeaders() }),
      products: this.http.get<ProductInfo[]>('/api/v2/products/list', { headers: this.getAuthHeaders() })
    }).subscribe({
      next: (result) => {
        this.availableYears = result.years;
        this.productsList = result.products;
        this.loadOverviewData();
      },
      error: (error) => {
        console.error('Error loading initial data:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  onTimePeriodChange(): void {
    this.selectedMonth = undefined;
    if (this.selectedTimePeriod === 'year' || this.selectedTimePeriod === 'month') {
      this.loadAvailableMonths();
    } else {
      this.loadOverviewData();
    }
  }

  onYearChange(): void {
    if (this.selectedTimePeriod === 'month') {
      this.loadAvailableMonths();
    } else {
      this.loadOverviewData();
    }
  }

  onMonthChange(): void {
    this.loadOverviewData();
  }

  loadAvailableMonths(): void {
    if (!this.selectedYear) return;

    this.http.get<TimePeriodOption[]>(`/api/v2/chart/time-periods/months/${this.selectedYear}`,
      { headers: this.getAuthHeaders() })
      .subscribe({
        next: (months) => {
          this.availableMonths = months;
          if (months.length > 0 && !this.selectedMonth && this.selectedTimePeriod === 'month') {
            this.selectedMonth = months[0].month;
          }
          this.loadOverviewData();
        },
        error: (error) => {
          console.error('Error loading months:', error);
          this.error = true;
        }
      });
  }

    loadOverviewData(): void {
    this.overviewChartLoading = true;
    this.error = false;

    // Build API parameters for overview chart
    let params = new HttpParams();
    params = params.set('timePeriod', this.selectedTimePeriod);

    if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
    if (this.selectedMonth) params = params.set('month', this.selectedMonth.toString());

    this.http.get<any[]>('/api/v2/products/overview-chart', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.buildOverviewChart(data);
        this.overviewChartLoading = false;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading overview data:', error);
        this.error = true;
        this.overviewChartLoading = false;
        this.loading = false;
      }
    });
  }

    private buildOverviewChart(data: any[]): void {
    if (!data || data.length === 0) {
      this.overviewChartOptions = null;
      this.productTableData = [];
      return;
    }

    // Store table data
    this.productTableData = data;

    // Transform data for chart
    const chartData = data.map(item => ({
      x: item.product_name,
      y: item.total_revenue,
      sku: item.sku,
      category: item.category,
      orders: item.total_orders,
      units: item.total_units
    }));

    this.overviewChartOptions = {
      series: [{
        name: 'Revenue',
        data: chartData.map(item => item.y)
      }],
      chart: {
        type: 'bar',
        height: 400,
        toolbar: {
          show: true,
          export: {
            csv: {
              filename: `products-overview-${this.getTimePeriodLabel()}`
            },
            svg: {
              filename: `products-overview-${this.getTimePeriodLabel()}`
            },
            png: {
              filename: `products-overview-${this.getTimePeriodLabel()}`
            }
          }
        }
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '55%',
          borderRadius: 4
        }
      },
      dataLabels: {
        enabled: false
      },
      xaxis: {
        categories: chartData.map(item => item.x),
        labels: {
          rotate: -45,
          style: {
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        title: {
          text: 'Revenue ($)'
        },
        labels: {
          formatter: (value: number) => this.formatCurrency(value)
        }
      },
      colors: [this.colorPalette[0]],
      tooltip: {
        y: {
          formatter: (value: number, opts: any) => {
            const dataIndex = opts.dataPointIndex;
            const item = chartData[dataIndex];
            return `<div>
              <strong>Revenue:</strong> ${this.formatCurrency(value)}<br/>
              <strong>Orders:</strong> ${this.formatNumber(item.orders)}<br/>
              <strong>Units:</strong> ${this.formatNumber(item.units)}<br/>
              <strong>Category:</strong> ${item.category}
            </div>`;
          }
        }
      },
      grid: {
        borderColor: '#f1f5f9'
      }
    };
  }

  toggleMoreInsights(): void {
    this.showMoreInsights = !this.showMoreInsights;
    if (this.showMoreInsights && this.productsList.length > 0 && !this.selectedSku) {
      // Auto-select first product when opening insights
      this.selectedSku = this.productsList[0].sku;
      this.onProductChange();
    }
  }

  onProductChange(): void {
    this.currentProduct = this.productsList.find(p => p.sku === this.selectedSku) || null;
    if (this.currentProduct) {
      this.loadProductAnalytics();
    }
  }

    private loadProductAnalytics(): void {
    if (!this.selectedSku) return;

    // Build API parameters for detailed product analytics
    let params = new HttpParams().set('sku', this.selectedSku).set('timePeriod', this.selectedTimePeriod);

    if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
    if (this.selectedMonth) params = params.set('month', this.selectedMonth.toString());

    // Load KPI and trend data for the selected product
    forkJoin({
      kpi: this.http.get<ProductKPI>('/api/v2/products/kpi', {
        headers: this.getAuthHeaders(),
        params
      }),
      revenueTrend: this.http.get<TrendDataPoint[]>('/api/v2/products/trend', {
        headers: this.getAuthHeaders(),
        params: params.set('metric', 'revenue').set('interval', 'month')
      }),
      ordersTrend: this.http.get<TrendDataPoint[]>('/api/v2/products/trend', {
        headers: this.getAuthHeaders(),
        params: params.set('metric', 'orders').set('interval', 'month')
      }),
      unitsTrend: this.http.get<TrendDataPoint[]>('/api/v2/products/trend', {
        headers: this.getAuthHeaders(),
        params: params.set('metric', 'units').set('interval', 'month')
      }),
      aovTrend: this.http.get<TrendDataPoint[]>('/api/v2/products/trend', {
        headers: this.getAuthHeaders(),
        params: params.set('metric', 'aov').set('interval', 'month')
      })
    }).subscribe({
      next: (result) => {
        this.currentKPI = result.kpi;
        this.buildRevenueTrendChart(result.revenueTrend);
        this.buildOrdersTrendChart(result.ordersTrend);
        this.buildUnitsTrendChart(result.unitsTrend);
        this.buildAOVTrendChart(result.aovTrend);
      },
      error: (error) => {
        console.error('Error loading product analytics:', error);
        // Reset charts on error
        this.currentKPI = null;
        this.revenueTrendChartOptions = null;
        this.ordersTrendChartOptions = null;
        this.unitsTrendChartOptions = null;
        this.aovTrendChartOptions = null;
      }
    });
  }

  // Chart building methods
  private buildRevenueTrendChart(data: TrendDataPoint[]): void {
    const chartData = this.processTrendData(data);

    this.revenueTrendChartOptions = {
      series: [{
        name: 'Revenue',
        data: chartData.values
      }],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: true }
      },
      colors: [this.colorPalette[0]],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3
        }
      },
      xaxis: {
        categories: chartData.labels,
        labels: { style: { fontSize: '12px' } }
      },
      yaxis: {
        labels: {
          formatter: (value: number) => this.formatCurrency(value)
        }
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatCurrency(value)
        }
      },
      grid: { borderColor: '#f1f5f9' }
    };
  }

  private buildOrdersTrendChart(data: TrendDataPoint[]): void {
    const chartData = this.processTrendData(data);

    this.ordersTrendChartOptions = {
      series: [{
        name: 'Orders',
        data: chartData.values
      }],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: true }
      },
      colors: [this.colorPalette[1]],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      xaxis: {
        categories: chartData.labels,
        labels: { style: { fontSize: '12px' } }
      },
      yaxis: {
        labels: {
          formatter: (value: number) => this.formatNumber(value)
        }
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatNumber(value)
        }
      },
      grid: { borderColor: '#f1f5f9' }
    };
  }

  private buildUnitsTrendChart(data: TrendDataPoint[]): void {
    const chartData = this.processTrendData(data);

    this.unitsTrendChartOptions = {
      series: [{
        name: 'Units Sold',
        data: chartData.values
      }],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: true }
      },
      colors: [this.colorPalette[2]],
      plotOptions: {
        bar: {
          columnWidth: '60%',
          borderRadius: 8
        }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: chartData.labels,
        labels: { style: { fontSize: '12px' } }
      },
      yaxis: {
        labels: {
          formatter: (value: number) => this.formatNumber(value)
        }
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatNumber(value)
        }
      },
      grid: { borderColor: '#f1f5f9' }
    };
  }

  private buildAOVTrendChart(data: TrendDataPoint[]): void {
    const chartData = this.processTrendData(data);

    this.aovTrendChartOptions = {
      series: [{
        name: 'Avg Order Value',
        data: chartData.values
      }],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: true }
      },
      colors: [this.colorPalette[4]],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      xaxis: {
        categories: chartData.labels,
        labels: { style: { fontSize: '12px' } }
      },
      yaxis: {
        labels: {
          formatter: (value: number) => this.formatCurrency(value)
        }
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatCurrency(value)
        }
      },
      grid: { borderColor: '#f1f5f9' }
    };
  }

  private processTrendData(data: TrendDataPoint[]) {
    const sortedData = data.sort((a, b) => {
      if (a.yr !== b.yr) return a.yr - b.yr;
      return a.mo - b.mo;
    });

    const labels = sortedData.map(item => {
      if (item.yr === 0 && item.mo === 0) return 'All Time';
      if (item.mo === 0) return `${item.yr}`;
      return `${item.yr}-${item.mo.toString().padStart(2, '0')}`;
    });

    const values = sortedData.map(item => item.metric_value);

    return { labels, values };
  }

  exportOverviewChart(): void {
    // This will be handled by the chart's built-in export functionality
    console.log('Export overview chart');
  }

  getTimePeriodLabel(): string {
    switch (this.selectedTimePeriod) {
      case 'all-time':
        return 'All Time';
      case 'year':
        return this.selectedYear ? `Year ${this.selectedYear}` : 'Year';
      case 'month':
        return this.selectedYear && this.selectedMonth
          ? `${this.selectedYear}-${this.selectedMonth.toString().padStart(2, '0')}`
          : 'Month';
      default:
        return 'All Time';
    }
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
    return new Intl.NumberFormat('en-US').format(value);
  }

  // Product table methods
  sortProductTable(column: 'total_revenue' | 'total_quantity' | 'product_name' | 'category' | 'size'): void {
    if (this.productTableSortColumn === column) {
      this.productTableSortAscending = !this.productTableSortAscending;
    } else {
      this.productTableSortColumn = column;
      this.productTableSortAscending = false;
    }
  }

  getProductTableSortedData(): any[] {
    if (!this.productTableData || this.productTableData.length === 0) {
      return [];
    }

    const sorted = [...this.productTableData].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (this.productTableSortColumn) {
        case 'total_revenue':
          aVal = a.total_revenue || 0;
          bVal = b.total_revenue || 0;
          break;
        case 'total_quantity':
          aVal = a.total_quantity || a.total_units || 0;
          bVal = b.total_quantity || b.total_units || 0;
          break;
        case 'product_name':
          aVal = (a.name || a.product_name || '').toLowerCase();
          bVal = (b.name || b.product_name || '').toLowerCase();
          break;
        case 'category':
          aVal = (a.category || '').toLowerCase();
          bVal = (b.category || '').toLowerCase();
          break;
        case 'size':
          aVal = (a.size || '').toLowerCase();
          bVal = (b.size || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return this.productTableSortAscending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return this.productTableSortAscending ? aVal - bVal : bVal - aVal;
      }
    });

    return sorted;
  }
}
