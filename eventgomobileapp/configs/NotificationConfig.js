import * as Notifications from 'expo-notifications';

// Cấu hình cách hiển thị thông báo khi ứng dụng đang mở
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

// Hàm hiển thị thông báo sự kiện
export async function showEventNotification(eventData, isUpdate = false) {
  const title = isUpdate ? 'Sự kiện đã được cập nhật' : 'Sự kiện mới';
  const body = isUpdate 
    ? `Sự kiện "${eventData.name}" đã được cập nhật.`
    : `Sự kiện "${eventData.name}" vừa được tạo. Khám phá ngay!`;
    
  await showNotification(title, body, {
    type: isUpdate ? 'EVENT_UPDATED' : 'EVENT_CREATED',
    eventId: eventData.id || eventData.eventId,
    eventName: eventData.name,
    eventDate: eventData.date,
    eventLocation: eventData.location,
    createdAt: new Date().toISOString()
  });
}
