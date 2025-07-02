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
  // Product selection and static data
  selectedSku: string = '';
  productsList: ProductInfo[] = [];
  currentProduct: ProductInfo | null = null;
  availableYears: TimePeriodOption[] = [];
  availableMonths: TimePeriodOption[] = [];

  // Filter state
  selectedTimePeriod: TimePeriod = 'all-time';
  selectedYear?: number;
  selectedMonth?: number;
  customStartYear?: number;
  customStartMonth?: number;
  customEndYear?: number;
  customEndMonth?: number;

  // UI state
  loading = false;
  error = false;
  chartsLoading = false;

  // KPI data
  currentKPI: ProductKPI | null = null;

  // Chart options - all 8 charts from spec
  // KPI Cards (K1-K5)
  revenueCardData: any = null;
  ordersCardData: any = null;
  unitsCardData: any = null;
  customersCardData: any = null;
  avgPriceCardData: any = null;

  // Charts (C1-C8)
  revenueTrendChartOptions: Partial<ChartOptions> | null = null;  // C1 - Area
  ordersTrendChartOptions: Partial<ChartOptions> | null = null;   // C2 - Line
  unitsTrendChartOptions: Partial<ChartOptions> | null = null;    // C3 - Column
  aovTrendChartOptions: Partial<ChartOptions> | null = null;      // C4 - Line
  launchProgressChartOptions: any = null;                         // C5 - RadialBar
  yearOverYearChartOptions: Partial<ChartOptions> | null = null;  // C6 - Grouped Column
  monthOverMonthChartOptions: Partial<ChartOptions> | null = null; // C7 - Column
  categoryShareChartOptions: Partial<PieChartOptions> | null = null; // C8 - Pie

  // Color palette from spec
  colorPalette = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

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

    // Load products list and time periods
    forkJoin({
      products: this.http.get<ProductInfo[]>('/api/v2/products/list', { headers: this.getAuthHeaders() }),
      years: this.http.get<TimePeriodOption[]>('/api/v2/chart/time-periods/years', { headers: this.getAuthHeaders() })
    }).subscribe({
      next: (result) => {
        this.productsList = result.products;
        this.availableYears = result.years;
        
        if (this.productsList.length > 0) {
          this.selectedSku = this.productsList[0].sku;
          this.currentProduct = this.productsList[0];
          this.onTimePeriodChange();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading initial data:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  onProductChange(): void {
    this.currentProduct = this.productsList.find(p => p.sku === this.selectedSku) || null;
    this.onTimePeriodChange();
  }

  onTimePeriodChange(): void {
    this.selectedMonth = undefined;
    this.customStartYear = undefined;
    this.customStartMonth = undefined;
    this.customEndYear = undefined;
    this.customEndMonth = undefined;

    if (this.selectedTimePeriod === 'all-time' || this.selectedTimePeriod === 'since-launch') {
      this.loadProductData();
    } else if (this.selectedTimePeriod === 'month') {
      this.loadAvailableMonths();
    } else {
      this.loadProductData();
    }
  }

  onYearChange(): void {
    if (this.selectedTimePeriod === 'month') {
      this.loadAvailableMonths();
    } else {
      this.loadProductData();
    }
  }

  onMonthChange(): void {
    this.loadProductData();
  }

  onCustomRangeChange(): void {
    if (this.customStartYear && this.customStartMonth && 
        this.customEndYear && this.customEndMonth) {
      this.loadProductData();
    }
  }

  loadAvailableMonths(): void {
    if (!this.selectedYear) return;

    this.http.get<TimePeriodOption[]>(`/api/v2/chart/time-periods/months/${this.selectedYear}`, 
      { headers: this.getAuthHeaders() })
      .subscribe({
        next: (months) => {
          this.availableMonths = months;
          if (months.length > 0 && !this.selectedMonth) {
            this.selectedMonth = months[0].month;
          }
          this.loadProductData();
        },
        error: (error) => {
          console.error('Error loading months:', error);
          this.error = true;
        }
      });
  }

  loadProductData(): void {
    if (!this.selectedSku) return;

    this.chartsLoading = true;
    this.error = false;

    const filters = this.buildFilterOptions();
    
    // Build API parameters
    let params = new HttpParams().set('sku', this.selectedSku);
    
    if (filters.timePeriod !== 'all-time') {
      params = params.set('timePeriod', filters.timePeriod);
      if (filters.year) params = params.set('year', filters.year.toString());
      if (filters.month) params = params.set('month', filters.month.toString());
      if (filters.startYear) params = params.set('startYear', filters.startYear.toString());
      if (filters.startMonth) params = params.set('startMonth', filters.startMonth.toString());
      if (filters.endYear) params = params.set('endYear', filters.endYear.toString());
      if (filters.endMonth) params = params.set('endMonth', filters.endMonth.toString());
    }

    if (filters.timePeriod === 'since-launch') {
      params = params.set('sinceLaunch', 'true');
    }

    // Load KPI and trend data
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
        this.updateKpiCards();
        this.buildAllCharts(result);
        this.chartsLoading = false;
      },
      error: (error) => {
        console.error('Error loading product data:', error);
        this.error = true;
        this.chartsLoading = false;
      }
    });
  }

  private buildFilterOptions(): ProductFilterOptions {
    const filters: ProductFilterOptions = {
      timePeriod: this.selectedTimePeriod
    };

    if (this.selectedTimePeriod === 'since-launch' && this.currentProduct) {
      const launchDate = new Date(this.currentProduct.launch_date);
      filters.startYear = launchDate.getFullYear();
      filters.startMonth = launchDate.getMonth() + 1;
      filters.endYear = new Date().getFullYear();
      filters.endMonth = new Date().getMonth() + 1;
    } else if (this.selectedTimePeriod !== 'all-time') {
      filters.year = this.selectedYear;
      filters.month = this.selectedMonth;
      filters.startYear = this.customStartYear;
      filters.startMonth = this.customStartMonth;
      filters.endYear = this.customEndYear;
      filters.endMonth = this.customEndMonth;
    }

    return filters;
  }

  updateKpiCards(): void {
    if (!this.currentKPI) return;

    const colorTheme = this.getColorTheme();

    this.revenueCardData = {
      title: 'Revenue',
      value: this.formatCurrency(this.currentKPI.revenue),
      subtitle: this.getTimePeriodLabel(),
      icon: 'pi pi-dollar',
      ...colorTheme
    };

    this.ordersCardData = {
      title: 'Orders',
      value: this.formatNumber(this.currentKPI.orders),
      subtitle: this.getTimePeriodLabel(),
      icon: 'pi pi-shopping-cart',
      ...colorTheme
    };

    this.unitsCardData = {
      title: 'Units Sold',
      value: this.formatNumber(this.currentKPI.units_sold),
      subtitle: this.getTimePeriodLabel(),
      icon: 'pi pi-box',
      ...colorTheme
    };

    this.customersCardData = {
      title: 'Unique Customers',
      value: this.formatNumber(this.currentKPI.unique_customers),
      subtitle: this.getTimePeriodLabel(),
      icon: 'pi pi-users',
      ...colorTheme
    };

    this.avgPriceCardData = {
      title: 'Avg Price',
      value: this.formatCurrency(this.currentKPI.avg_price),
      subtitle: this.getTimePeriodLabel(),
      icon: 'pi pi-tag',
      ...colorTheme
    };
  }

  private getColorTheme() {
    switch (this.selectedTimePeriod) {
      case 'custom-range':
        return {
          color: 'bg-gradient-to-r from-purple-500 to-purple-600',
          textColor: 'text-white'
        };
      case 'compare':
        return {
          color: 'bg-gradient-to-r from-blue-500 to-blue-600',
          textColor: 'text-white'
        };
      default:
        return {
          color: 'bg-gradient-to-r from-orange-500 to-orange-600',
          textColor: 'text-white'
        };
    }
  }

  buildAllCharts(data: any): void {
    this.buildRevenueTrendChart(data.revenueTrend);      // C1 - Area
    this.buildOrdersTrendChart(data.ordersTrend);        // C2 - Line
    this.buildUnitsTrendChart(data.unitsTrend);          // C3 - Column
    this.buildAOVTrendChart(data.aovTrend);              // C4 - Line
    this.buildLaunchProgressChart();                     // C5 - RadialBar
    this.loadYearOverYearChart();                        // C6 - Grouped Column (real data)
    this.buildMonthOverMonthChart(data.ordersTrend);     // C7 - Column (orders)
    this.loadCategoryShareChart();                       // C8 - Pie (real data)
  }

  // C1 - Revenue Trend (Area Chart)
  buildRevenueTrendChart(data: TrendDataPoint[]): void {
    const chartData = this.processTrendData(data);
    
    this.revenueTrendChartOptions = {
      series: [{
        name: 'Revenue',
        data: chartData.values
      }],
      chart: {
        type: 'area',
        height: 350,
        toolbar: {
          show: true,
          export: {
            csv: { filename: `revenue-trend-${this.selectedSku}-${this.getTimePeriodLabel()}` },
            svg: { filename: `revenue-trend-${this.selectedSku}-${this.getTimePeriodLabel()}` },
            png: { filename: `revenue-trend-${this.selectedSku}-${this.getTimePeriodLabel()}` }
          }
        }
      },
      colors: [this.colorPalette[0]],
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          type: 'vertical',
          gradientToColors: [this.colorPalette[0]],
          stops: [0, 100]
        }
      },
      dataLabels: { enabled: false },
      xaxis: { categories: chartData.labels },
      yaxis: { title: { text: 'Revenue ($)' } },
      grid: { borderColor: '#f1f5f9' },
      tooltip: {
        y: { formatter: (val: number) => this.formatCurrency(val) }
      }
    };
  }

  // C2 - Orders Trend (Line Chart)
  buildOrdersTrendChart(data: TrendDataPoint[]): void {
    const chartData = this.processTrendData(data);
    
    this.ordersTrendChartOptions = {
      series: [{
        name: 'Orders',
        data: chartData.values
      }],
      chart: {
        type: 'line',
        height: 350,
        toolbar: {
          show: true,
          export: {
            csv: { filename: `orders-trend-${this.selectedSku}-${this.getTimePeriodLabel()}` }
          }
        }
      },
      colors: [this.colorPalette[1]],
      stroke: { curve: 'smooth', width: 3 },
      dataLabels: { enabled: false },
      xaxis: { categories: chartData.labels },
      yaxis: { title: { text: 'Orders' } },
      grid: { borderColor: '#f1f5f9' },
      tooltip: {
        y: { formatter: (val: number) => this.formatNumber(val) }
      }
    };
  }

  // C3 - Units Trend (Column Chart)
  buildUnitsTrendChart(data: TrendDataPoint[]): void {
    const chartData = this.processTrendData(data);
    
    this.unitsTrendChartOptions = {
      series: [{
        name: 'Units Sold',
        data: chartData.values
      }],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: {
          show: true,
          export: {
            csv: { filename: `units-trend-${this.selectedSku}-${this.getTimePeriodLabel()}` }
          }
        }
      },
      colors: [this.colorPalette[2]],
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '60%'
        }
      },
      dataLabels: { enabled: false },
      xaxis: { categories: chartData.labels },
      yaxis: { title: { text: 'Units Sold' } },
      grid: { borderColor: '#f1f5f9' },
      tooltip: {
        y: { formatter: (val: number) => this.formatNumber(val) }
      }
    };
  }

  // C4 - AOV Trend (Line Chart)
  buildAOVTrendChart(data: TrendDataPoint[]): void {
    const chartData = this.processTrendData(data);
    
    this.aovTrendChartOptions = {
      series: [{
        name: 'Average Order Value',
        data: chartData.values
      }],
      chart: {
        type: 'line',
        height: 350,
        toolbar: {
          show: true,
          export: {
            csv: { filename: `aov-trend-${this.selectedSku}-${this.getTimePeriodLabel()}` }
          }
        }
      },
      colors: [this.colorPalette[3]],
      stroke: { curve: 'smooth', width: 3 },
      dataLabels: { enabled: false },
      xaxis: { categories: chartData.labels },
      yaxis: { title: { text: 'Average Order Value ($)' } },
      grid: { borderColor: '#f1f5f9' },
      tooltip: {
        y: { formatter: (val: number) => this.formatCurrency(val) }
      }
    };
  }

  // C5 - Launch-to-Date Progress (RadialBar)
  buildLaunchProgressChart(): void {
    const target = this.currentKPI ? this.currentKPI.revenue * this.LAUNCH_PROGRESS_TARGET_MULTIPLIER : 100000;
    const current = this.currentKPI ? this.currentKPI.revenue : 0;
    const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    this.launchProgressChartOptions = {
      series: [percentage],
      chart: { type: 'radialBar', height: 350 },
      colors: [this.colorPalette[4]],
      plotOptions: { radialBar: { startAngle: -90, endAngle: 90, dataLabels: { name: { fontSize: '16px', color: undefined, offsetY: 120 }, value: { offsetY: 76, fontSize: '22px', color: undefined, formatter: (val: number) => val.toFixed(1) + '%' } } } },
      fill: { type: 'gradient', gradient: { shade: 'light', shadeIntensity: 0.4, inverseColors: false, opacityFrom: 1, opacityTo: 1, stops: [0, 50, 53, 91] } },
      labels: ['Progress to Target']
    };
  }

  // C6 - Year-over-Year Revenue (Grouped Column)
  loadYearOverYearChart(): void {
    if (!this.selectedSku) return;
    // Use current year and previous year for comparison
    const year = this.selectedYear || new Date().getFullYear();
    this.kpiService.getProductComparison(this.selectedSku, 'year', year).subscribe(result => {
      if (result && result.current && result.previous) {
        this.yearOverYearChartOptions = {
          series: [
            { name: 'Current Year', data: result.current.monthlyRevenue },
            { name: 'Previous Year', data: result.previous.monthlyRevenue }
          ],
          chart: { type: 'bar', height: 350, toolbar: { show: true } },
          colors: [this.colorPalette[0], this.colorPalette[1]],
          plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
          dataLabels: { enabled: false },
          xaxis: { categories: result.current.months },
          yaxis: { title: { text: 'Revenue ($)' } },
          legend: { position: 'top' },
          grid: { borderColor: '#f1f5f9' }
        };
      } else {
        this.yearOverYearChartOptions = null;
      }
    });
  }

  // C7 - Month-over-Month Orders (Column)
  buildMonthOverMonthChart(data: TrendDataPoint[]): void {
    const chartData = this.processTrendData(data);
    
    this.monthOverMonthChartOptions = {
      series: [{
        name: 'Monthly Orders',
        data: chartData.values
      }],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: true }
      },
      colors: [this.colorPalette[5]],
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '60%'
        }
      },
      dataLabels: { enabled: false },
      xaxis: { categories: chartData.labels },
      yaxis: { title: { text: 'Orders' } },
      grid: { borderColor: '#f1f5f9' }
    };
  }

  // C8 - Revenue Share by Category (Pie)
  loadCategoryShareChart(): void {
    if (!this.selectedSku) return;
    // Use the trend endpoint with metric 'revenue' and group by category
    const params = new HttpParams().set('sku', this.selectedSku).set('metric', 'revenue').set('interval', 'category');
    this.http.get<any[]>('/api/v2/products/trend', { headers: this.getAuthHeaders(), params }).subscribe(data => {
      if (data && data.length > 0) {
        const labels = data.map(d => d.category);
        const series = data.map(d => d.revenue);
        this.categoryShareChartOptions = {
          series,
          chart: { type: 'pie', height: 350 },
          labels,
          colors: this.colorPalette,
          dataLabels: { enabled: true, formatter: (val: number) => val.toFixed(1) + '%' },
          plotOptions: { pie: { donut: { size: '65%' } } },
          legend: { position: 'bottom' }
        };
      } else {
        this.categoryShareChartOptions = null;
      }
    });
  }

  private processTrendData(data: TrendDataPoint[]) {
    const labels: string[] = [];
    const values: number[] = [];

    data.forEach(point => {
      if (point.mo === 0) {
        labels.push(point.yr.toString());
      } else {
        labels.push(`${point.yr}-${point.mo.toString().padStart(2, '0')}`);
      }
      values.push(point.metric_value);
    });

    return { labels, values };
  }

  exportChartData(chartType: string): void {
    if (chartType === 'launch-progress') {
      // Export launch progress as CSV
      const csv = `Metric,Value\nRevenue,${this.currentKPI?.revenue || 0}\nTarget,${this.LAUNCH_PROGRESS_TARGET_MULTIPLIER * (this.currentKPI?.revenue || 0)}\nProgress,${this.launchProgressChartOptions?.series?.[0] || 0}%`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `launch-progress-${this.selectedSku}.csv`;
      link.click();
      return;
    }
    if (chartType === 'year-over-year') {
      // Export year-over-year as CSV
      if (this.yearOverYearChartOptions && this.yearOverYearChartOptions.series && this.yearOverYearChartOptions.xaxis && (this.yearOverYearChartOptions.xaxis as any).categories) {
        const csv = ['Month,' + (this.yearOverYearChartOptions.series as any[]).map(s => s.name).join(',')];
        const months = (this.yearOverYearChartOptions.xaxis as any).categories || [];
        for (let i = 0; i < months.length; i++) {
          const row = [months[i]];
          for (const s of (this.yearOverYearChartOptions.series as any[])) {
            row.push(s.data[i]);
          }
          csv.push(row.join(','));
        }
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `year-over-year-${this.selectedSku}.csv`;
        link.click();
      }
      return;
    }
    if (chartType === 'category-share') {
      // Export category share as CSV
      if (this.categoryShareChartOptions && this.categoryShareChartOptions.labels && this.categoryShareChartOptions.series) {
        const csv = ['Category,Revenue'];
        for (let i = 0; i < this.categoryShareChartOptions.labels.length; i++) {
          csv.push(`${this.categoryShareChartOptions.labels[i]},${this.categoryShareChartOptions.series[i]}`);
        }
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `category-share-${this.selectedSku}.csv`;
        link.click();
      }
      return;
    }
    // Default: trend export
    const filters = this.buildFilterOptions();
    let params = new HttpParams().set('sku', this.selectedSku).set('metric', chartType);
    if (filters.timePeriod !== 'all-time') {
      params = params.set('timePeriod', filters.timePeriod);
      if (filters.year) params = params.set('year', filters.year.toString());
      if (filters.month) params = params.set('month', filters.month.toString());
    }
    const url = `/api/v2/products/trend/export?${params.toString()}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `product-${chartType}-${this.selectedSku}.csv`;
    link.click();
  }

  refreshData(): void {
    this.loadProductData();
  }

  getTimePeriodLabel(): string {
    switch (this.selectedTimePeriod) {
      case 'all-time':
        return 'All Time Data';
      case 'year':
        return this.selectedYear ? `Year ${this.selectedYear}` : 'Year View';
      case 'month':
        if (this.selectedYear && this.selectedMonth) {
          const monthData = this.availableMonths.find(m => m.month === this.selectedMonth);
          return monthData ? `${monthData.month_name_label} ${this.selectedYear}` : `Month ${this.selectedMonth}, ${this.selectedYear}`;
        }
        return 'Month View';
      case 'custom-range':
        if (this.customStartYear && this.customStartMonth && this.customEndYear && this.customEndMonth) {
          return `Custom: ${this.customStartMonth}/${this.customStartYear} - ${this.customEndMonth}/${this.customEndYear}`;
        }
        return 'Custom Range';
      case 'since-launch':
        return 'Since Launch';
      case 'compare':
        return 'Comparison View';
      default:
        return 'Unknown Period';
    }
  }

  // Utility methods
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
}