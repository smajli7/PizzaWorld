import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexDataLabels,
  ApexTooltip,
  ApexGrid,
  ApexPlotOptions,
  ApexLegend
} from 'ng-apexcharts';

interface CustomerLifetimeValue {
  customerid: string;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  first_order_date: string;
  last_order_date: string;
  customer_lifespan_days: number;
  stores_visited: number;
  daily_value: number;
  clv_per_order: number;
  customer_segment: string;
}

interface CustomerRetention {
  cohort_month: string;
  cohort_size: number;
  retained_1m: number;
  retained_3m: number;
  retained_6m: number;
  retained_12m: number;
  retention_rate_1m: number;
  retention_rate_3m: number;
  retention_rate_6m: number;
  retention_rate_12m: number;
}

interface CustomerSummary {
  total_customers: number;
  avg_customer_value: number;
  avg_orders_per_customer: number;
  avg_customer_lifespan: number;
  vip_customers: number;
  regular_customers: number;
  occasional_customers: number;
  one_time_customers: number;
}

interface CustomerAcquisition {
  year?: number;
  month: number | string;
  month_name?: string;
  new_customers: number;
  total_orders: number;
  revenue_from_new_customers: number;
}

interface TopCustomerByCLV {
  customer_id: string;
  total_spent: number;
  order_count: number;
  segment: string;
}

interface RetentionData {
  period: string;
  new_customers: number;
  retained_customers: number;
  retention_rate: number;
}

interface AvailableYear {
  year: number;
  year_label: string;
}

interface AvailableMonth {
  month: number;
  month_name_label: string;
}

interface Store {
  storeid: string;
  city: string;
  state: string;
  state_abbr: string;
}

interface GeographicDistribution {
  location: string;
  customer_count: number;
  segment_breakdown: {
    vip: number;
    regular: number;
    occasional: number;
    one_time: number;
  };
}

interface PerformanceComparison {
  entity: string;
  avg_clv: number;
  retention_rate: number;
  total_customers: number;
  vip_percentage: number;
}

interface CohortData {
  cohort: string;
  months_since_acquisition: number;
  retention_rate: number;
  avg_clv: number;
}

@Component({
  selector: 'app-customer-analytics',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, SidebarComponent, FormsModule],
  templateUrl: './customer-analytics.component.html',
  styleUrls: ['./customer-analytics.component.scss']
})
export class CustomerAnalyticsComponent implements OnInit {
  // Data
  customerLifetimeValue: CustomerLifetimeValue[] = [];
  customerRetention: CustomerRetention[] = [];
  customerSummary: CustomerSummary | null = null;
  customerAcquisition: CustomerAcquisition[] = [];
  topCustomersByCLV: TopCustomerByCLV[] = [];
  retentionData: RetentionData[] = [];

  // UI State
  loading = false;
  error = false;
  exportLoading = false;
  chartsLoading = false;
  activeTab: 'lifetime-value' | 'retention' | 'summary' = 'lifetime-value';

  // Data limits
  clvLimit = 100000000; // Increased to get ALL customers
  retentionLimit = 24;

  // Sorting
  sortBy = 'total_spent';
  sortOrder = 'desc';
  sortedCustomers: CustomerLifetimeValue[] = [];

  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;
  paginatedCustomers: CustomerLifetimeValue[] = [];

  // Chart options
  acquisitionChart: any = null;
  retentionChart: any = null;
  segmentsChart: any = null;

