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
  ApexPlotOptions
} from 'ng-apexcharts';

interface StoreRevenueData {
  storeid: string;
  city: string;
  state_name?: string;
  state_abbr: string;
  year?: number;
  month?: number;
  month_label?: string;
  month_name_label?: string;
  yearly_revenue?: number;
  monthly_revenue?: number;
  total_revenue?: number;
  yearly_orders?: number;
  monthly_orders?: number;
  total_orders?: number;
  order_count?: number;
  yearly_unique_customers?: number;
  monthly_unique_customers?: number;
  total_unique_customers?: number;
  unique_customers?: number;
  yearly_avg_order_value?: number;
  monthly_avg_order_value?: number;
  avg_order_value?: number;
}

interface TimePeriodOption {
  year: number;
  month?: number;
  year_label: string;
  month_label?: string;
  month_name_label?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, SidebarComponent, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  // Chart data
  storeRevenueData: StoreRevenueData[] = [];
  filteredStoreData: StoreRevenueData[] = [];
  availableYears: TimePeriodOption[] = [];
  availableMonths: TimePeriodOption[] = [];
  
  // Filter state
  selectedTimePeriod: 'all-time' | 'year' | 'month' | 'custom' = 'all-time';
  selectedYear?: number;
  selectedMonth?: number;
  customStartYear?: number;
  customStartMonth?: number;
  customEndYear?: number;
  customEndMonth?: number;
  
  // UI state
  loading = false;
  error = false;
  
  // Chart controls
  chartSortAscending = false; // false = descending (default), true = ascending
  ordersChartSortAscending = false;
  avgOrderChartSortAscending = false;
  customersChartSortAscending = false;
  
  // Table sorting
  tableSortColumn: 'revenue' | 'orders' | 'customers' | 'avgOrder' | 'store' = 'revenue';
  tableSortAscending = false;
  
  // Filters
  searchTerm = '';
  selectedState = '';
  minRevenue = 0;
  maxRevenue = 0;
  
  // Chart options
  revenueChartOptions: any = null;
  ordersChartOptions: any = null;
  avgOrderValueChartOptions: any = null;
  customersChartOptions: any = null;
  
  // Comprehensive Analytics Data
  hourlyPerformanceData: any[] = [];
  productPerformanceData: any[] = [];
  peakHoursData: any[] = [];
  seasonalData: any[] = [];
  
  // Analytics Chart Options
  hourlyChartOptions: any = null;
  productChartOptions: any = null;
  peakHoursChartOptions: any = null;
  seasonalChartOptions: any = null;
  
  // Analytics Controls
  showAnalytics = false;
  analyticsTimePeriod: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | '' = '';
  analyticsSeason: 'Winter' | 'Spring' | 'Summer' | 'Fall' | '' = '';
  analyticsCategory = '';
  analyticsLimit = 20;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAvailableYears();
    // loadDashboardData() will be called from loadAvailableYears() after years are loaded
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  loadAvailableYears(): void {
    this.http.get<TimePeriodOption[]>('/api/v2/chart/time-periods/years', { headers: this.getAuthHeaders() })
      .subscribe({
        next: (years) => {
          this.availableYears = years;
          // Only set year if we're not in all-time mode
          if (years.length > 0 && !this.selectedYear && this.selectedTimePeriod !== 'all-time') {
            this.selectedYear = years[0].year;
          }
          if (this.selectedTimePeriod !== 'all-time') {
            this.loadAvailableMonths();
          } else {
            // For all-time mode, load data immediately
            this.loadDashboardData();
          }
        },
        error: (error) => console.error('Failed to load available years:', error)
      });
  }

