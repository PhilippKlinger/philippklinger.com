import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainContentComponent } from './main-content/main-content.component';
import { MainContentNavigationComponent } from './main-content-navigation/main-content-navigation.component';


const routes: Routes = [
  { path: '', component: MainContentComponent },
  { path: 'navigation', component: MainContentNavigationComponent },

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled',
      scrollOffset: [0, 100] // [x, y]
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
