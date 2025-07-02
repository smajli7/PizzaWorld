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
  ApexLegend,
  ApexNonAxisChartSeries,
  ChartComponent
} from 'ng-apexcharts';

interface Product {
  sku: string;
  product_name: string;
  size: string;
  price: number;
  category: string;
  launch_date: string;
}

interface ProductPerformance {
  sku: string;
  product_name: string;
  size: string;
  price: number;
  category: string;
  launch_date: string;
  total_revenue: number;
  amount_ordered: number;
  units_sold: number;
}

interface ProductKPIs {
  totalRevenue: number;
  totalOrders: number;
  totalUnits: number;
  totalProducts: number;
  avgPrice: number;
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
  yaxis?: ApexYAxis;
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
  series: ApexNonAxisChartSeries;
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

  // Header filters
  selectedYear?: number;
  selectedMonth?: number;
  selectedCategory?: string;
  searchTerm: string = '';

  // Custom date range filters
  useCustomDateRange: boolean = false;
  startDate?: string;
  endDate?: string;

  // Available filter options
  availableYears: TimePeriodOption[] = [];
  availableMonths: TimePeriodOption[] = [];
  availableCategories: string[] = ['Pizza', 'Appetizers', 'Beverages', 'Desserts', 'Specialty'];

  // Tables data
  catalogueProducts: Product[] = [];
  performanceProducts: ProductPerformance[] = [];

  // No pagination - show all data in scrollable tables

  // KPIs
  kpis: ProductKPIs | null = null;

  // Charts
  topProductsChart: Partial<ChartOptions> | null = null;
  revenueTrendChart: Partial<ChartOptions> | null = null;
  scatterChart: Partial<ChartOptions> | null = null;
  aovTrendChart: Partial<ChartOptions> | null = null;
  categoryDonutChart: Partial<PieChartOptions> | null = null;
  heatmapChart: Partial<ChartOptions> | null = null;

    // UI state
  loading = false;
  error = false;
  chartsLoading = false;

  // Export loading states
  exportCatalogueLoading = false;
  exportPerformanceLoading = false;

  // Sorting for catalogue products
  catalogueSortColumn: 'sku' | 'price' = 'sku';
  catalogueSortAscending = true;