  // Math for template
  Math = Math;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadCustomerSummary();
    this.loadCustomerLifetimeValue();
    this.loadCustomerRetention();
    this.loadCustomerAcquisition();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }



  loadCustomerSummary(): void {
    this.loading = true;
    this.http.get<CustomerSummary>('/api/v2/analytics/customer-lifetime-value/summary', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.customerSummary = data;
        this.buildSegmentChart();
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load customer summary:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  loadCustomerLifetimeValue(): void {
    this.loading = true;
    const params = new URLSearchParams({ limit: this.clvLimit.toString() });
    this.http.get<CustomerLifetimeValue[]>(`/api/v2/analytics/customer-lifetime-value?${params}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.customerLifetimeValue = data;
        this.sortCustomers();
        this.updatePagination();
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load customer lifetime value:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  loadCustomerRetention(): void {
    this.loading = true;
    const params = new URLSearchParams({ limit: this.retentionLimit.toString() });
    this.http.get<CustomerRetention[]>(`/api/v2/analytics/customer-retention?${params}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.customerRetention = data;
        this.buildRetentionChart();
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load customer retention:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  loadCustomerAcquisition(): void {
    this.loading = true;
    this.http.get<CustomerAcquisition[]>('/api/v2/analytics/customer-acquisition', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        // Reverse the data to show chronological order (oldest to newest)
        this.customerAcquisition = data.reverse();
        this.buildAcquisitionChart();
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load customer acquisition:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  // Sorting methods
  sortCustomers(): void {
    this.sortedCustomers = [...this.customerLifetimeValue].sort((a, b) => {
      let aValue: any = a[this.sortBy as keyof CustomerLifetimeValue];
      let bValue: any = b[this.sortBy as keyof CustomerLifetimeValue];

      if (this.sortOrder === 'desc') {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });
  }

  onSortChange(): void {
    this.sortCustomers();
    this.updatePagination();
  }





  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.sortedCustomers.length / this.pageSize);
    this.currentPage = 1;
    this.updatePaginatedCustomers();
  }

  updatePaginatedCustomers(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedCustomers = this.sortedCustomers.slice(start, end);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedCustomers();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedCustomers();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedCustomers();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let end = Math.min(this.totalPages, start + maxPages - 1);

    if (end - start < maxPages - 1) {
      start = Math.max(1, end - maxPages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  getRankNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  getRankClass(rank: number): string {
    if (rank <= 3) return 'bg-yellow-100 text-yellow-800';
    if (rank >= this.sortedCustomers.length - 2) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-600';
  }

  // Filter methods
  onSegmentChange(): void {
    this.applyFilters();
  }

    applyFilters(): void {
    // No filters anymore, just reload data
    this.loadCustomerLifetimeValue();
  }



  clearAllFilters(): void {
    // No filters to clear anymore
  }

  hasActiveFilters(): boolean {
    return false;
  }

  // Data helper methods
  getFilterLabel(): string {
    return 'All Customers';
  }

  getTotalCustomers(): number {
    return this.customerSummary?.total_customers || 0;
  }

  getAverageCLV(): number {
    return this.customerSummary?.avg_customer_value || 0;
  }

  getRetentionRate(): number {
    if (!this.customerRetention.length) return 0;
    const latest = this.customerRetention[0];
    return latest.retention_rate_1m * 100;
  }

  getAllTimeRetentionRate(): number {
    if (!this.customerSummary) return 0;
    const totalCustomers = this.customerSummary.total_customers;
    const repeatCustomers = this.getRepeatCustomers();
    return totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
  }

  getRepeatCustomers(): number {
    if (!this.customerSummary) return 0;
    return this.customerSummary.total_customers - this.customerSummary.one_time_customers;
  }

  getSegmentBadgeClass(segment: string): string {
    switch (segment.toLowerCase()) {
      case 'high':
      case 'vip':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'medium':
      case 'regular':
        return 'bg-blue-100 text-blue-800 border border-blue-300';
      case 'low':
      case 'occasional':
        return 'bg-green-100 text-green-800 border border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300';
    }
  }

  // Action methods
  refreshData(): void {
    this.loading = true;
    this.error = false;
    this.loadCustomerSummary();
    this.loadCustomerLifetimeValue();
    this.loadCustomerRetention();
    this.loadCustomerAcquisition();
  }

  exportData(): void {
    this.exportLoading = true;

    this.http.get(`/api/v2/analytics/customer-lifetime-value/export`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customer-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.exportLoading = false;
      },
      error: (error) => {
        console.error('Export failed:', error);
        this.exportLoading = false;
      }
    });
  }

  // Legacy methods for backward compatibility
  onTabChange(tab: 'lifetime-value' | 'retention' | 'summary'): void {
    this.activeTab = tab;
  }

  onCLVLimitChange(): void {
    this.loadCustomerLifetimeValue();
  }

  onRetentionLimitChange(): void {
    this.loadCustomerRetention();
  }

  exportCLV(): void {
    this.exportData();
  }

  exportRetention(): void {
    this.exportData();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  getSegmentColor(segment: string): string {
    switch (segment.toLowerCase()) {
      case 'vip':
        return '#FFD700'; // Gold
      case 'regular':
        return '#3B82F6'; // Blue
      case 'occasional':
        return '#10B981'; // Green
      case 'one-time':
        return '#6B7280'; // Gray
      default:
        return '#6c757d';
    }
  }

    // Chart building methods
  buildAcquisitionChart(): void {
    if (!this.customerAcquisition.length) return;

    // Format month labels properly
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedMonths = this.customerAcquisition.map(c => {
      // Check if we have year and month fields separately
      if (c.year && c.month) {
        const monthIndex = parseInt(c.month.toString()) - 1;
        return `${monthNames[monthIndex]} ${c.year}`;
      }
      // Otherwise, assume c.month is in format "YYYY-MM" or just month number
      const monthStr = c.month.toString();
      if (monthStr.includes('-')) {
        // Format: "YYYY-MM"
        const [year, month] = monthStr.split('-');
        const monthIndex = parseInt(month) - 1;
        return `${monthNames[monthIndex]} ${year}`;
      } else {
        // Just month number
        const monthIndex = parseInt(monthStr) - 1;
        return monthNames[monthIndex];
      }
    });

    const newCustomers = this.customerAcquisition.map(c => c.new_customers);

    this.acquisitionChart = {
      series: [{
        name: 'New Customers',
        data: newCustomers
      }],
      chart: {
        type: 'line',
        height: 350,
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        }
      },
      plotOptions: {
        line: {
          curve: 'smooth'
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        show: true,
        width: 3,
        colors: ['#f97316']
      },
      xaxis: {
        categories: formattedMonths,
        title: {
          text: 'Month'
        },
        labels: {
          rotate: -45,
          rotateAlways: false,
          hideOverlappingLabels: true
        }
      },
      yaxis: {
        title: {
          text: 'New Customers'
        }
      },
      fill: {
        opacity: 1
      },
      tooltip: {
        y: {
          formatter: function (val: number) {
            return val + ' customers';
          }
        }
      },
      colors: ['#f97316']
    };
  }

  buildRetentionChart(): void {
    if (!this.customerRetention.length) return;

    // Format month labels properly
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedMonths = this.customerRetention.map(c => {
      const monthStr = c.cohort_month.toString();
      if (monthStr.includes('-')) {
        // Format: "YYYY-MM"
        const [year, month] = monthStr.split('-');
        const monthIndex = parseInt(month) - 1;
        return `${monthNames[monthIndex]} ${year}`;
      } else {
        // Just month number
        const monthIndex = parseInt(monthStr) - 1;
        return monthNames[monthIndex];
      }
    });

    const retention1m = this.customerRetention.map(c => c.retention_rate_1m * 100);
    const retention3m = this.customerRetention.map(c => c.retention_rate_3m * 100);
    const retention6m = this.customerRetention.map(c => c.retention_rate_6m * 100);

    this.retentionChart = {
      series: [
        {
          name: '1 Month',
          data: retention1m
        },
        {
          name: '3 Months',
          data: retention3m
        },
        {
          name: '6 Months',
          data: retention6m
        }
      ],
      chart: {
        height: 350,
        type: 'line',
        zoom: {
          enabled: true
        },
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'straight',
        width: 3
      },
      title: {
        text: 'Customer Retention Rates',
        align: 'left'
      },
      grid: {
        row: {
          colors: ['#f3f3f3', 'transparent'],
          opacity: 0.5
        },
      },
      xaxis: {
        categories: formattedMonths,
        labels: {
          rotate: -45,
          rotateAlways: false,
          hideOverlappingLabels: true
        }
      },
      yaxis: {
        title: {
          text: 'Retention Rate (%)'
        },
        min: 0,
        max: 100
      },
      colors: ['#f97316', '#fb923c', '#fed7aa']
    };
  }

  buildSegmentChart(): void {
    if (!this.customerSummary) return;

    const segments = ['VIP', 'Regular', 'Occasional', 'One-time'];
    const values = [
      this.customerSummary.vip_customers,
      this.customerSummary.regular_customers,
      this.customerSummary.occasional_customers,
      this.customerSummary.one_time_customers
    ];

    this.segmentsChart = {
      series: values,
      chart: {
        type: 'donut',
        height: 350,
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        }
      },
      labels: segments,
      colors: ['#FFD700', '#3B82F6', '#10B981', '#6B7280'], // Gold for VIP, Blue for Regular, Green for Occasional, Gray for One-time
      plotOptions: {
        pie: {
          donut: {
            size: '70%'
          }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: function (val: number) {
          return val.toLocaleString();
        }
      },
      legend: {
        position: 'bottom'
      },
      tooltip: {
        y: {
          formatter: function (val: number) {
            return val.toLocaleString() + ' customers';
          }
        }
      }
    };
  }
}
