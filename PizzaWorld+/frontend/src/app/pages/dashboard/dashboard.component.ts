// src/app/pages/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule }      from '@angular/common';        // ⬅️ NEU
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { KpiTileComponent }  from '../../core/kpi-tile/KpiTileComponent';
import { KpiService, DashboardKpiDto } from '../../core/kpi.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexDataLabels, ApexTitleSubtitle, ApexTooltip, ApexPlotOptions } from 'ng-apexcharts';

@Component({
  standalone: true,
  selector  : 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls : ['./dashboard.component.scss'],
  imports   : [
    CommonModule,         // ⬅️  Pipe-Definitionen
    SidebarComponent,
    KpiTileComponent,
    NgApexchartsModule
  ]
})
export class DashboardComponent implements OnInit {
  kpis: DashboardKpiDto | null = null;

  // ApexCharts options
  public chartSeries: ApexAxisChartSeries = [];
  public chartOptions: Partial<{
    chart: ApexChart;
    xaxis: ApexXAxis;
    dataLabels: ApexDataLabels;
    title: ApexTitleSubtitle;
    tooltip: ApexTooltip;
    plotOptions: ApexPlotOptions;
  }> = {};

  constructor(private kpi: KpiService) {}

  ngOnInit() {
    this.kpi.getDashboard().subscribe(k => {
      this.kpis = k;
      this.chartSeries = [{
        name: 'Value',
        data: [
          k.revenue,
          k.orders,
          k.avgOrder,
          k.customers,
          k.products
        ]
      }];
      this.chartOptions = {
        chart: {
          type: 'bar',
          height: 320
        },
        plotOptions: {
          bar: {
            borderRadius: 6,
            horizontal: true,
            distributed: true
          }
        },
        dataLabels: {
          enabled: true
        },
        xaxis: {
          categories: ['Revenue', 'Orders', 'Avg. Order Value', 'Customers', 'Products'],
          labels: { style: { colors: ['#FF6F00', '#FFB347', '#ECB390', '#333', '#777'], fontWeight: 600 } }
        },
        title: {
          text: 'Key Performance Indicators',
          align: 'left',
          style: { fontSize: '1.2rem', color: '#333' }
        },
        tooltip: {
          enabled: true
        }
      };
    });
  }
}
