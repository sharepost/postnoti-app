const admin = require('firebase-admin');

// 환경 변수에서 서비스 계정 정보를 가져오거나, 로컬이라면 환경변수를 직접 체크합니다.
// Vercel 설정에서 FIREBASE_ADMIN_SDK_JSON 이라는 이름으로 전체 JSON 내용을 넣으시면 됩니다.
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Firebase admin initialization failed:', error);
    }
}

module.exports = async (req, res) => {
    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, title, body, data } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        const message = {
            token: token,
            notification: {
                title: title,
                body: body,
            },
            data: data || {},
            android: {
                priority: 'high',
                notification: {
                    sound: 'default'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default'
                    }
                }
            },
            webpush: {
                notification: {
                    icon: 'https://postnoti-app.vercel.app/favicon.ico', // 아이콘 경로 확인 필요
                    badge: 'https://postnoti-app.vercel.app/favicon.ico',
                }
            }
        };

        const response = await admin.messaging().send(message);
        return res.status(200).json({ success: true, messageId: response });
    } catch (error) {
        console.error('Error sending push notification:', error);
        return res.status(500).json({ error: 'Failed to send notification', details: error.message });
    }
};
