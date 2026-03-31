export const environment = {
    production: false,
    apiUrl: location.hostname.includes('localhost')
        ? 'http://localhost:3000/api'
        : 'https://real-time-chat-application-23aa.onrender.com/api',
    socketUrl: location.hostname.includes('localhost')
        ? 'http://localhost:3000'
        : 'https://real-time-chat-application-23aa.onrender.com'
};
