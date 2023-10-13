import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { DescriptionComponent } from './description/description.component';
import { SkillsComponent } from './skills/skills.component';
import { PortfolioComponent } from './portfolio/portfolio.component';
import { ContactformComponent } from './contactform/contactform.component';
import { FooterComponent } from './footer/footer.component';
import { ProjectComponent } from './portfolio/project/project.component';
import { AbovethefoldComponent } from './abovethefold/abovethefold.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    DescriptionComponent,
    SkillsComponent,
    PortfolioComponent,
    ContactformComponent,
    FooterComponent,
    ProjectComponent,
    AbovethefoldComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
