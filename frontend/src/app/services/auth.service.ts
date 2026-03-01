import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private apiUrl = 'https://real-time-chat-application-23aa.onrender.com/api/auth';
    private userSubject = new BehaviorSubject<any>(this.getCurrentUser());

    constructor(private http: HttpClient, private router: Router) { }

    register(userData: { username: string; email: string; password: string }) {
        return this.http.post<any>(`${this.apiUrl}/register`, userData).pipe(
            tap(res => {
                if (res.success) {
                    localStorage.setItem('token', res.data.token);
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                    this.userSubject.next(res.data.user);
                }
            })
        );
    }

    login(credentials: { email: string; password: string }) {
        return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
            tap(res => {
                if (res.success) {
                    localStorage.setItem('token', res.data.token);
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                    this.userSubject.next(res.data.user);
                }
            })
        );
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.userSubject.next(null);
        this.router.navigate(['/login']);
    }

    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    isLoggedIn(): boolean {
        return !!localStorage.getItem('token');
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }
}
