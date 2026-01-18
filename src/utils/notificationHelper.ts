import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

export async function registerForPushNotificationsAsync() {
    if (!Device.isDevice) return '';

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') return '';

    try {
        // Project ID should be loaded from env or constant in real app
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: 'a78cf50e-37ca-4d89-86f5-87cf1fdff7f2' })).data;
        return token;
    } catch (e) {
        return '';
    }
}
