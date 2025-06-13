import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { RouterModule }   from '@angular/router';
import { HttpClient }     from '@angular/common/http';
import { NgApexchartsModule } from 'ng-apexcharts';

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
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgApexchartsModule      // <apx-chart> is recognised here
  ],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  /** Filled after HTTP call; null until then */
  ordersOpts: ChartOptions | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>('/api/kpi/orders-per-day').subscribe(rows => {
      this.ordersOpts = {
        series: [
          {
            name : 'Orders',
            data : rows.map(r => [new Date(r.day).getTime(), +r.count])
          }
        ],
        chart      : { type: 'area', height: 320, toolbar: { show: false } },
        xaxis      : { type: 'datetime' },
        yaxis      : { title: { text: 'Orders' } },
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