  loadAvailableMonths(): void {
    if (this.selectedYear) {
      const params = new HttpParams().set('year', this.selectedYear.toString());
      this.http.get<TimePeriodOption[]>('/api/v2/chart/time-periods/months', { 
        headers: this.getAuthHeaders(), 
        params 
      }).subscribe({
        next: (months) => {
          this.availableMonths = months;
          // Set January as default when switching to month view
          if (this.selectedTimePeriod === 'month' && !this.selectedMonth && months.length > 0) {
            const january = months.find(m => m.month === 1);
            if (january) {
              this.selectedMonth = 1;
            }
          }
          // Load dashboard data after months are loaded (for initial load)
          this.loadDashboardData();
        },
        error: (error) => console.error('Failed to load available months:', error)
      });
    }
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = false;
    
    let params = new HttpParams().set('timePeriod', this.selectedTimePeriod);
    
    if (this.selectedYear) {
      params = params.set('year', this.selectedYear.toString());
    }
    
    if (this.selectedMonth) {
      params = params.set('month', this.selectedMonth.toString());
    }
    
    let apiUrl = '/api/v2/chart/store-revenue';
    
    // Use different endpoint for custom date range
    if (this.selectedTimePeriod === 'custom' && this.customStartYear && this.customStartMonth && this.customEndYear && this.customEndMonth) {
      apiUrl = '/api/v2/chart/store-revenue/date-range';
      // Convert to first day of start month and last day of end month
      const startDate = `${this.customStartYear}-${this.customStartMonth.toString().padStart(2, '0')}-01`;
      const endDate = new Date(this.customEndYear, this.customEndMonth, 0).toISOString().split('T')[0]; // Last day of month
      params = params.set('startDate', startDate);
      params = params.set('endDate', endDate);
      // Remove timePeriod param for date range endpoint
      params = params.delete('timePeriod');
    }
    

    this.http.get<StoreRevenueData[]>(apiUrl, { 
      headers: this.getAuthHeaders(), 
      params 
    }).subscribe({
      next: (data) => {
        this.storeRevenueData = data;
        this.applyFilters();
        this.buildCharts();
        this.loading = false;
      },
      error: (error) => {
        console.error('Dashboard data loading failed:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  onTimePeriodChange(): void {
    this.selectedMonth = undefined;
    this.customStartYear = undefined;
    this.customStartMonth = undefined;
    this.customEndYear = undefined;
    this.customEndMonth = undefined;
    
    if (this.selectedTimePeriod === 'all-time') {
      this.selectedYear = undefined;
    } else if (this.selectedTimePeriod === 'year' && this.availableYears.length > 0) {
      this.selectedYear = this.availableYears[0].year;
    } else if (this.selectedTimePeriod === 'month') {
      if (this.availableYears.length > 0 && !this.selectedYear) {
        this.selectedYear = this.availableYears[0].year;
      }
      this.loadAvailableMonths();
    } else if (this.selectedTimePeriod === 'custom') {
      this.selectedYear = undefined;
      // Set default custom range (e.g., Q1 2022: Jan to Mar)
      this.customStartYear = 2022;
      this.customStartMonth = 1;
      this.customEndYear = 2022;
      this.customEndMonth = 3;
    }
    
    this.loadDashboardData();
  }

  onYearChange(): void {
    this.selectedMonth = undefined;
    if (this.selectedTimePeriod === 'month') {
      this.loadAvailableMonths();
    }
    this.loadDashboardData();
  }

  onMonthChange(): void {
    this.loadDashboardData();
  }
  
  onCustomRangeChange(): void {
    if (this.customStartYear && this.customStartMonth && this.customEndYear && this.customEndMonth) {
      // Validate that start is before end
      const startDate = new Date(this.customStartYear, this.customStartMonth - 1);
      const endDate = new Date(this.customEndYear, this.customEndMonth - 1);
      
      if (startDate >= endDate) {
        // Swap if start is after end
        const tempYear = this.customStartYear;
        const tempMonth = this.customStartMonth;
        this.customStartYear = this.customEndYear;
        this.customStartMonth = this.customEndMonth;
        this.customEndYear = tempYear;
        this.customEndMonth = tempMonth;
      }
      this.loadDashboardData();
    }
  }
  
  setCustomRange(startYear: number, startMonth: number, endYear: number, endMonth: number): void {
    this.customStartYear = startYear;
    this.customStartMonth = startMonth;
    this.customEndYear = endYear;
    this.customEndMonth = endMonth;
    this.onCustomRangeChange();
  }

  applyFilters(): void {
    this.filteredStoreData = [...this.storeRevenueData].filter(store => {
      const matchesSearch = !this.searchTerm || 
        store.city.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        store.state_name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        store.state_abbr.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesState = !this.selectedState || store.state_abbr === this.selectedState;
      
      const revenue = this.getRevenue(store);
      const matchesRevenue = (!this.minRevenue || revenue >= this.minRevenue) &&
        (!this.maxRevenue || revenue <= this.maxRevenue);
      
      return matchesSearch && matchesState && matchesRevenue;
    });
    
    this.sortStoreData();
  }
  
  sortStoreData(): void {
    // This method is kept for the table sorting, but charts now use individual sort methods
    const sortMultiplier = this.chartSortAscending ? 1 : -1;
    this.filteredStoreData.sort((a, b) => {
      return (this.getRevenue(a) - this.getRevenue(b)) * sortMultiplier;
    });
  }
  
  getSortedStoreDataForRevenue(): StoreRevenueData[] {
    const sortMultiplier = this.chartSortAscending ? 1 : -1;
    return [...this.filteredStoreData].sort((a, b) => {
      return (this.getRevenue(a) - this.getRevenue(b)) * sortMultiplier;
    });
  }
  
  getSortedStoreDataForOrders(): StoreRevenueData[] {
    const sortMultiplier = this.ordersChartSortAscending ? 1 : -1;
    return [...this.filteredStoreData].sort((a, b) => {
      return (this.getOrders(a) - this.getOrders(b)) * sortMultiplier;
    });
  }
  
  getSortedStoreDataForAvgOrder(): StoreRevenueData[] {
    const sortMultiplier = this.avgOrderChartSortAscending ? 1 : -1;
    return [...this.filteredStoreData].sort((a, b) => {
      return (this.getAvgOrderValue(a) - this.getAvgOrderValue(b)) * sortMultiplier;
    });
  }
  
  getSortedStoreDataForCustomers(): StoreRevenueData[] {
    const sortMultiplier = this.customersChartSortAscending ? 1 : -1;
    return [...this.filteredStoreData].sort((a, b) => {
      return (this.getCustomers(a) - this.getCustomers(b)) * sortMultiplier;
    });
  }
  
  toggleChartSort(): void {
    this.chartSortAscending = !this.chartSortAscending;
    this.sortStoreData();
    this.buildCharts();
  }
  
  toggleOrdersChartSort(): void {
    this.ordersChartSortAscending = !this.ordersChartSortAscending;
    this.buildCharts();
  }
  
  toggleAvgOrderChartSort(): void {
    this.avgOrderChartSortAscending = !this.avgOrderChartSortAscending;
    this.buildCharts();
  }
  
  toggleCustomersChartSort(): void {
    this.customersChartSortAscending = !this.customersChartSortAscending;
    this.buildCharts();
  }
  
  sortTable(column: 'revenue' | 'orders' | 'customers' | 'avgOrder' | 'store'): void {
    if (this.tableSortColumn === column) {
      this.tableSortAscending = !this.tableSortAscending;
    } else {
      this.tableSortColumn = column;
      this.tableSortAscending = false;
    }
  }
  
  getTableSortedData(): StoreRevenueData[] {
    const sortMultiplier = this.tableSortAscending ? 1 : -1;
    return [...this.filteredStoreData].sort((a, b) => {
      let aVal: number | string, bVal: number | string;
      
      switch (this.tableSortColumn) {
        case 'revenue': 
          aVal = this.getRevenue(a); bVal = this.getRevenue(b); break;
        case 'orders': 
          aVal = this.getOrders(a); bVal = this.getOrders(b); break;
        case 'customers': 
          aVal = this.getCustomers(a); bVal = this.getCustomers(b); break;
        case 'avgOrder': 
          aVal = this.getAvgOrderValue(a); bVal = this.getAvgOrderValue(b); break;
        case 'store': 
          aVal = a.city; bVal = b.city; break;
        default: 
          aVal = this.getRevenue(a); bVal = this.getRevenue(b);
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * sortMultiplier;
      }
      return ((aVal as number) - (bVal as number)) * sortMultiplier;
    });
  }

  buildCharts(): void {
    if (!this.filteredStoreData || this.filteredStoreData.length === 0) {
      this.revenueChartOptions = null;
      this.ordersChartOptions = null;
      this.avgOrderValueChartOptions = null;
      this.customersChartOptions = null;
      return;
    }

    // Each chart gets its own sorted data - showing all stores
    const revenueStores = this.getSortedStoreDataForRevenue();
    const ordersStores = this.getSortedStoreDataForOrders();
    const avgOrderStores = this.getSortedStoreDataForAvgOrder();
    const customersStores = this.getSortedStoreDataForCustomers();
    
    this.buildRevenueChart(revenueStores, revenueStores.map(store => `${store.city}, ${store.state_abbr}`));
    this.buildOrdersChart(ordersStores, ordersStores.map(store => `${store.city}, ${store.state_abbr}`));
    this.buildAvgOrderChart(avgOrderStores, avgOrderStores.map(store => `${store.city}, ${store.state_abbr}`));
    this.buildCustomersChart(customersStores, customersStores.map(store => `${store.city}, ${store.state_abbr}`));
  }

  private buildRevenueChart(stores: StoreRevenueData[], labels: string[]): void {
    const revenueData = stores.map(store => Math.round(this.getRevenue(store)));
    
    this.revenueChartOptions = {
      series: [{
        name: 'Revenue',
        data: revenueData
      }],
      chart: {
        type: 'line',
        height: 400,
        toolbar: { 
          show: true,
          export: {
            csv: {
              filename: `store-revenue-${this.getTimePeriodLabel()}`,
              columnDelimiter: ',',
              headerCategory: 'Store',
              headerValue: 'Revenue (€)'
            },
            svg: {
              filename: `store-revenue-${this.getTimePeriodLabel()}`
            },
            png: {
              filename: `store-revenue-${this.getTimePeriodLabel()}`
            }
          }
        },
        zoom: {
          enabled: true,
          type: 'x',
          autoScaleYaxis: true
        },
        background: 'transparent'
      },
      colors: ['#fb923c'],
      stroke: { curve: 'smooth', width: 3 },
      dataLabels: { enabled: false },
      xaxis: {
        categories: labels,
        labels: {
          rotate: -45,
          style: { colors: '#6b7280', fontSize: '12px' },
          maxHeight: 120
        },
        tickAmount: undefined
      },
      yaxis: {
        title: { text: 'Revenue (€)', style: { color: '#6b7280' } },
        labels: {
          formatter: (val: number) => `€${this.formatNumber(val)}`,
          style: { colors: '#6b7280' }
        }
      },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 3 },
      tooltip: {
        y: { formatter: (val: number) => `€${this.formatNumber(val)}` }
      }
    };
  }

  private buildOrdersChart(stores: StoreRevenueData[], labels: string[]): void {
    const ordersData = stores.map(store => this.getOrders(store));
    
    this.ordersChartOptions = {
      series: [{
        name: 'Orders',
        data: ordersData
      }],
      chart: {
        type: 'area',
        height: 350,
        toolbar: { 
          show: true,
          export: {
            csv: {
              filename: `store-orders-${this.getTimePeriodLabel()}`,
              columnDelimiter: ',',
              headerCategory: 'Store',
              headerValue: 'Orders'
            },
            svg: {
              filename: `store-orders-${this.getTimePeriodLabel()}`
            },
            png: {
              filename: `store-orders-${this.getTimePeriodLabel()}`
            }
          }
        },
        zoom: {
          enabled: true,
          type: 'x',
          autoScaleYaxis: true
        },
        background: 'transparent'
      },
      colors: ['#f97316'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3
        }
      },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: {
        categories: labels,
        labels: {
          rotate: -45,
          style: { colors: '#6b7280', fontSize: '12px' },
          maxHeight: 120
        },
        tickAmount: undefined
      },
      yaxis: {
        title: { text: 'Orders', style: { color: '#6b7280' } },
        labels: { style: { colors: '#6b7280' } }
      },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 3 }
    };
  }

  private buildAvgOrderChart(stores: StoreRevenueData[], labels: string[]): void {
    const avgData = stores.map(store => Math.round(this.getAvgOrderValue(store) * 100) / 100);
    
    this.avgOrderValueChartOptions = {
      series: [{
        name: 'Avg Order Value',
        data: avgData
      }],
      chart: {
        type: 'area',
        height: 350,
        toolbar: { 
          show: true,
          export: {
            csv: {
              filename: `avg-order-value-${this.getTimePeriodLabel()}`,
              columnDelimiter: ',',
              headerCategory: 'Store',
              headerValue: 'Avg Order (€)'
            },
            svg: {
              filename: `avg-order-value-${this.getTimePeriodLabel()}`
            },
            png: {
              filename: `avg-order-value-${this.getTimePeriodLabel()}`
            }
          }
        },
        zoom: {
          enabled: true,
          type: 'x',
          autoScaleYaxis: true
        },
        background: 'transparent'
      },
      colors: ['#ea580c'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3
        }
      },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: {
        categories: labels,
        labels: {
          rotate: -45,
          style: { colors: '#6b7280', fontSize: '12px' },
          maxHeight: 120
        },
        tickAmount: undefined
      },
      yaxis: {
        title: { text: 'Avg Order (€)', style: { color: '#6b7280' } },
        labels: {
          formatter: (val: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val),
          style: { colors: '#6b7280' }
        }
      },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 3 }
    };
  }

  private buildCustomersChart(stores: StoreRevenueData[], labels: string[]): void {
    const customersData = stores.map(store => this.getCustomers(store));
    
    this.customersChartOptions = {
      series: [{
        name: 'Unique Customers',
        data: customersData
      }],
      chart: {
        type: 'area',
        height: 350,
        toolbar: { 
          show: true,
          export: {
            csv: {
              filename: `unique-customers-${this.getTimePeriodLabel()}`,
              columnDelimiter: ',',
              headerCategory: 'Store',
              headerValue: 'Customers'
            },
            svg: {
              filename: `unique-customers-${this.getTimePeriodLabel()}`
            },
            png: {
              filename: `unique-customers-${this.getTimePeriodLabel()}`
            }
          }
        },
        zoom: {
          enabled: true,
          type: 'x',
          autoScaleYaxis: true
        },
        background: 'transparent'
      },
      colors: ['#c2410c'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3
        }
      },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: {
        categories: labels,
        labels: {
          rotate: -45,
          style: { colors: '#6b7280', fontSize: '12px' },
          maxHeight: 120
        },
        tickAmount: undefined
      },
      yaxis: {
        title: { text: 'Customers', style: { color: '#6b7280' } },
        labels: { style: { colors: '#6b7280' } }
      },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 3 }
    };
  }

  // Data accessor methods
  getRevenue(store: StoreRevenueData): number {
    return store.yearly_revenue || store.monthly_revenue || store.total_revenue || 0;
  }

  getOrders(store: StoreRevenueData): number {
    return store.yearly_orders || store.monthly_orders || store.total_orders || store.order_count || 0;
  }

  getCustomers(store: StoreRevenueData): number {
    return store.yearly_unique_customers || store.monthly_unique_customers || store.total_unique_customers || store.unique_customers || 0;
  }

  getAvgOrderValue(store: StoreRevenueData): number {
    return store.yearly_avg_order_value || store.monthly_avg_order_value || store.avg_order_value || 0;
  }

  // Summary calculations
  getTotalRevenue(): number {
    return this.filteredStoreData.reduce((sum, store) => sum + this.getRevenue(store), 0);
  }

  getTotalOrders(): number {
    return this.filteredStoreData.reduce((sum, store) => sum + this.getOrders(store), 0);
  }

  getTotalCustomers(): number {
    return this.filteredStoreData.reduce((sum, store) => sum + this.getCustomers(store), 0);
  }

  getOverallAvgOrder(): number {
    const totalRevenue = this.getTotalRevenue();
    const totalOrders = this.getTotalOrders();
    return totalOrders > 0 ? totalRevenue / totalOrders : 0;
  }

  // Utility methods
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatCurrencyWithDecimals(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  getTimePeriodLabel(): string {
    switch (this.selectedTimePeriod) {
      case 'all-time':
        return 'All Time (2021-2023)';
      case 'year':
        return this.selectedYear ? `Year ${this.selectedYear}` : 'Yearly';
      case 'month':
        if (this.selectedYear && this.selectedMonth) {
          const monthOption = this.availableMonths.find(m => m.month === this.selectedMonth);
          return monthOption ? monthOption.month_name_label || `${this.selectedMonth}/${this.selectedYear}` : 'Monthly';
        }
        return 'Monthly';
      case 'custom':
        if (this.customStartYear && this.customStartMonth && this.customEndYear && this.customEndMonth) {
          const startDate = new Date(this.customStartYear, this.customStartMonth - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          const endDate = new Date(this.customEndYear, this.customEndMonth - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          return `${startDate} - ${endDate}`;
        }
        return 'Custom Range';
      default:
        return 'Revenue Analysis';
    }
  }

  getUniqueStates(): string[] {
    const states = [...new Set(this.storeRevenueData.map(store => store.state_abbr))];
    return states.sort();
  }
  
  onFilterChange(): void {
    this.applyFilters();
    this.buildCharts();
  }
  
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedState = '';
    this.minRevenue = 0;
    this.maxRevenue = 0;
    this.onFilterChange();
  }

  refreshData(): void {
    this.loadDashboardData();
    if (this.showAnalytics) {
      this.loadAnalyticsData();
    }
  }
  
  // =================================================================
  // COMPREHENSIVE ANALYTICS METHODS
  // =================================================================
  
  toggleAnalytics(): void {
    this.showAnalytics = !this.showAnalytics;
    if (this.showAnalytics) {
      this.loadAnalyticsData();
    }
  }
  
  loadAnalyticsData(): void {
    this.loadHourlyPerformanceData();
    this.loadProductPerformanceData();
    this.loadPeakHoursData();
    this.loadSeasonalData();
  }
  
  loadHourlyPerformanceData(): void {
    let params = new HttpParams();
    if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
    if (this.selectedMonth && this.selectedTimePeriod === 'month') {
      params = params.set('month', this.selectedMonth.toString());
    }
    
    this.http.get<any[]>('/api/v2/analytics/hourly-performance', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.hourlyPerformanceData = data;
        this.buildHourlyChart();
      },
      error: (error) => console.error('Failed to load hourly performance:', error)
    });
  }
  
  loadProductPerformanceData(): void {
    let params = new HttpParams().set('limit', this.analyticsLimit.toString());
    if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
    if (this.selectedMonth && this.selectedTimePeriod === 'month') {
      params = params.set('month', this.selectedMonth.toString());
    }
    if (this.analyticsCategory) params = params.set('category', this.analyticsCategory);
    
    this.http.get<any[]>('/api/v2/analytics/product-performance', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.productPerformanceData = data;
        this.buildProductChart();
      },
      error: (error) => console.error('Failed to load product performance:', error)
    });
  }
  
  loadPeakHoursData(): void {
    let params = new HttpParams();
    if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
    if (this.selectedMonth && this.selectedTimePeriod === 'month') {
      params = params.set('month', this.selectedMonth.toString());
    }
    
    this.http.get<any[]>('/api/v2/analytics/peak-hours', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.peakHoursData = data;
        this.buildPeakHoursChart();
      },
      error: (error) => console.error('Failed to load peak hours:', error)
    });
  }
  
  loadSeasonalData(): void {
    let params = new HttpParams();
    if (this.selectedYear) params = params.set('year', this.selectedYear.toString());
    if (this.analyticsSeason) params = params.set('season', this.analyticsSeason);
    
    this.http.get<any[]>('/api/v2/analytics/seasonal-business', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.seasonalData = data;
        this.buildSeasonalChart();
      },
      error: (error) => console.error('Failed to load seasonal data:', error)
    });
  }
  
  onAnalyticsFilterChange(): void {
    if (this.showAnalytics) {
      this.loadAnalyticsData();
    }
  }
  
  // Analytics Chart Building Methods
  buildHourlyChart(): void {
    if (!this.hourlyPerformanceData || this.hourlyPerformanceData.length === 0) {
      this.hourlyChartOptions = null;
      return;
    }
    
    const hours = Array.from({length: 24}, (_, i) => i);
    const hourlyRevenue = hours.map(hour => {
      const hourData = this.hourlyPerformanceData.find(d => d.hour_of_day === hour);
      return hourData ? Number(hourData.hourly_revenue) || 0 : 0;
    });
    
    this.hourlyChartOptions = {
      series: [{
        name: 'Hourly Revenue',
        data: hourlyRevenue
      }],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: true },
        zoom: { enabled: true, type: 'x' }
      },
      colors: ['#f59e0b'],
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.3 }
      },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: {
        categories: hours.map(h => `${h}:00`),
        title: { text: 'Hour of Day' }
      },
      yaxis: {
        title: { text: 'Revenue (€)' },
        labels: { formatter: (val: number) => `€${this.formatNumber(val)}` }
      },
      grid: { borderColor: '#e5e7eb' }
    };
  }
  
  buildProductChart(): void {
    if (!this.productPerformanceData || this.productPerformanceData.length === 0) {
      this.productChartOptions = null;
      return;
    }
    
    const topProducts = this.productPerformanceData.slice(0, 10);
    const productNames = topProducts.map(p => p.product_name || 'Unknown');
    const productRevenue = topProducts.map(p => Number(p.total_revenue) || 0);
    
    this.productChartOptions = {
      series: [{ name: 'Product Revenue', data: productRevenue }],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: true }
      },
      colors: ['#dc2626'],
      plotOptions: {
        bar: { borderRadius: 4, horizontal: true }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: productNames,
        title: { text: 'Revenue (€)' }
      },
      yaxis: { title: { text: 'Products' } }
    };
  }
  
  buildPeakHoursChart(): void {
    if (!this.peakHoursData || this.peakHoursData.length === 0) {
      this.peakHoursChartOptions = null;
      return;
    }
    
    const hours = this.peakHoursData.map(d => d.hour_of_day);
    const orders = this.peakHoursData.map(d => Number(d.total_orders) || 0);
    
    this.peakHoursChartOptions = {
      series: [{ name: 'Orders', data: orders }],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: true }
      },
      colors: ['#059669'],
      stroke: { curve: 'smooth', width: 3 },
      markers: { size: 6 },
      xaxis: {
        categories: hours.map(h => `${h}:00`),
        title: { text: 'Hour' }
      },
      yaxis: { title: { text: 'Total Orders' } }
    };
  }
  
  buildSeasonalChart(): void {
    if (!this.seasonalData || this.seasonalData.length === 0) {
      this.seasonalChartOptions = null;
      return;
    }
    
    const periods = this.seasonalData.map(d => d.business_period || d.season);
    const revenue = this.seasonalData.map(d => Number(d.period_revenue) || 0);
    
    this.seasonalChartOptions = {
      series: revenue,
      chart: {
        type: 'donut',
        height: 350
      },
      labels: periods,
      colors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
      legend: { position: 'bottom' }
    };
  }
}