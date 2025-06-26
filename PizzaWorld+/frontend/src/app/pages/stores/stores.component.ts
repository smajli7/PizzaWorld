import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { RouterModule }   from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { KpiService } from '../../core/kpi.service';

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
    RouterModule,
    NgApexchartsModule
  ],
  templateUrl: './stores.component.html',
  styleUrls: ['./stores.component.scss']
})
export class StoresComponent implements OnInit {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  /** Filled after HTTP call; null until then */
  storesOpts: ChartOptions | null = null;

  constructor(private kpi: KpiService) {}

  ngOnInit(): void {
    this.kpi.getStoresPerDay().subscribe(rows => {
      this.storesOpts = {
        series: [
          {
            name : 'Stores',
            data : rows.map(r => [new Date(r.day).getTime(), +r.count])
          }
        ],
        chart      : { type: 'area', height: 320, toolbar: { show: false } },
        xaxis      : { type: 'datetime' },
        yaxis      : { title: { text: 'Stores' } },
        stroke     : { curve: 'smooth' },
        dataLabels : { enabled: false },
        tooltip    : { shared : true }
      };
    });
  }

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }
}