  // Color palette
  colorPalette = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];

  constructor(private http: HttpClient) {}

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

    // Load time periods for filters
    this.http.get<TimePeriodOption[]>('/api/v2/chart/time-periods/years', { headers: this.getAuthHeaders() })
      .subscribe({
        next: (years) => {
          this.availableYears = years;
          this.loadCatalogueData();
          this.loadPerformanceData();
          this.loadKPIs();
          this.loadCharts();
        },
        error: (error) => {
          console.error('Error loading years:', error);
          this.error = true;
          this.loading = false;
        }
      });
  }

  onFiltersChange(): void {
    this.loadPerformanceData();
    this.loadKPIs();
    this.loadCharts();
  }

  onYearChange(): void {
    this.selectedMonth = undefined;
    if (this.selectedYear) {
      this.loadAvailableMonths();
    }
    this.onFiltersChange();
  }

  onCatalogueSearchChange(): void {
    this.loadCatalogueData();
  }

  loadAvailableMonths(): void {
    if (!this.selectedYear) return;

    const params = new HttpParams().set('year', this.selectedYear.toString());
    this.http.get<TimePeriodOption[]>('/api/v2/chart/time-periods/months',
      { headers: this.getAuthHeaders(), params })
      .subscribe({
        next: (months) => {
          this.availableMonths = months;
        },
        error: (error) => {
          console.error('Error loading months:', error);
        }
      });
  }

    loadCatalogueData(): void {
    let params = new HttpParams();

    if (this.searchTerm) {
      params = params.set('search', this.searchTerm);
    }

    // Use the enhanced endpoint that includes launch_date
    this.http.get<Product[]>('/api/v2/products', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.catalogueProducts = data;
      },
      error: (error) => {
        console.error('Error loading catalogue:', error);
        this.error = true;
      }
    });
  }

  loadPerformanceData(): void {
    let params = new HttpParams();

    // Only add year/month if not using custom date range
    if (!this.useCustomDateRange) {
      if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
      if (this.selectedMonth) params = params.set('month', this.selectedMonth.toString());
    } else {
      // Use custom date range
      if (this.startDate) params = params.set('startDate', this.startDate);
      if (this.endDate) params = params.set('endDate', this.endDate);
    }

    if (this.selectedCategory) params = params.set('category', this.selectedCategory);
    if (this.searchTerm) params = params.set('search', this.searchTerm);

    this.http.get<ProductPerformance[]>('/api/v2/products/performance', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.performanceProducts = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading performance:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  loadKPIs(): void {
    let params = new HttpParams();

    if (!this.useCustomDateRange) {
      if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
    } else {
      if (this.startDate) params = params.set('startDate', this.startDate);
      if (this.endDate) params = params.set('endDate', this.endDate);
    }

    if (this.selectedCategory) params = params.set('category', this.selectedCategory);

    this.http.get<ProductKPIs>('/api/v2/products/kpis', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.kpis = data;
      },
      error: (error) => {
        console.error('Error loading KPIs:', error);
      }
    });
  }

  loadCharts(): void {
    this.chartsLoading = true;

    let params = new HttpParams();

    if (!this.useCustomDateRange) {
      if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
      if (this.selectedMonth) params = params.set('month', this.selectedMonth.toString());
    } else {
      if (this.startDate) params = params.set('startDate', this.startDate);
      if (this.endDate) params = params.set('endDate', this.endDate);
    }

    if (this.selectedCategory) params = params.set('category', this.selectedCategory);

    // Load top products chart data
    this.http.get<any>('/api/v2/products/charts/top-products', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.topProductsChart = {
          series: [{
            name: 'Revenue',
            data: data.revenues
          }],
          chart: {
            type: 'bar',
            height: 400,
            toolbar: {
              show: false
            }
          },
          xaxis: {
            categories: data.products,
            labels: {
              style: {
                fontSize: '12px'
              }
            }
          },
          colors: [this.colorPalette[0]],
          dataLabels: {
            enabled: false
          },
          plotOptions: {
            bar: {
              borderRadius: 4,
              horizontal: true
            }
          }
        };
      }
    });

    // Load category revenue share chart data
    this.http.get<any>('/api/v2/products/charts/category-share', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.categoryDonutChart = {
          series: data.shares,
          chart: {
            type: 'donut',
            height: 350
          },
          labels: data.categories,
          colors: this.colorPalette,
          dataLabels: {
            enabled: true
          },
          plotOptions: {
            pie: {
              donut: {
                size: '70%'
              }
            }
          },
          legend: {
            position: 'bottom'
          }
        };
        this.chartsLoading = false;
      },
      error: (error) => {
        console.error('Error loading charts:', error);
        this.chartsLoading = false;
      }
    });
  }

  // No pagination needed - all data shown in scrollable tables

  // Computed property for sorted catalogue products
  get sortedCatalogueProducts(): Product[] {
    return [...this.catalogueProducts].sort((a, b) => {
      const multiplier = this.catalogueSortAscending ? 1 : -1;

      switch (this.catalogueSortColumn) {
        case 'sku':
          return multiplier * a.sku.localeCompare(b.sku);
        case 'price':
          return multiplier * (a.price - b.price);
        default:
          return 0;
      }
    });
  }

  // Sort function for catalogue table
  sortCatalogue(column: 'sku' | 'price'): void {
    if (this.catalogueSortColumn === column) {
      this.catalogueSortAscending = !this.catalogueSortAscending;
    } else {
      this.catalogueSortColumn = column;
      this.catalogueSortAscending = true;
    }
  }

  // Export functions
  exportCatalogue(): void {
    this.exportCatalogueLoading = true;

    this.http.get('/api/v2/products/export', {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pizza-world-products-catalogue-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.exportCatalogueLoading = false;
      },
      error: (error) => {
        console.error('Error exporting catalogue:', error);
        this.exportCatalogueLoading = false;
      }
    });
  }

  exportPerformance(): void {
    this.exportPerformanceLoading = true;

    let params = new HttpParams();

    if (!this.useCustomDateRange) {
      if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
      if (this.selectedMonth) params = params.set('month', this.selectedMonth.toString());
    } else {
      if (this.startDate) params = params.set('startDate', this.startDate);
      if (this.endDate) params = params.set('endDate', this.endDate);
    }

    if (this.selectedCategory) params = params.set('category', this.selectedCategory);

    this.http.get('/api/v2/products/performance/export', {
      headers: this.getAuthHeaders(),
      params,
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pizza-world-products-performance-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.exportPerformanceLoading = false;
      },
      error: (error) => {
        console.error('Error exporting performance:', error);
        this.exportPerformanceLoading = false;
      }
    });
  }

  getFilterLabel(): string {
    if (this.useCustomDateRange) {
      if (this.startDate && this.endDate) {
        return `${this.startDate} to ${this.endDate}`;
      } else if (this.startDate) {
        return `From ${this.startDate}`;
      } else if (this.endDate) {
        return `Until ${this.endDate}`;
      }
      return 'All Time';
    }

    if (this.selectedYear && this.selectedMonth) {
      const month = this.availableMonths.find(m => m.month === this.selectedMonth);
      return `${month?.month_name_label || this.selectedMonth} ${this.selectedYear}`;
    } else if (this.selectedYear) {
      return `${this.selectedYear}`;
    } else if (this.selectedCategory) {
      return `${this.selectedCategory} (All Time)`;
    }
    return 'All Time';
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

  // Toggle between preset filters and custom date range
  toggleDateRangeMode(): void {
    this.useCustomDateRange = !this.useCustomDateRange;
    if (this.useCustomDateRange) {
      // Clear preset filters when switching to custom range
      this.selectedYear = undefined;
      this.selectedMonth = undefined;
    } else {
      // Clear custom date range when switching to preset filters
      this.startDate = undefined;
      this.endDate = undefined;
    }
    this.onFiltersChange();
  }
}
