import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';   // stellt <router-outlet> bereit

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [RouterModule]                         
})
export class AppComponent {}
