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
  selector: 'app-sales',
  standalone: true,
  imports: [
    SidebarComponent,
    CommonModule,
    RouterModule,
    NgApexchartsModule
  ],
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.scss']
})
export class SalesComponent implements OnInit {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  /** Filled after HTTP call; null until then */
  salesOpts: ChartOptions | null = null;

  constructor(private kpi: KpiService) {}

  ngOnInit(): void {
    this.kpi.getSalesPerDay().subscribe(rows => {
      this.salesOpts = {
        series: [
          {
            name : 'Sales €',
            data : rows.map(r => [new Date(r.day).getTime(), +r.sales])
          }
        ],
        chart      : { type: 'area', height: 320, toolbar: { show: false } },
        xaxis      : { type: 'datetime' },
        yaxis      : { title: { text: 'Sales (€)' } },
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
