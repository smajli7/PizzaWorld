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
  yearly_revenue?: number;
  monthly_revenue?: number;
  total_revenue?: number;
  yearly_orders?: number;
  monthly_orders?: number;
  order_count?: number;
  yearly_unique_customers?: number;
  monthly_unique_customers?: number;
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
  selectedTimePeriod: 'year' | 'month' = 'year';
  selectedYear: number = 2023;
  selectedMonth?: number;
  
  // UI state
  loading = false;
  error = false;
  
  // Chart options
  revenueChartOptions: any = null;
  ordersChartOptions: any = null;
  avgOrderValueChartOptions: any = null;
  customersChartOptions: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAvailableYears();
    this.loadDashboardData();
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
          if (years.length > 0 && !this.selectedYear) {
            this.selectedYear = years[0].year;
          }
          this.loadAvailableMonths();
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
        },
        error: (error) => console.error('Failed to load available months:', error)
      });
    }
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = false;
    
    const params = new HttpParams()
      .set('timePeriod', this.selectedTimePeriod)
      .set('year', this.selectedYear?.toString() || '')
      .set('month', this.selectedMonth?.toString() || '');

    this.http.get<StoreRevenueData[]>('/api/v2/store-revenue-chart', { 
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
    this.loadDashboardData();
  }

  onYearChange(): void {
    this.selectedMonth = undefined;
    this.loadAvailableMonths();
    this.loadDashboardData();
  }

  onMonthChange(): void {
    this.loadDashboardData();
  }

  applyFilters(): void {
    this.filteredStoreData = [...this.storeRevenueData]
      .sort((a, b) => this.getRevenue(b) - this.getRevenue(a));
  }

  buildCharts(): void {
    if (!this.filteredStoreData || this.filteredStoreData.length === 0) {
      this.revenueChartOptions = null;
      this.ordersChartOptions = null;
      this.avgOrderValueChartOptions = null;
      this.customersChartOptions = null;
      return;
    }

    const topStores = this.filteredStoreData.slice(0, 15);
    const storeLabels = topStores.map(store => `${store.city}, ${store.state_abbr}`);
    
    this.buildRevenueChart(topStores, storeLabels);
    this.buildOrdersChart(topStores, storeLabels);
    this.buildAvgOrderChart(topStores, storeLabels);
    this.buildCustomersChart(topStores, storeLabels);
  }

  private buildRevenueChart(stores: StoreRevenueData[], labels: string[]): void {
    const revenueData = stores.map(store => Math.round(this.getRevenue(store)));
    
    this.revenueChartOptions = {
      series: [{
        name: 'Revenue',
        data: revenueData
      }],
      chart: {
        type: 'bar',
        height: 400,
        toolbar: { show: true },
        background: 'transparent'
      },
      colors: ['#fb923c'],
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '60%',
          distributed: false
        }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: labels,
        labels: {
          rotate: -45,
          style: { colors: '#6b7280', fontSize: '12px' }
        }
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
        type: 'line',
        height: 350,
        toolbar: { show: false },
        background: 'transparent'
      },
      colors: ['#f97316'],
      stroke: { curve: 'smooth', width: 3 },
      dataLabels: { enabled: false },
      xaxis: {
        categories: labels,
        labels: {
          rotate: -45,
          style: { colors: '#6b7280', fontSize: '12px' }
        }
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
        toolbar: { show: false },
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
          style: { colors: '#6b7280', fontSize: '12px' }
        }
      },
      yaxis: {
        title: { text: 'Avg Order (€)', style: { color: '#6b7280' } },
        labels: {
          formatter: (val: number) => `€${val.toFixed(2)}`,
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
        type: 'bar',
        height: 350,
        toolbar: { show: false },
        background: 'transparent'
      },
      colors: ['#c2410c'],
      plotOptions: {
        bar: {
          borderRadius: 4,
          columnWidth: '70%',
          distributed: false
        }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: labels,
        labels: {
          rotate: -45,
          style: { colors: '#6b7280', fontSize: '12px' }
        }
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
    return store.yearly_orders || store.monthly_orders || store.order_count || 0;
  }

  getCustomers(store: StoreRevenueData): number {
    return store.yearly_unique_customers || store.monthly_unique_customers || store.unique_customers || 0;
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

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  getTimePeriodLabel(): string {
    switch (this.selectedTimePeriod) {
      case 'year':
        return this.selectedYear ? `Year ${this.selectedYear}` : 'Yearly';
      case 'month':
        if (this.selectedYear && this.selectedMonth) {
          const monthOption = this.availableMonths.find(m => m.month === this.selectedMonth);
          return monthOption ? monthOption.month_name_label || `${this.selectedMonth}/${this.selectedYear}` : 'Monthly';
        }
        return 'Monthly';
      default:
        return 'Revenue Analysis';
    }
  }

  refreshData(): void {
    this.loadDashboardData();
  }
}