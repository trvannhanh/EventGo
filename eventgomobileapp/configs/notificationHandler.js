import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { authApis, endpoints } from './Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import Firebase for better FCM integration
import { app } from './firebase';

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
  let token = null;
  
  console.log("=== STARTING PUSH TOKEN REGISTRATION ===");
  console.log("📱 Platform:", Platform.OS);
  console.log("📱 Is Device:", Device.isDevice);
  console.log("📱 Device Type:", Device.deviceType);
  
  if (Platform.OS === 'android') {
    // Cấu hình kênh thông báo cho Android
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      console.log("✅ Android notification channel configured");
    } catch (channelError) {
      console.error("❌ Error setting notification channel:", channelError.message);
    }
  }
  
  // Kiểm tra và yêu cầu permissions
  console.log("🔐 Checking notification permissions...");
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log("📱 Current permission status:", existingStatus);
  
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    console.log("🔐 Requesting notification permissions...");
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log("📱 New permission status:", finalStatus);
  }
  
  if (finalStatus !== 'granted') {
    console.log('❌ Failed to get push notification permissions!');
    return null;
  }
    // Tạo push token
  try {
    console.log("📱 Firebase app initialized:", !!app);
    console.log("🔐 Requesting push token with project ID...");
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                     Constants.manifest?.extra?.eas?.projectId ||
                     Constants.expoConfig?.extra?.notificationProjectId ||
                     Constants.manifest?.extra?.notificationProjectId;
    
    console.log("📱 Project ID from config:", projectId);
    console.log("📱 Constants.expoConfig.extra:", Constants.expoConfig?.extra);
    console.log("📱 Constants.manifest.extra:", Constants.manifest?.extra);
    
    if (!projectId) {
      console.error("❌ No project ID found in configuration!");
      return null;
    }
    
    console.log("🚀 Calling getExpoPushTokenAsync...");
    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    
    token = tokenResult.data;
    console.log('✅ Push token obtained successfully:', token);
    console.log('📝 Token type:', typeof token);
    console.log('📏 Token length:', token?.length);
    
  } catch (error) {
    console.error("❌ Error getting Expo push token:", error);
    console.error("❌ Error details:", error.message);
    console.error("❌ Error stack:", error.stack);
    
    if (!Device.isDevice) {
      console.log('📱 Note: Running on emulator - this might be expected');
      
      // Trên emulator, thử tạo một mock token để test
      if (Constants.expoConfig?.extra?.eas?.projectId) {
        console.log('🧪 Creating mock token for emulator testing...');
        token = `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`;
        console.log('🧪 Mock token created:', token);
      }
    }
  }

  console.log("=== PUSH TOKEN REGISTRATION COMPLETE ===");
  console.log("📱 Final token:", token);
  return token;
}

// Đăng ký token với máy chủ
async function registerTokenWithServer(token, authToken) {
  console.log("=== REGISTER TOKEN WITH SERVER ===");
  console.log("Token to register:", token);
  console.log("Auth token:", authToken?.substring(0, 20) + "...");
  
  if (!token) {
    console.log("❌ No token provided");
    return false;
  }
  
  try {
    const api = authToken ? authApis(authToken) : null;
    if (!api) {
      console.log("❌ No API instance created - authToken missing");
      return false;
    }
    
    console.log("🚀 Sending POST request to:", endpoints.pushToken);
    console.log("🚀 Request payload:", { push_token: token });
    
    const response = await api.post(endpoints.pushToken, { push_token: token });
    console.log("✅ Server response:", response.status, response.data);
    
    await AsyncStorage.setItem('pushTokenSentToServer', 'true');
    console.log("✅ Token registration successful and saved locally");
    return true;
  } catch (error) {
    console.error("❌ Error registering push token with server:");
    console.error("Error message:", error.message);
    console.error("Error response:", error.response?.data);
    console.error("Error status:", error.response?.status);
    return false;
  }
}

// Hàm khởi tạo hệ thống thông báo
export async function initializeNotifications(navigationRef, authToken = null) {
  console.log("=== INITIALIZING NOTIFICATION SYSTEM ===");
  console.log("AuthToken present:", !!authToken);
  console.log("AuthToken type:", typeof authToken);
  
  const pushToken = await registerForPushNotificationsAsync();
  console.log("=== PUSH TOKEN RESULT ===");
  console.log("Push token obtained:", pushToken);
  console.log("Push token type:", typeof pushToken);
  console.log("Push token length:", pushToken?.length);
  
  if (pushToken && authToken) {
    console.log("=== ATTEMPTING TO REGISTER TOKEN WITH SERVER ===");
    const registered = await registerTokenWithServer(pushToken, authToken);
    console.log("Token registration result:", registered);
  } else {
    console.log("=== TOKEN NOT REGISTERED ===");
    console.log("Push token exists:", !!pushToken);
    console.log("Auth token exists:", !!authToken);
    console.log("Will skip server registration");
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
    console.log("=== UPDATE SERVER TOKEN ===");
    console.log("Push token available:", !!pushToken);
    console.log("New auth token available:", !!newAuthToken);
    
    if (pushToken && newAuthToken) {
      const result = await registerTokenWithServer(pushToken, newAuthToken);
      console.log("Update server token result:", result);
      return result;
    }
    console.log("Cannot update server token - missing token or auth");
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

// Helper function để kiểm tra trạng thái push token
export async function debugPushTokenStatus() {
  console.log("=== DEBUG PUSH TOKEN STATUS ===");
  
  try {
    // Kiểm tra permissions
    const { status } = await Notifications.getPermissionsAsync();
    console.log("📱 Notification permissions:", status);
    
    // Kiểm tra device
    console.log("📱 Is real device:", Device.isDevice);
    console.log("📱 Device type:", Device.deviceType);
    
    // Kiểm tra project ID
    const projectId = Constants.expoConfig.extra?.eas?.projectId || Constants.manifest?.extra?.eas?.projectId;
    console.log("📱 Project ID:", projectId);
    
    // Kiểm tra token đã lưu local
    const tokenSent = await AsyncStorage.getItem('pushTokenSentToServer');
    console.log("💾 Token sent to server:", tokenSent);
    
    // Thử tạo token
    if (status === 'granted') {
      try {
        const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log("🔑 Current push token:", tokenResult.data);
      } catch (tokenError) {
        console.error("❌ Error creating token:", tokenError.message);
      }
    }
    
  } catch (error) {
    console.error("❌ Debug error:", error);
  }
}
