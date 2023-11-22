import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { MainContentComponent } from './main-content/main-content.component';
import { DescriptionComponent } from './main-content/description/description.component';
import { SkillsComponent } from './main-content/skills/skills.component';
import { PortfolioComponent } from './main-content/portfolio/portfolio.component';
import { ContactFormComponent } from './main-content/contactform/contactform.component';
import { FooterComponent } from './footer/footer.component';
import { ProjectComponent } from './main-content/portfolio/project/project.component';
import { AbovethefoldComponent } from './main-content/abovethefold/abovethefold.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MainContentNavigationComponent } from './main-content-navigation/main-content-navigation.component';
import { SharedService } from './shared.service';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    MainContentComponent,
    DescriptionComponent,
    SkillsComponent,
    PortfolioComponent,
    ContactFormComponent,
    FooterComponent,
    ProjectComponent,
    AbovethefoldComponent,
    MainContentNavigationComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule
  ],
  providers: [SharedService],
  bootstrap: [AppComponent]
})
export class AppModule { }
