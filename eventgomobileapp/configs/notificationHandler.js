import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { authApis, endpoints } from './Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cấu hình cách hiển thị thông báo khi ứng dụng đang mở
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Lấy token thiết bị để nhận push notification
async function registerForPushNotificationsAsync() {
  let token;
  
  if (Platform.OS === 'android') {
    // Cấu hình kênh thông báo cho Android
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig.extra?.eas?.projectId || Constants.manifest?.extra?.eas?.projectId,
      })).data;
    } catch (error) {
      console.error("Error getting Expo push token:", error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Đăng ký token với máy chủ
async function registerTokenWithServer(token, authToken) {
  if (!token) return false;
  
  try {
    const api = authToken ? authApis(authToken) : null;
    if (!api) return false;
    
    await api.post(endpoints.pushToken, { push_token: token });
    await AsyncStorage.setItem('pushTokenSentToServer', 'true');
    return true;
  } catch (error) {
    console.error("Error registering push token with server:", error);
    return false;
  }
}

// Hàm khởi tạo hệ thống thông báo
export async function initializeNotifications(navigationRef, authToken = null) {
  console.log("Initializing notification system...");
  
  const pushToken = await registerForPushNotificationsAsync();
  console.log("Expo push token:", pushToken);
  
  if (pushToken && authToken) {
    const registered = await registerTokenWithServer(pushToken, authToken);
    console.log("Token registered with server:", registered);
  }

  // Xử lý khi nhận được thông báo khi ứng dụng đang chạy
  const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log("Notification received in foreground:", notification);
  });

  // Xử lý khi người dùng nhấp vào thông báo
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log("Notification response received:", response);
    
    const data = response.notification.request.content.data;
    
    if (data && data.eventId && navigationRef) {
      if (data.type === 'EVENT_CREATED' || data.type === 'EVENT_UPDATED') {
        // Chuyển hướng đến chi tiết sự kiện
        navigationRef.navigate('EventDetail', { eventId: data.eventId });
      }
    }
  });

  // Hàm hiển thị thông báo cục bộ
  const showNotification = async (title, body, data = {}) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // Hiển thị ngay lập tức
    });
  };

  // Hàm hiển thị thông báo sự kiện
  const showEventNotification = async (eventData, isUpdate = false) => {
    const title = isUpdate ? 'Sự kiện đã được cập nhật' : 'Sự kiện mới';
    const body = isUpdate 
      ? `Sự kiện "${eventData.name}" đã được cập nhật.`
      : `Sự kiện "${eventData.name}" vừa được tạo. Khám phá ngay!`;
      
    await showNotification(title, body, {
      type: isUpdate ? 'EVENT_UPDATED' : 'EVENT_CREATED',
      eventId: eventData.id || eventData.eventId
    });
  };

  // Cập nhật token máy chủ khi đã đăng nhập
  const updateServerToken = async (newAuthToken) => {
    if (pushToken && newAuthToken) {
      return await registerTokenWithServer(pushToken, newAuthToken);
    }
    return false;
  };

  // Dọn dẹp khi không cần thiết nữa
  const cleanup = () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };

  return {
    pushToken,
    showNotification,
    showEventNotification,
    updateServerToken,
    cleanup
  };
}

// Hàm tiện ích để hiện thông báo cục bộ từ bất kỳ đâu trong ứng dụng
export async function showNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: null, // Hiển thị ngay lập tức
  });
}
