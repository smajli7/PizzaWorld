import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { KpiService, StoreInfo } from '../../core/kpi.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, finalize, map } from 'rxjs/operators';
import { of } from 'rxjs';

import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis
} from 'ng-apexcharts';

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
    DropdownModule,
    ButtonModule,
    TableModule,
    TooltipModule
  ],
  templateUrl: './stores.component.html',
  styleUrls: ['./stores.component.scss']
})
export class StoresComponent implements OnInit {
  // Store data
  allStores: StoreInfo[] = [];
  filteredStores: StoreInfo[] = [];
  loading = true;
  error = false;

  // Search and filter
  searchTerm = '';
  selectedState = '';
  states: { label: string, value: string }[] = [];

  // Chart data
  storesOpts: ChartOptions | null = null;

  // Table settings
  first = 0;
  rows = 10;

  constructor(private kpi: KpiService) {}

  ngOnInit(): void {
    this.loadStoresData();
    this.loadStoresChart();
  }

  loadStoresData(): void {
    this.loading = true;
    this.error = false;

    this.kpi.getAllStores()
      .pipe(
        catchError(err => {
          console.error('Stores loading error:', err);
          this.error = true;
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(stores => {
        this.allStores = stores;
        this.filteredStores = [...stores];
        this.extractStates();
        console.log('Extracted states:', this.states);
        this.applyFilters();
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
    });
  }

  private extractStates(): void {
    const uniqueStates = [...new Set(this.allStores.map(store => store.state))]
      .sort()
      .map(state => ({ label: state, value: state }));
    this.states = [{ label: 'None', value: '' }, ...uniqueStates];
  }

  private applyFilters(): void {
    this.filteredStores = this.allStores.filter(store => {
      const matchesSearch = !this.searchTerm || 
        store.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        store.storeid.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        store.zipcode.includes(this.searchTerm) ||
        store.state.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesState = !this.selectedState || store.state === this.selectedState;

      return matchesSearch && matchesState;
    });
  }

  onSearchChange(): void {
    this.applyFilters();
    this.first = 0; // Reset to first page
  }

  onStateChange(): void {
    this.applyFilters();
    this.first = 0; // Reset to first page
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedState = '';
    this.applyFilters();
    this.first = 0;
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
}
