import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container fade-in">
      <h2>Register</h2>
      
      <div class="alert alert-error" *ngIf="generalError">
        {{ generalError }}
      </div>
      
      <form (ngSubmit)="register()">
        <div class="form-group">
          <label>Username</label>
          <input 
            type="text" 
            [(ngModel)]="username" 
            name="username" 
            (ngModelChange)="clearFieldError('username')"
            [class.input-error]="fieldErrors.username"
            placeholder="Enter username">
          <small class="error-text" *ngIf="fieldErrors.username">{{ fieldErrors.username }}</small>
        </div>
        
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
        
        <div class="form-group">
          <label>Confirm Password</label>
          <input 
            type="password" 
            [(ngModel)]="confirmPassword" 
            name="confirmPassword" 
            (ngModelChange)="clearFieldError('confirmPassword')"
            [class.input-error]="fieldErrors.confirmPassword"
            placeholder="Confirm password">
          <small class="error-text" *ngIf="fieldErrors.confirmPassword">{{ fieldErrors.confirmPassword }}</small>
        </div>
        
        <button type="submit" class="btn-primary" [disabled]="loading">
          {{ loading ? 'Registering...' : 'Register' }}
        </button>
      </form>
      
      <div class="auth-switch">
        Already have an account? <a (click)="goToLogin()">Login</a>
      </div>
    </div>
  `
})
export class RegisterComponent {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  loading = false;
  generalError = '';

  // Individual field errors
  fieldErrors: {
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
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

    // Username validation
    if (!this.username || this.username.trim() === '') {
      this.fieldErrors.username = 'Username is required';
      isValid = false;
    } else if (this.username.length < 3) {
      this.fieldErrors.username = 'Username must be at least 3 characters';
      isValid = false;
    } else if (this.username.length > 20) {
      this.fieldErrors.username = 'Username must be less than 20 characters';
      isValid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(this.username)) {
      this.fieldErrors.username = 'Username can only contain letters, numbers, and underscores';
      isValid = false;
    }

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
    } else if (this.password.length < 6) {
      this.fieldErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    } else if (this.password.length > 50) {
      this.fieldErrors.password = 'Password must be less than 50 characters';
      isValid = false;
    }

    // Confirm Password validation
    if (!this.confirmPassword || this.confirmPassword === '') {
      this.fieldErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (this.password !== this.confirmPassword) {
      this.fieldErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    return isValid;
  }

  register() {
    // Validate all fields first
    if (!this.validateFields()) {
      return;
    }

    this.loading = true;
    this.generalError = '';
    this.fieldErrors = {};

    this.authService.register({ username: this.username, email: this.email, password: this.password }).subscribe({
      next: (res) => {
        if (res.success) {
          this.router.navigate(['/chat']);
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        const errorMsg = err.error?.error || err.message || 'Registration failed. Please try again.';

        // Check for specific error types and display appropriately
        if (errorMsg.toLowerCase().includes('email')) {
          this.fieldErrors.email = errorMsg;
        } else if (errorMsg.toLowerCase().includes('username')) {
          this.fieldErrors.username = errorMsg;
        } else if (errorMsg.toLowerCase().includes('password')) {
          this.fieldErrors.password = errorMsg;
        } else {
          this.generalError = errorMsg;
        }
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
