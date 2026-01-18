importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDSbcig9-Xba-ISXAnt82GJtTwjrLBr6BY",
    authDomain: "postnoti-93d2e.firebaseapp.com",
    projectId: "postnoti-93d2e",
    storageBucket: "postnoti-93d2e.firebasestorage.app",
    messagingSenderId: "508156325119",
    appId: "1:508156325119:web:418d2ebc164990b38470ca"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.png', // 앱 아이콘 경로
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
