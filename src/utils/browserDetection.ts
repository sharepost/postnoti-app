import { Platform } from 'react-native';

export const isKakaoTalk = () => {
    if (Platform.OS !== 'web') return false;
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('kakaotalk');
};

export const redirectToExternalBrowser = () => {
    if (Platform.OS !== 'web') return;

    const url = window.location.href;

    // 안드로이드 카카오톡에서 외부 브라우저(크롬)로 강제 이동 시도
    if (/android/i.test(navigator.userAgent)) {
        if (isKakaoTalk()) {
            window.location.href = 'intent://' + url.replace(/https?:\/\//i, '') + '#Intent;scheme=https;package=com.android.chrome;end';
        }
    }
    // 아이폰은 시스템상 강제 이동이 불가능하므로 안내 문구만 띄움
};
