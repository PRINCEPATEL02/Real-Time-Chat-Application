import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
    template: `
    <div class="app-container">
      <nav class="navbar" *ngIf="authService.isLoggedIn()">
        <h1>💬 ChatApp</h1>
        <div class="nav-links">
          <a routerLink="/chat">Chats</a>
          <span>{{ currentUser?.username }}</span>
          <button (click)="logout()">Logout</button>
        </div>
      </nav>
      <router-outlet></router-outlet>
    </div>
  `
})
export class AppComponent {
    currentUser: any;

    constructor(public authService: AuthService) {
        this.currentUser = this.authService.getCurrentUser();
    }

    logout() {
        this.authService.logout();
    }
}
