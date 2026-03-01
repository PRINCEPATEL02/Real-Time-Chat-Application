import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
    private socket: Socket | null = null;
    private connectedSubject = new BehaviorSubject<boolean>(false);
    private onlineUsersSubject = new BehaviorSubject<string[]>([]);

    constructor() { }

    connect() {
        if (!this.socket) {
            this.socket = io('https://real-time-chat-application-23aa.onrender.com', {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5
            });

            this.socket.on('connect', () => {
                this.connectedSubject.next(true);
            });

            this.socket.on('disconnect', () => {
                this.connectedSubject.next(false);
            });

            this.socket.on('user_online', (data: { userId: string }) => {
                const current = this.onlineUsersSubject.value;
                if (!current.includes(data.userId)) {
                    this.onlineUsersSubject.next([...current, data.userId]);
                }
            });

            this.socket.on('user_offline', (data: { userId: string }) => {
                const current = this.onlineUsersSubject.value;
                this.onlineUsersSubject.next(current.filter(id => id !== data.userId));
            });
        }
        return this.socket;
    }

    authenticate(userId: string) {
        this.socket?.emit('authenticate', userId);
    }

    joinRoom(roomId: string) {
        this.socket?.emit('join_room', roomId);
    }

    leaveRoom(roomId: string) {
        this.socket?.emit('leave_room', roomId);
    }

    sendMessage(data: any) {
        this.socket?.emit('send_message', data);
    }

    sendTyping(data: { roomId: string; userId: string; username: string }) {
        this.socket?.emit('typing', data);
    }

    stopTyping(data: { roomId: string; userId: string }) {
        this.socket?.emit('stop_typing', data);
    }

    markRead(data: { roomId: string; messageIds: string[]; userId: string }) {
        this.socket?.emit('mark_read', data);
    }

    onReceiveMessage(): Observable<any> {
        return new Observable(observer => {
            this.socket?.on('receive_message', (data) => observer.next(data));
        });
    }

    onUserTyping(): Observable<any> {
        return new Observable(observer => {
            this.socket?.on('user_typing', (data) => observer.next(data));
        });
    }

    onUserStopTyping(): Observable<any> {
        return new Observable(observer => {
            this.socket?.on('user_stop_typing', (data) => observer.next(data));
        });
    }

    onMessageRead(): Observable<any> {
        return new Observable(observer => {
            this.socket?.on('message_read', (data) => observer.next(data));
        });
    }

    isConnected(): Observable<boolean> {
        return this.connectedSubject.asObservable();
    }

    getOnlineUsers(): Observable<string[]> {
        return this.onlineUsersSubject.asObservable();
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
}
