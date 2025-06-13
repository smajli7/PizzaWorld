import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { RouterModule }   from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule }    from '@angular/forms';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HttpClientModule,
    FormsModule            // für die Filter‐Inputs
  ],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent implements OnInit {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  // Daten und Filterzustände
  products: any[] = [];
  filteredProducts: any[] = [];
  categoryFilter = '';
  sizeFilter = '';
  searchTerm = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Produktliste laden
    this.http.get<any[]>('/api/products').subscribe(data => {
      this.products = data;
      this.applyFilters();
    });
  }

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }

  /** Filtert die Produktliste nach Auswahlwerten */
  applyFilters(): void {
    this.filteredProducts = this.products.filter(p =>
      (!this.categoryFilter || p.category === this.categoryFilter) &&
      (!this.sizeFilter     || p.size     === this.sizeFilter)     &&
      (!this.searchTerm     || p.name.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }
}
