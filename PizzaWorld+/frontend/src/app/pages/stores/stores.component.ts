import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { KpiService, StoreInfo } from '../../core/kpi.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { catchError, finalize, map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { of, Subject, Subscription } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis
} from 'ng-apexcharts';

// Define SortEvent interface locally
interface SortEvent {
  field: string;
  order: number;
}

export interface ChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
}

@Component({
  selector: 'app-stores',
  standalone: true,
  imports: [
    SidebarComponent,
    CommonModule,
    FormsModule,
    NgApexchartsModule,
    CardModule,
    InputTextModule,
    MultiSelectModule,
    ButtonModule,
    TableModule,
    TooltipModule,
    CheckboxModule
  ],
  templateUrl: './stores.component.html',
  styleUrls: ['./stores.component.scss']
})
export class StoresComponent implements OnInit, OnDestroy {
  // Store data
  allStores: StoreInfo[] = [];
  filteredStores: StoreInfo[] = [];
  loading = true;
  error = false;

  // Search and filter
  searchTerm = '';
  selectedStates: string[] = [];
  states: { label: string, value: string }[] = [];

  // Chart data
  storesOpts: ChartOptions | null = null;

  // Table settings
  first = 0;
  rows = 10;
  totalRecords = 0;

  // Sorting
  sortField: string = '';
  sortOrder: number = 1;

  // Row selection
  selectedStores: StoreInfo[] = [];

  // Export
  exportLoading = false;

  // Performance optimization
  private searchSubject = new Subject<string>();
  private subscriptions = new Subscription();

  constructor(
    private kpi: KpiService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupSearchDebouncing();
    this.loadStoresData();
    this.loadStoresChart();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private setupSearchDebouncing(): void {
    // Debounce search input to avoid excessive filtering
    const searchSubscription = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.applyFilters();
        this.cdr.detectChanges();
      });

    this.subscriptions.add(searchSubscription);
  }

  loadStoresData(): void {
    this.loading = true;
    this.error = false;

    // ALWAYS try to load from cache first for instant display
    const cachedStores = this.kpi.getCachedStoresData();
    if (cachedStores && cachedStores.length > 0) {
      this.allStores = cachedStores;
      this.filteredStores = [...cachedStores];
      this.totalRecords = cachedStores.length;
      this.extractStates();
      this.applyFilters();
      this.loading = false;
      this.cdr.detectChanges();
      console.log('✅ Stores loaded INSTANTLY from cache');
      return;
    }

    // Only if NO cache exists, then load fresh data from API
    console.log('⚠️ No cached stores data found - loading from API (this should not happen after login)');
    this.kpi.getAllStores()
      .pipe(
        catchError(err => {
          console.error('❌ Stores loading error:', err);
          this.error = true;
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe(stores => {
        if (stores.length > 0) {
          this.allStores = stores;
          this.filteredStores = [...stores];
          this.totalRecords = stores.length;
          this.extractStates();
          this.applyFilters();
          console.log('✅ Stores loaded from API');
        }
      });
  }

  private loadStoresChart(): void {
    this.kpi.getStoresPerDay().subscribe(rows => {
      this.storesOpts = {
        series: [
          {
            name: 'Stores',
            data: rows.map(r => [new Date(r.day).getTime(), +r.count])
          }
        ],
        chart: { type: 'area', height: 320, toolbar: { show: false } },
        xaxis: { type: 'datetime' },
        yaxis: { title: { text: 'Stores' } },
        stroke: { curve: 'smooth' },
        dataLabels: { enabled: false },
        tooltip: { shared: true }
      };
      this.cdr.detectChanges();
    });
  }

  private extractStates(): void {
    const uniqueStates = [...new Set(this.allStores.map(store => store.state))]
      .sort()
      .map(state => ({ label: state, value: state }));
    this.states = uniqueStates;
  }

  private applyFilters(): void {
    // Optimize filtering for better performance
    const searchLower = this.searchTerm.toLowerCase();
    const hasSearch = searchLower.length > 0;
    const hasStateFilter = this.selectedStates.length > 0;

    this.filteredStores = this.allStores.filter(store => {
      // Search filtering
      if (hasSearch) {
        const matchesSearch =
          store.city.toLowerCase().includes(searchLower) ||
          store.storeid.toLowerCase().includes(searchLower) ||
          store.zipcode.includes(this.searchTerm) ||
          store.state.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // State filtering
      if (hasStateFilter) {
        if (!this.selectedStates.includes(store.state)) return false;
      }

      return true;
    });

    this.totalRecords = this.filteredStores.length;
    this.first = 0; // Reset to first page when filtering
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onStateChange(): void {
    this.applyFilters();
    this.cdr.detectChanges();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStates = [];
    this.applyFilters();
    this.cdr.detectChanges();
  }

  // Sorting functionality
  onSort(event: SortEvent): void {
    this.sortField = event.field || '';
    this.sortOrder = event.order || 1;

    if (this.sortField) {
      this.filteredStores.sort((a: any, b: any) => {
        let valueA = a[this.sortField];
        let valueB = b[this.sortField];

        // Handle string comparison
        if (typeof valueA === 'string') {
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
        }

        if (valueA < valueB) {
          return this.sortOrder === 1 ? -1 : 1;
        }
        if (valueA > valueB) {
          return this.sortOrder === 1 ? 1 : -1;
        }
        return 0;
      });
    }
  }

  // Pagination
  onPageChange(event: any): void {
    this.first = event.first;
    this.rows = event.rows;
  }

  // Row selection
  onRowSelect(event: any): void {
    console.log('Selected store:', event.data);
  }

  onRowUnselect(event: any): void {
    console.log('Unselected store:', event.data);
  }

  // Export functionality
  exportStores(): void {
    this.exportLoading = true;

    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    this.http.get('/api/store/export', {
      headers,
      responseType: 'blob'
    }).subscribe(
      (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'stores.csv';
        link.click();
        window.URL.revokeObjectURL(url);
        this.exportLoading = false;
      },
      (error) => {
        console.error('Export error:', error);
        this.exportLoading = false;
      }
    );
  }

  // Export filtered stores
  exportFilteredStores(): void {
    if (this.filteredStores.length === 0) {
      return;
    }

    // Create CSV content
    const headers = ['Store ID', 'City', 'State', 'State Abbr', 'Zip Code', 'Latitude', 'Longitude'];
    const csvContent = [
      headers.join(','),
      ...this.filteredStores.map(store => [
        store.storeid,
        store.city,
        store.state,
        store.state_abbr,
        store.zipcode,
        store.latitude,
        store.longitude
      ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `filtered_stores_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  // Bulk actions
  getSelectedCount(): number {
    return this.selectedStores.length;
  }

  clearSelection(): void {
    this.selectedStores = [];
  }

  getStoreCount(): number {
    return this.filteredStores.length;
  }

  getTotalStores(): number {
    return this.allStores.length;
  }

  getStateCount(): number {
    return this.states.length;
  }

  formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  openInMaps(lat: number, lng: number): void {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  }

  navigateToStoreDetails(store: StoreInfo): void {
    this.router.navigate(['/stores', store.storeid]);
  }

  // Performance optimization: trackBy function for ngFor
  trackByStoreId(index: number, store: StoreInfo): string {
    return store.storeid;
  }
}
