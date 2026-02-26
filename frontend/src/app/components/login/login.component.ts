import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container fade-in">
      <h2>Login</h2>
      
      <div class="alert alert-error" *ngIf="generalError">
        {{ generalError }}
      </div>
      
      <form (ngSubmit)="login()">
        <div class="form-group">
          <label>Email</label>
          <input 
            type="email" 
            [(ngModel)]="email" 
            name="email" 
            (ngModelChange)="clearFieldError('email')"
            [class.input-error]="fieldErrors.email"
            placeholder="Enter email">
          <small class="error-text" *ngIf="fieldErrors.email">{{ fieldErrors.email }}</small>
        </div>
        
        <div class="form-group">
          <label>Password</label>
          <input 
            type="password" 
            [(ngModel)]="password" 
            name="password" 
            (ngModelChange)="clearFieldError('password')"
            [class.input-error]="fieldErrors.password"
            placeholder="Enter password">
          <small class="error-text" *ngIf="fieldErrors.password">{{ fieldErrors.password }}</small>
        </div>
        
        <button type="submit" class="btn-primary" [disabled]="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
      
      <div class="auth-switch">
        Don't have an account? <a (click)="goToRegister()">Register</a>
      </div>
    </div>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  generalError = '';

  // Individual field errors
  fieldErrors: {
    email?: string;
    password?: string;
  } = {};

  constructor(private authService: AuthService, private router: Router) { }

  clearFieldError(field: string) {
    delete this.fieldErrors[field as keyof typeof this.fieldErrors];
    this.generalError = '';
  }

  validateFields(): boolean {
    let isValid = true;
    this.fieldErrors = {};
    this.generalError = '';

    // Email validation
    if (!this.email || this.email.trim() === '') {
      this.fieldErrors.email = 'Email is required';
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email)) {
        this.fieldErrors.email = 'Please enter a valid email address';
        isValid = false;
      }
    }

    // Password validation
    if (!this.password || this.password === '') {
      this.fieldErrors.password = 'Password is required';
      isValid = false;
    }

    return isValid;
  }

  login() {
    // Validate all fields first
    if (!this.validateFields()) {
      return;
    }

    this.loading = true;
    this.generalError = '';
    this.fieldErrors = {};

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        if (res.success) {
          this.router.navigate(['/chat']);
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        const errorMsg = err.error?.error || err.message || 'Login failed. Please try again.';

        // Check for specific error types and display appropriately
        if (errorMsg.toLowerCase().includes('email')) {
          this.fieldErrors.email = errorMsg;
        } else if (errorMsg.toLowerCase().includes('password')) {
          this.fieldErrors.password = errorMsg;
        } else if (errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('invalid')) {
          this.generalError = 'Invalid email or password';
        } else {
          this.generalError = errorMsg;
        }
      }
    });
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}
