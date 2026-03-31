import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SocketService } from '../../services/socket.service';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="chat-layout">

      <!-- Connection Status -->
      <div class="connection-status" [class.connected]="isConnected" [class.disconnected]="!isConnected">
        {{ isConnected ? '🟢 Connected' : '🔴 Reconnecting...' }}
      </div>

      <!-- Users Sidebar -->
      <div class="users-sidebar">
        <h3>Users</h3>

        <div class="search-box">
          <input type="text" placeholder="Search users..." [(ngModel)]="searchTerm" (input)="filterUsers()">
        </div>

        <div class="users-list">
          <div class="no-users" *ngIf="filteredUsers.length === 0">
            <p *ngIf="users.length === 0">No users found</p>
            <p *ngIf="users.length > 0">No users match your search</p>
          </div>

          <div class="user-item" *ngFor="let user of filteredUsers"
               (click)="selectUser(user)"
               [class.active]="selectedUser?._id === user._id">

            <div class="user-avatar">{{ getInitial(user.username) }}</div>

            <div class="user-info">
              <h4>{{ user.username }}</h4>
              <p>{{ user.email }}</p>
            </div>

            <span class="online-indicator" *ngIf="isOnline(user._id)"></span>
          </div>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="chat-area" *ngIf="selectedUser">

        <!-- Chat Header -->
        <div class="chat-header">
          <div class="user-avatar">{{ getInitial(selectedUser.username) }}</div>
          <div>
            <h4>{{ selectedUser.username }}</h4>
            <p style="font-size: 0.85rem; color: #666;">
              <span *ngIf="typingUser">{{ typingUser }} is typing...</span>
              <span *ngIf="!typingUser && isOnline(selectedUser._id)">Online</span>
              <span *ngIf="!typingUser && !isOnline(selectedUser._id)">Offline</span>
            </p>
          </div>
        </div>

        <!-- Messages -->
        <div class="chat-messages" #messagesContainer>

          <div class="loading" *ngIf="loading">
            <div class="spinner"></div>
          </div>

          <div class="message fade-in"
               *ngFor="let msg of messages"
               [class.sent]="isSent(msg)"
               [class.received]="!isSent(msg)">

            <!-- Sender -->
            <div class="sender" *ngIf="!isSent(msg)">
              {{ msg.sender?.username }}
            </div>

            <!-- Message -->
            <div class="content">{{ msg.message }}</div>

            <!-- Time + Status -->
            <div class="time">
              {{ formatTime(msg.createdAt) }}
              <span class="status"
                    *ngIf="isSent(msg)"
                    [class.read]="msg.isRead">
                {{ msg.isRead ? '✓✓' : '✓' }}
              </span>
            </div>

          </div>

          <div class="typing-indicator" *ngIf="typingUser">
            {{ typingUser }} is typing...
          </div>

        </div>

        <!-- Input -->
        <div class="chat-input">
          <input type="text"
                 placeholder="Type a message..."
                 [(ngModel)]="newMessage"
                 (keyup.enter)="sendMessage()"
                 (input)="onTyping()">

          <button (click)="sendMessage()">Send</button>
        </div>

      </div>

      <!-- No Chat -->
      <div class="chat-area no-chat" *ngIf="!selectedUser">
        <p class="fade-in">Select a user to start chatting</p>
      </div>

    </div>
  `
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {

    @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

    currentUser: any;
    users: any[] = [];
    filteredUsers: any[] = [];
    selectedUser: any = null;
    messages: any[] = [];
    newMessage = '';
    roomId: string | null = null;
    isConnected = false;
    loading = false;
    searchTerm = '';
    typingUser: string | null = null;
    onlineUsers: string[] = [];

    private typingTimeout: any;
    private subscriptions: Subscription[] = [];

    constructor(
        private http: HttpClient,
        private authService: AuthService,
        private socketService: SocketService
    ) {
        this.currentUser = this.authService.getCurrentUser();
    }

    ngOnInit() {
        this.loadUsers();
        this.connectSocket();
    }

    ngAfterViewChecked() {
        this.scrollToBottom();
    }

    ngOnDestroy() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        if (this.roomId) {
            this.socketService.leaveRoom(this.roomId);
        }
    }

    loadUsers() {
        this.http.get<any>(`${environment.apiUrl}/users`).subscribe({
            next: (res) => {
                if (res.success) {
                    this.users = res.data;
                    this.filteredUsers = res.data;
                }
            }
        });
    }

    connectSocket() {
        this.socketService.connect();
        this.socketService.authenticate(this.currentUser.id);

        this.subscriptions.push(
            this.socketService.isConnected().subscribe(c => this.isConnected = c),
            this.socketService.getOnlineUsers().subscribe(u => this.onlineUsers = u),

            this.socketService.onReceiveMessage().subscribe(msg => {
                if (this.roomId && msg.roomId === this.roomId) {
                    const exists = this.messages.some(m => 
                        m.tempId === msg.tempId || m._id === msg._id
                    );
                    if (!exists) {
                        this.messages.push(msg);
                    }
                }
            }),

            this.socketService.onUserTyping().subscribe(data => {
                if (this.roomId && data.roomId === this.roomId && data.userId !== this.currentUser.id) {
                    this.typingUser = data.username;
                }
            }),

            this.socketService.onUserStopTyping().subscribe((data: any) => {
                if (this.roomId && data.roomId === this.roomId) {
                    this.typingUser = null;
                }
            }),

            this.socketService.onMessageRead().subscribe(data => {
                if (this.roomId && data.roomId === this.roomId) {
                    this.messages.forEach(msg => {
                        if (data.messageIds.includes(msg._id)) {
                            msg.isRead = true;
                        }
                    });
                }
            })
        );
    }

    filterUsers() {
        const term = this.searchTerm.toLowerCase();
        this.filteredUsers = this.users.filter(u =>
            u.username.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
        );
    }

    selectUser(user: any) {
        this.selectedUser = user;
        const ids = [this.currentUser.id, user._id].sort();
        this.roomId = ids[0] + '_' + ids[1];

        this.socketService.joinRoom(this.roomId);
        this.loadMessages(user._id);
    }

    loadMessages(userId: string) {
        this.loading = true;
        this.messages = [];

        this.http.get<any>(`${environment.apiUrl}/chats/${userId}`).subscribe({
            next: (res) => {
                if (res.success) this.messages = res.data;
                this.loading = false;
            },
            error: () => this.loading = false
        });
    }

    sendMessage() {
        if (!this.newMessage.trim() || !this.selectedUser || !this.roomId) return;

        const tempId = 'temp_' + Date.now();
        
        const messageData = {
            roomId: this.roomId,
            sender: { _id: this.currentUser.id, username: this.currentUser.username },
            receiver: { _id: this.selectedUser._id, username: this.selectedUser.username },
            message: this.newMessage,
            createdAt: new Date(),
            tempId: tempId
        };

        this.socketService.sendMessage(messageData);

        this.http.post<any>(`${environment.apiUrl}/chats/${this.selectedUser._id}`, {
            message: this.newMessage,
            tempId: tempId
        }).subscribe();

        this.newMessage = '';
        this.stopTyping();
    }

    onTyping() {
        if (!this.roomId) return;

        this.socketService.sendTyping({
            roomId: this.roomId,
            userId: this.currentUser.id,
            username: this.currentUser.username
        });

        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.stopTyping(), 2000);
    }

    stopTyping() {
        if (this.roomId) {
            this.socketService.stopTyping({
                roomId: this.roomId,
                userId: this.currentUser.id
            });
        }
    }

    isSent(msg: any): boolean {
        const senderId = (typeof msg.sender === 'object')
            ? (msg.sender._id || msg.sender.id)
            : msg.sender;

        const currentId = this.currentUser?.id || this.currentUser?._id;
        return String(senderId) === String(currentId);
    }

    isOnline(userId: string): boolean {
        return this.onlineUsers.includes(userId);
    }

    getInitial(name: string): string {
        return name ? name.charAt(0).toUpperCase() : '?';
    }

    formatTime(date: Date | string): string {
        const d = new Date(date);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            const el = this.messagesContainer.nativeElement;
            el.scrollTop = el.scrollHeight;
        }
    }
}